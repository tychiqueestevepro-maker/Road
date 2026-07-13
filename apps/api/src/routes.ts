import type { FastifyInstance } from "fastify";
import { assertUrlResolvesPublicly, validatePublicHttpUrl } from "@road-reality/shared/security";
import {
  createDb,
  getCamera,
  getDataSourceBySlug,
  getDiscrepancy,
  getMetrics,
  getRoadEvent,
  listCameraSnapshots,
  listCameras,
  listDataSources,
  listDiscrepancies,
  listDiscrepancyEvidence,
  listObservations,
  listRoadEvents,
  seedDataSources,
  toRoadIntelligenceResponse,
  upsertCamera
} from "@road-reality/database";
import { filtersSchema, createCameraSchema } from "./query.js";
import { ApiError } from "./errors.js";
import { enrichEventsForDisplay, liveEventDisplayTtlSeconds } from "./geocoding.js";

export function registerRoutes(app: FastifyInstance, db: ReturnType<typeof createDb>["db"]) {
  const healthHandler = async () => ({
    ok: true,
    service: "verytis-api",
    time: new Date().toISOString()
  });
  const metricsHandler = async () => getMetrics(db);

  app.get("/health", healthHandler);
  app.get("/api/health", healthHandler);

  app.get("/metrics", metricsHandler);
  app.get("/api/metrics", metricsHandler);

  app.get("/api/v1/live/state", async () => buildLivePayload(db));

  app.get("/api/v1/live/snapshot", async () => buildLivePayload(db));

  app.get("/api/v1/live", async (request, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    reply.raw.write(": connected\n\n");

    let closed = false;
    request.raw.on("close", () => {
      closed = true;
    });

    const send = async () => {
      if (closed || reply.raw.destroyed) return;
      try {
        const payload = await buildLivePayload(db);
        reply.raw.write(`event: road-state\n`);
        reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch (error) {
        reply.raw.write(`event: error\n`);
        reply.raw.write(
          `data: ${JSON.stringify({
            message: error instanceof Error ? error.message : String(error)
          })}\n\n`
        );
      }
    };

    await send();
    const interval = setInterval(send, 3000);
    request.raw.on("close", () => clearInterval(interval));
    return reply;
  });

  app.get("/api/v1/connectors", async () => {
    await seedDataSources(db);
    const [{ getConnectorHealth }, sources] = await Promise.all([
      loadIngestionWorker(),
      listDataSources(db)
    ]);
    const health = await getConnectorHealth();
    const healthBySource = new Map(health.map((item) => [item.source, item]));
    return sources.map((source) => ({
      ...source,
      health: healthBySource.get(source.slug) ?? {
        source: source.slug,
        ok: source.lastErrorAt === null,
        status: source.lastErrorAt ? "degraded" : "demo",
        checkedAt: new Date()
      }
    }));
  });

  app.get("/api/v1/connectors/:source/health", async (request) => {
    const source = (request.params as { source: string }).source;
    const { getConnectorHealth } = await loadIngestionWorker();
    const health = await getConnectorHealth();
    const found = health.find((item) => item.source === source);
    if (found) return found;

    const dbSource = await getDataSourceBySlug(db, source);
    if (!dbSource) {
      throw new ApiError("CONNECTOR_NOT_FOUND", `Connector ${source} was not found`, 404);
    }
    return {
      source,
      ok: Boolean(dbSource.lastSuccessAt && !dbSource.lastErrorAt),
      status: dbSource.lastErrorAt ? "degraded" : "demo",
      checkedAt: new Date(),
      message: dbSource.lastError ?? undefined
    };
  });

  app.post("/api/v1/ingestion/run", async () => {
    const [{ runIngestionOnce }, { runDiscrepancyEngine }] = await Promise.all([
      loadIngestionWorker(),
      loadEngineRunner()
    ]);
    const ingestion = await runIngestionOnce(db);
    const discrepancies = await runDiscrepancyEngine(db);
    return { ingestion, discrepancies_created_or_updated: discrepancies.length };
  });

  app.get("/api/v1/events", async (request) => {
    const filters = filtersSchema.parse(request.query);
    return enrichEventsForDisplay(await listRoadEvents(db, filters));
  });

  app.get("/api/v1/events/:id", async (request) => {
    const event = await getRoadEvent(db, (request.params as { id: string }).id);
    if (!event) throw new ApiError("EVENT_NOT_FOUND", "Road event was not found", 404);
    const [enrichedEvent] = await enrichEventsForDisplay([event]);
    return enrichedEvent ?? event;
  });

  app.get("/api/v1/discrepancies", async (request) => {
    const filters = filtersSchema.parse(request.query);
    const rows = await listDiscrepancies(db, filters);
    return Promise.all(
      rows.map(async (row) =>
        toRoadIntelligenceResponse(row, await listDiscrepancyEvidence(db, row.id))
      )
    );
  });

  app.get("/api/v1/discrepancies/:id", async (request) => {
    const id = (request.params as { id: string }).id;
    const discrepancy = await getDiscrepancy(db, id);
    if (!discrepancy) {
      throw new ApiError("DISCREPANCY_NOT_FOUND", "Discrepancy was not found", 404);
    }
    return toRoadIntelligenceResponse(
      discrepancy,
      await listDiscrepancyEvidence(db, discrepancy.id)
    );
  });

  app.get("/api/v1/cameras", async () => listCameras(db));

  app.get("/api/v1/cameras/:id", async (request) => {
    const id = (request.params as { id: string }).id;
    const camera = await getCamera(db, id);
    if (!camera) throw new ApiError("CAMERA_NOT_FOUND", "Camera was not found", 404);
    return {
      ...camera,
      snapshots: await listCameraSnapshots(db, id)
    };
  });

  app.post("/api/v1/cameras", async (request) => {
    const body = createCameraSchema.parse(request.body);
    if (body.snapshot_url) await assertUrlResolvesPublicly(body.snapshot_url);
    if (body.stream_url) validatePublicHttpUrl(body.stream_url);

    await seedDataSources(db);
    const source = await getDataSourceBySlug(db, "manual_camera");
    if (!source) throw new ApiError("SOURCE_MISSING", "manual_camera source is missing", 500);

    return upsertCamera(db, source.id, {
      externalId: body.external_id,
      name: body.name,
      roadName: body.road_name,
      direction: body.direction,
      latitude: body.latitude,
      longitude: body.longitude,
      snapshotUrl: body.snapshot_url,
      streamUrl: body.stream_url,
      active: body.active,
      metadata: {
        ...(body.metadata ?? {}),
        registration_mode: "manual_public_url"
      }
    });
  });

  app.post("/api/v1/cameras/:id/analyze", async (request) => {
    const id = (request.params as { id: string }).id;
    const [{ analyzeRegisteredCamera }, { runDiscrepancyEngine }] = await Promise.all([
      loadCameraPipeline(),
      loadEngineRunner()
    ]);
    const result = await analyzeRegisteredCamera(db, id);
    await runDiscrepancyEngine(db);
    return result;
  });

  app.get("/api/v1/observations", async (request) => {
    const filters = filtersSchema.parse(request.query);
    return listObservations(db, filters);
  });

  app.get("/api/v1/road-segments/:id/state", async (request) => ({
    id: (request.params as { id: string }).id,
    declared_state: "unknown",
    observed_state: "unknown",
    confidence: 0,
    explanation: [
      "V0 uses event and observation proximity matching; persistent road segment conflation is ready for an OSM-backed import."
    ]
  }));

  app.get("/api/v1/demo/scenario", async () => {
    const [{ seedDemoScenario }, { runDiscrepancyEngine }] = await Promise.all([
      loadDemoWorker(),
      loadEngineRunner()
    ]);
    const seed = await seedDemoScenario(db);
    const discrepancies = await runDiscrepancyEngine(db);
    return {
      scenario: "halleck_possible_unreported_closure",
      positioning: "Scenario inspired by real-world road information synchronization failures.",
      demo_data: true,
      seed,
      discrepancies
    };
  });
}

async function loadIngestionWorker() {
  return import("@road-reality/worker/ingestion");
}

async function loadEngineRunner() {
  return import("@road-reality/worker/engine-runner");
}

async function loadDemoWorker() {
  return import("@road-reality/worker/demo");
}

async function loadCameraPipeline() {
  return import("@road-reality/worker/camera-pipeline");
}

export async function buildLivePayload(db: ReturnType<typeof createDb>["db"]) {
  const metrics = await getMetrics(db);
  const events = await listRoadEvents(db, { limit: 500 });
  const cameras = await listCameras(db);
  const observations = await listObservations(db, { limit: 100 });

  return {
    streamed_at: new Date().toISOString(),
    stream: {
      mode: "sse",
      interval_ms: 3000,
      label: "live"
    },
    metrics,
    discrepancies: [],
    events: await enrichEventsForDisplay(events.filter(isLiveRoadEvent).slice(0, 100)),
    cameras,
    observations
  };
}

function isLiveRoadEvent(event: {
  declaredStatus: string;
  startTime?: Date | null;
  endTime?: Date | null;
  lastSeenAt?: Date | null;
}) {
  if (!["closed", "partially_closed", "restricted"].includes(event.declaredStatus)) {
    return false;
  }

  const now = Date.now();
  if (event.startTime && event.startTime.valueOf() > now) return false;
  if (event.endTime && event.endTime.valueOf() < now) return false;

  const lastSeenAt = event.lastSeenAt?.valueOf();
  if (!lastSeenAt) return false;
  return now - lastSeenAt <= liveEventDisplayTtlSeconds() * 1000;
}
