import { and, desc, eq, gte, ilike, lte, sql as drizzleSql } from "drizzle-orm";
import type { AnyColumn, SQL } from "drizzle-orm";
import type {
  DiscrepancyStatus,
  NormalizedRoadEvent,
  NormalizedRoadObservation,
  RoadRealityFilters
} from "@road-reality/shared";
import { buildRawRecordHash, hashPayload } from "./dedupe.js";
import {
  cameras,
  cameraSnapshots,
  dataSources,
  discrepancies,
  discrepancyEvidence,
  ingestionRuns,
  rawSourceRecords,
  roadEvents,
  roadObservations,
  systemAlerts,
  type Camera,
  type Discrepancy
} from "./schema.js";
import type { RoadRealityDb } from "./client.js";

function expectRow<T>(row: T | undefined, operation: string): T {
  if (!row) throw new Error(`${operation} did not return a row`);
  return row;
}

export async function ensureDataSource(
  db: RoadRealityDb,
  values: {
    slug: string;
    name: string;
    sourceType: string;
    baseUrl?: string;
    pollIntervalSeconds?: number;
    metadata?: Record<string, unknown>;
  }
) {
  const [source] = await db
    .insert(dataSources)
    .values({
      slug: values.slug,
      name: values.name,
      sourceType: values.sourceType,
      baseUrl: values.baseUrl,
      pollIntervalSeconds: values.pollIntervalSeconds,
      metadata: values.metadata ?? {}
    })
    .onConflictDoUpdate({
      target: dataSources.slug,
      set: {
        name: values.name,
        sourceType: values.sourceType,
        baseUrl: values.baseUrl,
        pollIntervalSeconds: values.pollIntervalSeconds,
        metadata: values.metadata ?? {},
        updatedAt: new Date()
      }
    })
    .returning();

  return expectRow(source, "ensureDataSource");
}

export async function seedDataSources(db: RoadRealityDb) {
  return Promise.all([
    ensureDataSource(db, {
      slug: "sf511_traffic_events",
      name: "511 Traffic Events",
      sourceType: "declared_state",
      baseUrl: "https://api.511.org/traffic/events",
      pollIntervalSeconds: 60
    }),
    ensureDataSource(db, {
      slug: "sf511_wzdx",
      name: "511 WZDx",
      sourceType: "declared_state",
      baseUrl: "https://api.511.org/traffic/wzdx",
      pollIntervalSeconds: 60
    }),
    ensureDataSource(db, {
      slug: "datasf_temporary_closures",
      name: "DataSF Temporary Street Closures",
      sourceType: "declared_state",
      baseUrl: "https://data.sfgov.org/resource/8x25-yybr.json",
      pollIntervalSeconds: 300
    }),
    ensureDataSource(db, {
      slug: "manual_camera",
      name: "Manual Camera Provider",
      sourceType: "observed_state",
      pollIntervalSeconds: 30,
      metadata: { provider: "manual" }
    }),
    ensureDataSource(db, {
      slug: "caltrans_camera",
      name: "Caltrans CWWP2 Public Cameras",
      sourceType: "observed_state",
      baseUrl: "https://cwwp2.dot.ca.gov/data/d4/cctv/cctvStatusD04.json",
      pollIntervalSeconds: 300,
      metadata: {
        status: "official_public_feed",
        provider: "caltrans_cwwp2",
        fair_use:
          "Do not bulk stream 10 or more Caltrans video feeds without written agreement."
      }
    })
  ]);
}

export async function listDataSources(db: RoadRealityDb) {
  return db.select().from(dataSources).orderBy(dataSources.name);
}

export async function getDataSourceBySlug(db: RoadRealityDb, slug: string) {
  const [source] = await db.select().from(dataSources).where(eq(dataSources.slug, slug));
  return source;
}

export async function getDataSource(db: RoadRealityDb, id: string) {
  const [source] = await db.select().from(dataSources).where(eq(dataSources.id, id));
  return source;
}

export async function markSourcePoll(
  db: RoadRealityDb,
  sourceId: string,
  result: { ok: boolean; error?: string; metadata?: Record<string, unknown> }
) {
  await db
    .update(dataSources)
    .set({
      lastPolledAt: new Date(),
      lastSuccessAt: result.ok ? new Date() : undefined,
      lastErrorAt: result.ok ? null : new Date(),
      lastError: result.ok ? null : result.error,
      metadata: result.metadata ?? {},
      updatedAt: new Date()
    })
    .where(eq(dataSources.id, sourceId));
}

export async function createIngestionRun(db: RoadRealityDb, sourceId: string) {
  const [run] = await db
    .insert(ingestionRuns)
    .values({ sourceId, status: "running" })
    .returning();
  return expectRow(run, "createIngestionRun");
}

export async function finishIngestionRun(
  db: RoadRealityDb,
  runId: string,
  values: {
    status: "success" | "partial" | "failed";
    recordsReceived?: number;
    recordsCreated?: number;
    recordsUpdated?: number;
    recordsFailed?: number;
    error?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const [run] = await db
    .update(ingestionRuns)
    .set({
      status: values.status,
      completedAt: new Date(),
      recordsReceived: values.recordsReceived ?? 0,
      recordsCreated: values.recordsCreated ?? 0,
      recordsUpdated: values.recordsUpdated ?? 0,
      recordsFailed: values.recordsFailed ?? 0,
      error: values.error,
      metadata: values.metadata ?? {}
    })
    .where(eq(ingestionRuns.id, runId))
    .returning();
  return expectRow(run, "finishIngestionRun");
}

export async function upsertRawRecord(
  db: RoadRealityDb,
  input: {
    sourceId: string;
    externalId?: string;
    payload: unknown;
    sourceUpdatedAt?: Date;
    ingestedAt?: Date;
  }
) {
  const recordHash = buildRawRecordHash(input.externalId, input.payload);
  const now = input.ingestedAt ?? new Date();
  const [record] = await db
    .insert(rawSourceRecords)
    .values({
      sourceId: input.sourceId,
      externalId: input.externalId,
      recordHash,
      payload: input.payload,
      sourceUpdatedAt: input.sourceUpdatedAt,
      firstSeenAt: now,
      lastSeenAt: now,
      ingestedAt: now
    })
    .onConflictDoUpdate({
      target: [rawSourceRecords.sourceId, rawSourceRecords.recordHash],
      set: {
        lastSeenAt: now,
        ingestedAt: now,
        sourceUpdatedAt: input.sourceUpdatedAt,
        payload: input.payload
      }
    })
    .returning();

  return expectRow(record, "upsertRawRecord");
}

export async function upsertRoadEvent(
  db: RoadRealityDb,
  sourceId: string,
  rawRecordId: string,
  event: NormalizedRoadEvent
) {
  const externalId = event.externalId ?? `hash:${hashPayload(event.rawPayload)}`;
  const [row] = await db
    .insert(roadEvents)
    .values({
      sourceId,
      rawRecordId,
      externalId,
      eventType: event.eventType,
      title: event.title,
      description: event.description,
      roadName: event.roadName,
      direction: event.direction,
      severity: event.severity,
      declaredStatus: event.declaredState,
      startTime: event.startTime,
      endTime: event.endTime,
      latitude: event.latitude,
      longitude: event.longitude,
      firstSeenAt: event.firstSeenAt ?? new Date(),
      lastSeenAt: event.lastSeenAt ?? new Date()
    })
    .onConflictDoUpdate({
      target: [roadEvents.sourceId, roadEvents.externalId],
      set: {
        rawRecordId,
        eventType: event.eventType,
        title: event.title,
        description: event.description,
        roadName: event.roadName,
        direction: event.direction,
        severity: event.severity,
        declaredStatus: event.declaredState,
        startTime: event.startTime,
        endTime: event.endTime,
        latitude: event.latitude,
        longitude: event.longitude,
        lastSeenAt: event.lastSeenAt ?? new Date(),
        updatedAt: new Date()
      }
    })
    .returning();

  return expectRow(row, "upsertRoadEvent");
}

export async function listRoadEvents(db: RoadRealityDb, filters: RoadRealityFilters = {}) {
  const clauses: SQL[] = [];
  if (filters.source) {
    const source = await getDataSourceBySlug(db, filters.source);
    if (source) clauses.push(eq(roadEvents.sourceId, source.id));
  }
  if (filters.event_type) clauses.push(eq(roadEvents.eventType, filters.event_type));
  if (filters.severity) clauses.push(gte(roadEvents.severity, filters.severity));
  if (filters.since) clauses.push(gte(roadEvents.lastSeenAt, new Date(filters.since)));
  if (filters.until) clauses.push(lte(roadEvents.lastSeenAt, new Date(filters.until)));
  clauses.push(...coordinateClauses(roadEvents.latitude, roadEvents.longitude, filters));

  return db
    .select()
    .from(roadEvents)
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(desc(roadEvents.lastSeenAt))
    .limit(Math.min(filters.limit ?? 250, 500));
}

export async function getRoadEvent(db: RoadRealityDb, id: string) {
  const [event] = await db.select().from(roadEvents).where(eq(roadEvents.id, id));
  return event;
}

export async function createObservation(
  db: RoadRealityDb,
  sourceId: string,
  observation: NormalizedRoadObservation
) {
  const [row] = await db
    .insert(roadObservations)
    .values({
      sourceId,
      cameraId: observation.cameraId,
      snapshotId: observation.snapshotId,
      observationType: observation.observationType,
      roadName: observation.roadName,
      latitude: observation.latitude,
      longitude: observation.longitude,
      observedState: observation.observedState,
      confidence: observation.confidence,
      evidence: observation.evidence,
      observedAt: observation.observedAt,
      expiresAt: observation.expiresAt
    })
    .returning();
  return expectRow(row, "createObservation");
}

export async function listObservations(db: RoadRealityDb, filters: RoadRealityFilters = {}) {
  const clauses: SQL[] = [];
  if (filters.confidence_min) {
    clauses.push(gte(roadObservations.confidence, filters.confidence_min));
  }
  if (filters.since) clauses.push(gte(roadObservations.observedAt, new Date(filters.since)));
  if (filters.until) clauses.push(lte(roadObservations.observedAt, new Date(filters.until)));
  clauses.push(...coordinateClauses(roadObservations.latitude, roadObservations.longitude, filters));

  return db
    .select()
    .from(roadObservations)
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(desc(roadObservations.observedAt))
    .limit(Math.min(filters.limit ?? 250, 500));
}

export async function upsertCamera(
  db: RoadRealityDb,
  sourceId: string,
  input: {
    externalId?: string;
    name: string;
    roadName?: string;
    direction?: string;
    latitude?: number;
    longitude?: number;
    snapshotUrl?: string | null;
    streamUrl?: string | null;
    active?: boolean;
    metadata?: Record<string, unknown>;
  }
) {
  const externalId = input.externalId ?? `manual:${input.name}`;
  const [camera] = await db
    .insert(cameras)
    .values({
      sourceId,
      externalId,
      name: input.name,
      roadName: input.roadName,
      direction: input.direction,
      latitude: input.latitude,
      longitude: input.longitude,
      snapshotUrl: input.snapshotUrl ?? null,
      streamUrl: input.streamUrl ?? null,
      active: input.active ?? true,
      metadata: input.metadata ?? {}
    })
    .onConflictDoUpdate({
      target: [cameras.sourceId, cameras.externalId],
      set: {
        name: input.name,
        roadName: input.roadName,
        direction: input.direction,
        latitude: input.latitude,
        longitude: input.longitude,
        snapshotUrl: input.snapshotUrl ?? null,
        streamUrl: input.streamUrl ?? null,
        active: input.active ?? true,
        metadata: input.metadata ?? {},
        updatedAt: new Date()
      }
    })
    .returning();
  return expectRow(camera, "upsertCamera");
}

export async function listCameras(db: RoadRealityDb) {
  return db.select().from(cameras).orderBy(cameras.name);
}

export async function getCamera(db: RoadRealityDb, id: string): Promise<Camera | undefined> {
  const [camera] = await db.select().from(cameras).where(eq(cameras.id, id));
  return camera;
}

export async function markCameraSuccess(db: RoadRealityDb, cameraId: string) {
  await db
    .update(cameras)
    .set({
      lastSuccessAt: new Date(),
      lastErrorAt: null,
      lastError: null,
      updatedAt: new Date()
    })
    .where(eq(cameras.id, cameraId));
}

export async function markCameraError(db: RoadRealityDb, cameraId: string, error: string) {
  await db
    .update(cameras)
    .set({
      lastErrorAt: new Date(),
      lastError: error,
      updatedAt: new Date()
    })
    .where(eq(cameras.id, cameraId));
}

export async function upsertCameraSnapshot(
  db: RoadRealityDb,
  input: {
    cameraId: string;
    capturedAt?: Date;
    fetchedAt?: Date;
    imageUrl?: string;
    storagePath?: string;
    imageHash: string;
    width?: number;
    height?: number;
    analysisStatus?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const [snapshot] = await db
    .insert(cameraSnapshots)
    .values({
      cameraId: input.cameraId,
      capturedAt: input.capturedAt,
      fetchedAt: input.fetchedAt ?? new Date(),
      imageUrl: input.imageUrl,
      storagePath: input.storagePath,
      imageHash: input.imageHash,
      width: input.width,
      height: input.height,
      analysisStatus: input.analysisStatus ?? "pending",
      metadata: input.metadata ?? {}
    })
    .onConflictDoUpdate({
      target: [cameraSnapshots.cameraId, cameraSnapshots.imageHash],
      set: {
        fetchedAt: input.fetchedAt ?? new Date(),
        analysisStatus: input.analysisStatus ?? "duplicate",
        metadata: input.metadata ?? {}
      }
    })
    .returning();
  return expectRow(snapshot, "upsertCameraSnapshot");
}

export async function getCameraSnapshotByHash(
  db: RoadRealityDb,
  cameraId: string,
  imageHash: string
) {
  const [snapshot] = await db
    .select()
    .from(cameraSnapshots)
    .where(
      and(
        eq(cameraSnapshots.cameraId, cameraId),
        eq(cameraSnapshots.imageHash, imageHash)
      )
    )
    .limit(1);
  return snapshot;
}

export async function listCameraSnapshots(db: RoadRealityDb, cameraId: string) {
  return db
    .select()
    .from(cameraSnapshots)
    .where(eq(cameraSnapshots.cameraId, cameraId))
    .orderBy(desc(cameraSnapshots.fetchedAt))
    .limit(25);
}

export async function createDiscrepancy(
  db: RoadRealityDb,
  input: {
    roadName?: string;
    latitude?: number;
    longitude?: number;
    discrepancyType: string;
    status?: DiscrepancyStatus;
    declaredState: string;
    observedState: string;
    confidence: number;
    severity: number;
    title: string;
    summary: string;
    explanation: string[];
    firstDetectedAt: Date;
    lastDetectedAt: Date;
    metadata?: Record<string, unknown>;
  }
) {
  const [existing] = await db
    .select()
    .from(discrepancies)
    .where(
      and(
        eq(discrepancies.discrepancyType, input.discrepancyType),
        eq(discrepancies.status, "active"),
        input.roadName
          ? ilike(discrepancies.roadName, input.roadName)
          : drizzleSql`true`
      )
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(discrepancies)
      .set({
        declaredState: input.declaredState,
        observedState: input.observedState,
        confidence: input.confidence,
        severity: input.severity,
        title: input.title,
        summary: input.summary,
        explanation: input.explanation,
        lastDetectedAt: input.lastDetectedAt,
        updatedAt: new Date()
      })
      .where(eq(discrepancies.id, existing.id))
      .returning();
    return expectRow(updated, "updateDiscrepancy");
  }

  const [row] = await db
    .insert(discrepancies)
    .values({
      roadName: input.roadName,
      latitude: input.latitude,
      longitude: input.longitude,
      discrepancyType: input.discrepancyType,
      status: input.status ?? "active",
      declaredState: input.declaredState,
      observedState: input.observedState,
      confidence: input.confidence,
      severity: input.severity,
      title: input.title,
      summary: input.summary,
      explanation: input.explanation,
      firstDetectedAt: input.firstDetectedAt,
      lastDetectedAt: input.lastDetectedAt
    })
    .returning();
  return expectRow(row, "createDiscrepancy");
}

export async function addDiscrepancyEvidence(
  db: RoadRealityDb,
  input: {
    discrepancyId: string;
    evidenceType: string;
    roadEventId?: string;
    observationId?: string;
    snapshotId?: string;
    weight: number;
    description: string;
    metadata?: Record<string, unknown>;
  }
) {
  const [row] = await db.insert(discrepancyEvidence).values(input).returning();
  return expectRow(row, "addDiscrepancyEvidence");
}

export async function listDiscrepancies(db: RoadRealityDb, filters: RoadRealityFilters = {}) {
  const clauses: SQL[] = [];
  if (filters.status) clauses.push(eq(discrepancies.status, filters.status));
  if (filters.confidence_min) {
    clauses.push(gte(discrepancies.confidence, filters.confidence_min));
  }
  if (filters.since) {
    clauses.push(gte(discrepancies.lastDetectedAt, new Date(filters.since)));
  }
  if (filters.until) {
    clauses.push(lte(discrepancies.lastDetectedAt, new Date(filters.until)));
  }
  clauses.push(...coordinateClauses(discrepancies.latitude, discrepancies.longitude, filters));

  return db
    .select()
    .from(discrepancies)
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(desc(discrepancies.lastDetectedAt))
    .limit(Math.min(filters.limit ?? 100, 250));
}

export async function getDiscrepancy(db: RoadRealityDb, id: string) {
  const [discrepancy] = await db
    .select()
    .from(discrepancies)
    .where(eq(discrepancies.id, id));
  return discrepancy;
}

export async function listDiscrepancyEvidence(db: RoadRealityDb, discrepancyId: string) {
  return db
    .select()
    .from(discrepancyEvidence)
    .where(eq(discrepancyEvidence.discrepancyId, discrepancyId))
    .orderBy(desc(discrepancyEvidence.createdAt));
}

export async function getDiscrepancyEvidence(db: RoadRealityDb, id: string) {
  const [evidence] = await db
    .select()
    .from(discrepancyEvidence)
    .where(eq(discrepancyEvidence.id, id))
    .limit(1);
  return evidence;
}

export async function createSystemAlert(
  db: RoadRealityDb,
  input: {
    discrepancyId: string;
    alertType: string;
    severity: number;
    message: string;
    payload?: Record<string, unknown>;
  }
) {
  const [row] = await db
    .insert(systemAlerts)
    .values({ ...input, payload: input.payload ?? {} })
    .returning();
  return expectRow(row, "createSystemAlert");
}

export async function clearDemoScenario(
  db: RoadRealityDb,
  scenario = "halleck_possible_unreported_closure"
) {
  await db.execute(drizzleSql`
    delete from system_alerts
    where discrepancy_id in (
      select id from discrepancies
      where road_name = 'Halleck Street'
        and discrepancy_type = 'possible_unreported_closure'
    )
  `);
  await db.execute(drizzleSql`
    delete from discrepancy_evidence
    where discrepancy_id in (
      select id from discrepancies
      where road_name = 'Halleck Street'
        and discrepancy_type = 'possible_unreported_closure'
    )
  `);
  await db.execute(drizzleSql`
    delete from discrepancies
    where road_name = 'Halleck Street'
      and discrepancy_type = 'possible_unreported_closure'
  `);
  await db.execute(drizzleSql`
    delete from road_observations
    where evidence->>'demo_scenario' = ${scenario}
  `);
  await db.execute(drizzleSql`
    delete from camera_snapshots
    where metadata->>'demo_scenario' = ${scenario}
  `);
}

export async function getLatestIngestion(db: RoadRealityDb) {
  const [run] = await db
    .select()
    .from(ingestionRuns)
    .orderBy(desc(ingestionRuns.startedAt))
    .limit(1);
  return run;
}

export async function getMetrics(db: RoadRealityDb) {
  const [connectorsTotal] = await db
    .select({ count: drizzleSql<number>`count(*)::int` })
    .from(dataSources);
  const [connectorsOnline] = await db
    .select({ count: drizzleSql<number>`count(*)::int` })
    .from(dataSources)
    .where(drizzleSql`${dataSources.lastSuccessAt} > now() - interval '15 minutes'`);
  const [activeDiscrepancies] = await db
    .select({ count: drizzleSql<number>`count(*)::int` })
    .from(discrepancies)
    .where(eq(discrepancies.status, "active"));
  const [observationsLastHour] = await db
    .select({ count: drizzleSql<number>`count(*)::int` })
    .from(roadObservations)
    .where(drizzleSql`${roadObservations.observedAt} > now() - interval '1 hour'`);
  const latest = await getLatestIngestion(db);

  return {
    connectors_online: connectorsOnline?.count ?? 0,
    connectors_total: connectorsTotal?.count ?? 0,
    active_discrepancies: activeDiscrepancies?.count ?? 0,
    observations_last_hour: observationsLastHour?.count ?? 0,
    last_ingestion_at: latest?.completedAt?.toISOString() ?? latest?.startedAt?.toISOString() ?? null
  };
}

export function toRoadIntelligenceResponse(
  discrepancy: Discrepancy,
  evidence: Array<Record<string, unknown>> = []
) {
  return {
    id: discrepancy.id,
    type: discrepancy.discrepancyType,
    status: discrepancy.status,
    location: {
      road_name: discrepancy.roadName,
      latitude: discrepancy.latitude,
      longitude: discrepancy.longitude
    },
    declared_state: discrepancy.declaredState,
    observed_state: discrepancy.observedState,
    confidence: discrepancy.confidence,
    severity: discrepancy.severity,
    first_detected_at: discrepancy.firstDetectedAt.toISOString(),
    last_detected_at: discrepancy.lastDetectedAt.toISOString(),
    summary: discrepancy.summary,
    explanation: discrepancy.explanation,
    evidence
  };
}

function coordinateClauses(
  latitudeColumn: AnyColumn,
  longitudeColumn: AnyColumn,
  filters: RoadRealityFilters
): SQL[] {
  const clauses: SQL[] = [];
  const bbox = parseBbox(filters.bbox);
  if (bbox) {
    clauses.push(
      drizzleSql`${longitudeColumn} between ${bbox.minLon} and ${bbox.maxLon}`,
      drizzleSql`${latitudeColumn} between ${bbox.minLat} and ${bbox.maxLat}`
    );
  }

  if (
    typeof filters.latitude === "number" &&
    typeof filters.longitude === "number" &&
    typeof filters.radius === "number"
  ) {
    clauses.push(drizzleSql`
      ${latitudeColumn} is not null
      and ${longitudeColumn} is not null
      and (
        6371000 * acos(
          least(1,
            cos(radians(${filters.latitude})) *
            cos(radians(${latitudeColumn})) *
            cos(radians(${longitudeColumn}) - radians(${filters.longitude})) +
            sin(radians(${filters.latitude})) *
            sin(radians(${latitudeColumn}))
          )
        )
      ) <= ${filters.radius}
    `);
  }

  return clauses;
}

function parseBbox(value?: string) {
  if (!value) return undefined;
  const [minLon, minLat, maxLon, maxLat] = value.split(",").map((item) => Number(item.trim()));
  if ([minLon, minLat, maxLon, maxLat].some((item) => !Number.isFinite(item))) {
    return undefined;
  }
  return { minLon, minLat, maxLon, maxLat };
}
