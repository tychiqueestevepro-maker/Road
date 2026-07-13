import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  createDb,
  listRoadEvents,
  getRoadEvent,
  listDiscrepancies,
  getDiscrepancy,
  getDiscrepancyEvidence,
  listDiscrepancyEvidence,
  listDataSources,
  toRoadIntelligenceResponse,
  listObservations,
  type RoadEvent,
  type RoadRealityDb
} from "@road-reality/database";
import { filtersSchema } from "./query.js";
import { ApiError } from "./errors.js";
import {
  distanceMeters,
  enrichEventsForDisplay,
  enrichKnownLocation,
  eventTimeMs,
  liveEventDisplayTtlSeconds,
  serializePublicEvent,
  type EnrichedRoadEvent,
  type VehicleAction
} from "./geocoding.js";

/**
 * Register public developer API routes under /v1/*.
 *
 * These routes require Bearer API key authentication via the
 * `authenticateApiKey` preHandler, which is applied by the caller
 * using Fastify's prefix-level hooks.
 */
export function registerPublicApiRoutes(app: FastifyInstance, db: ReturnType<typeof createDb>["db"]) {
  // ------------------------------------------------------------------
  // GET /v1/discrepancies
  // ------------------------------------------------------------------
  app.get("/v1/discrepancies", {
    preHandler: [(app as any).authenticateApiKey],
    schema: {
      querystring: {
        type: "object",
        properties: {
          latitude: { type: "number" },
          longitude: { type: "number" },
          radius: { type: "number" },
          bbox: { type: "string" },
          type: { type: "string" },
          status: { type: "string" },
          confidence_min: { type: "number" },
          severity_min: { type: "number" },
          since: { type: "string" },
          until: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 250 },
          cursor: { type: "string" }
        }
      },
      response: {
        200: {
          type: "object",
          properties: {
            data: { type: "array" },
            pagination: {
              type: "object",
              properties: { next_cursor: { type: ["string", "null"] } }
            },
            meta: {
              type: "object",
              properties: { request_id: { type: "string" } }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const filters = filtersSchema.parse(request.query);
    const rows = await listDiscrepancies(db, filters);
    const data = await Promise.all(
      rows.map(async (row) => {
        const evidence = await listDiscrepancyEvidence(db, row.id);
        const resp = toRoadIntelligenceResponse(row, evidence);
        return resp;
      })
    );

    return {
      data,
      pagination: { next_cursor: null },
      meta: { request_id: String(request.id) }
    };
  });

  // ------------------------------------------------------------------
  // GET /v1/discrepancies/:id
  // ------------------------------------------------------------------
  app.get("/v1/discrepancies/:id", {
    preHandler: [(app as any).authenticateApiKey]
  }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const discrepancy = await getDiscrepancy(db, id);
    if (!discrepancy) {
      throw new ApiError("RESOURCE_NOT_FOUND", "Discrepancy not found.", 404);
    }

    const evidence = await listDiscrepancyEvidence(db, discrepancy.id);
    const resp = toRoadIntelligenceResponse(discrepancy, evidence);

    // Enrich with source information
    const sources = await listDataSources(db);
    const sourceMap = new Map(sources.map((s) => [s.id, s]));

    const enrichedEvidence = evidence.map((ev: any) => ({
      id: ev.id,
      type: ev.evidenceType,
      signal: ev.description,
      confidence: ev.weight,
      observed_at: ev.createdAt?.toISOString?.() ?? ev.createdAt,
      source: ev.metadata?.source ?? undefined
    }));

    const usedSources = sources
      .filter((s) => s.sourceType === "declared_state" || s.sourceType === "observed_state")
      .slice(0, 5)
      .map((s) => ({
        name: s.name,
        role: s.sourceType
      }));

    return {
      data: {
        ...resp,
        evidence: enrichedEvidence,
        sources: usedSources
      },
      meta: { request_id: String(request.id) }
    };
  });

  // ------------------------------------------------------------------
  // GET /v1/road-state
  // ------------------------------------------------------------------
  app.get("/v1/road-state", {
    preHandler: [(app as any).authenticateApiKey]
  }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    const latitude = Number(query.latitude);
    const longitude = Number(query.longitude);
    const radius = Number(query.radius || "100");

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new ApiError("INVALID_COORDINATES", "Valid latitude and longitude are required.", 400);
    }
    if (latitude < -90 || latitude > 90) {
      throw new ApiError("INVALID_COORDINATES", "Latitude must be between -90 and 90.", 400);
    }
    if (longitude < -180 || longitude > 180) {
      throw new ApiError("INVALID_COORDINATES", "Longitude must be between -180 and 180.", 400);
    }
    if (radius <= 0 || radius > 50000) {
      throw new ApiError("INVALID_RADIUS", "Radius must be between 1 and 50000 meters.", 400);
    }

    const displayTtlSeconds = liveEventDisplayTtlSeconds();
    const [discrepancyRows, coordinateEvents, candidateEvents, observations] = await Promise.all([
      listDiscrepancies(db, {
        latitude,
        longitude,
        radius,
        status: "active",
        limit: 10
      }),
      listRoadEvents(db, { latitude, longitude, radius, limit: 25 }),
      listRoadEvents(db, { limit: 100 }),
      listObservations(db, { latitude, longitude, radius, limit: 5 })
    ]);

    const safeCoordinateEvents = coordinateEvents ?? [];
    const safeCandidateEvents = candidateEvents ?? [];
    const safeObservations = observations ?? [];
    const candidates = dedupeEvents([...safeCoordinateEvents, ...safeCandidateEvents])
      .filter((event) => isRoadStateCandidate(event, displayTtlSeconds))
      .slice(0, 75);
    const enrichedEvents = await enrichEventsForDisplay(candidates);
    const nearbyEvents = enrichedEvents
      .map((event) => eventDistance(event, latitude, longitude))
      .filter((event): event is { event: EnrichedRoadEvent; distanceMeters: number } =>
        Boolean(event && event.distanceMeters <= radius)
      )
      .sort((left, right) => left.distanceMeters - right.distanceMeters);

    const vehicleGradeEvent = nearbyEvents.find(({ event }) => event.vehicleUsable)?.event;
    const advisoryEvent = nearbyEvents.find(({ event }) => !event.vehicleUsable)?.event;
    const primaryEvent = vehicleGradeEvent ?? advisoryEvent;

    const declaredState = primaryEvent?.declaredStatus ?? "unknown";
    const observedState =
      safeObservations.length > 0 ? (safeObservations[0] as any).observedState : "unknown";
    const hasDiscrepancy = discrepancyRows.length > 0;
    const topDiscrepancy = discrepancyRows[0];

    const inferredState = hasDiscrepancy
      ? "possible_information_gap"
      : declaredState !== "unknown"
        ? declaredState
        : observedState !== "unknown"
          ? observedState
          : "unknown";
    const decision = decideVehicleAction({
      declaredState,
      observedState,
      hasDiscrepancy,
      primaryEvent
    });
    const updatedAt = new Date().toISOString();
    const confidence = topDiscrepancy?.confidence ?? confidenceForEvent(primaryEvent);

    return {
      data: {
        query: {
          latitude,
          longitude,
          radius_meters: radius
        },
        location: {
          latitude,
          longitude,
          road_name: topDiscrepancy?.roadName ?? primaryEvent?.roadName ?? null
        },
        road_state: {
          declared_state: declaredState,
          observed_state: observedState,
          inferred_state: inferredState,
          confidence,
          severity: topDiscrepancy?.severity ?? primaryEvent?.severity ?? 0,
          action: decision.action,
          reason: decision.reason,
          vehicle_usable: decision.vehicleUsable
        },
        freshness: {
          updated_at: updatedAt,
          ttl_seconds: displayTtlSeconds,
          source_freshness_seconds: sourceFreshnessSeconds(primaryEvent)
        },
        display_lifecycle: {
          live_map_ttl_seconds: displayTtlSeconds,
          removal_meaning: "not_fresh_enough_for_live_map_not_confirmed_resolved"
        },
        location_quality: primaryEvent?.locationQuality ?? "unpositioned",
        events: nearbyEvents.slice(0, 5).map(({ event, distanceMeters }) => ({
          ...serializePublicEvent(event),
          distance_meters: Math.round(distanceMeters)
        })),
        advisory: {
          unpositioned_city_event_count: enrichedEvents.filter(
            (event) => !event.latitude || !event.longitude
          ).length,
          note:
            "Street-only or expired-map events may still correspond to real-world conditions; they are not treated as vehicle-grade local hazards."
        },
        declared_state: declaredState,
        observed_state: observedState,
        inferred_state: inferredState,
        confidence,
        active_discrepancies: discrepancyRows.map((d) => d.id),
        updated_at: updatedAt
      },
      meta: { request_id: String(request.id) }
    };
  });

  // ------------------------------------------------------------------
  // GET /v1/events
  // ------------------------------------------------------------------
  app.get("/v1/events", {
    preHandler: [(app as any).authenticateApiKey]
  }, async (request, reply) => {
    const filters = filtersSchema.parse(request.query);
    const rows = await listRoadEvents(db, filters);

    // Enrich with source provenance
    const sources = await listDataSources(db);
    const sourceMap = new Map(sources.map((s) => [s.id, s]));

    const enrichedRows = await enrichEventsForDisplay(rows);
    const data = enrichedRows.map((row) => {
      const source = sourceMap.get(row.sourceId);
      return {
        ...serializePublicEvent(row),
        source: source ? { id: source.slug, name: source.name, type: source.sourceType } : null
      };
    });

    return {
      data,
      pagination: { next_cursor: null },
      meta: { request_id: String(request.id) }
    };
  });

  // ------------------------------------------------------------------
  // GET /v1/events/:id
  // ------------------------------------------------------------------
  app.get("/v1/events/:id", {
    preHandler: [(app as any).authenticateApiKey]
  }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const event = await getRoadEvent(db, id);
    if (!event) {
      throw new ApiError("RESOURCE_NOT_FOUND", "Event not found.", 404);
    }

    const sources = await listDataSources(db);
    const source = sources.find((s) => s.id === event.sourceId);

    const [enrichedEvent] = await enrichEventsForDisplay([event]);

    return {
      data: {
        ...serializePublicEvent(enrichedEvent ?? enrichKnownLocation(event)),
        source: source ? { id: source.slug, name: source.name, type: source.sourceType } : null,
        freshness_seconds: source?.lastSuccessAt
          ? Math.round((Date.now() - new Date(source.lastSuccessAt).getTime()) / 1000)
          : null
      },
      meta: { request_id: String(request.id) }
    };
  });

  // ------------------------------------------------------------------
  // GET /v1/evidence/:id
  // ------------------------------------------------------------------
  app.get("/v1/evidence/:id", {
    preHandler: [(app as any).authenticateApiKey]
  }, async (request, reply) => {
    const id = (request.params as { id: string }).id;

    const evidence = await getDiscrepancyEvidence(db, id);
    if (!evidence) {
      throw new ApiError("RESOURCE_NOT_FOUND", "Evidence not found.", 404);
    }

    return {
      data: {
        id: evidence.id,
        type: evidence.evidenceType,
        signal: evidence.description,
        confidence: evidence.weight,
        observed_at: evidence.createdAt?.toISOString(),
        source: (evidence.metadata as any)?.source ?? {
          type: evidence.evidenceType,
          name: evidence.description
        }
      },
      meta: { request_id: String(request.id) }
    };
  });

  // ------------------------------------------------------------------
  // GET /v1/sources
  // ------------------------------------------------------------------
  app.get("/v1/sources", {
    preHandler: [(app as any).authenticateApiKey]
  }, async (request, reply) => {
    const sources = await listDataSources(db);
    const now = Date.now();

    const data = sources.map((s) => ({
      id: s.slug,
      name: s.name,
      type: s.sourceType,
      status: s.lastSuccessAt && !s.lastErrorAt
        ? "online"
        : s.lastErrorAt
          ? "degraded"
          : "unknown",
      last_success_at: s.lastSuccessAt?.toISOString() ?? null,
      last_error_at: s.lastErrorAt?.toISOString() ?? null,
      freshness_seconds: s.lastSuccessAt
        ? Math.round((now - new Date(s.lastSuccessAt).getTime()) / 1000)
        : null,
      poll_interval_seconds: s.pollIntervalSeconds
    }));

    return {
      data,
      meta: { request_id: String(request.id) }
    };
  });
}

function dedupeEvents(events: RoadEvent[]) {
  const byId = new Map<string, RoadEvent>();
  for (const event of events) byId.set(event.id, event);
  return [...byId.values()];
}

function isRoadStateCandidate(event: RoadEvent, ttlSeconds: number) {
  if (!["closed", "partially_closed", "restricted"].includes(event.declaredStatus)) return false;

  const now = Date.now();
  if (event.startTime && event.startTime.valueOf() > now) return false;
  if (event.endTime && event.endTime.valueOf() < now) return false;

  const seenAt = eventTimeMs(event);
  return Number.isFinite(seenAt) && now - seenAt <= ttlSeconds * 1000;
}

function eventDistance(event: EnrichedRoadEvent, latitude: number, longitude: number) {
  if (typeof event.latitude !== "number" || typeof event.longitude !== "number") return undefined;
  return {
    event,
    distanceMeters: distanceMeters(
      { latitude, longitude },
      { latitude: event.latitude, longitude: event.longitude }
    )
  };
}

function decideVehicleAction({
  declaredState,
  observedState,
  hasDiscrepancy,
  primaryEvent
}: {
  declaredState: string;
  observedState: string;
  hasDiscrepancy: boolean;
  primaryEvent?: EnrichedRoadEvent;
}): { action: VehicleAction; reason: string; vehicleUsable: boolean } {
  if (primaryEvent && !primaryEvent.vehicleUsable) {
    return {
      action: "operator_review",
      reason: "A nearby declared event is only approximately located; do not use it for automatic vehicle action.",
      vehicleUsable: false
    };
  }

  if (declaredState === "closed" || declaredState === "restricted") {
    return {
      action: "avoid",
      reason: "A fresh declared closure or restriction has a vehicle-usable location.",
      vehicleUsable: true
    };
  }

  if (declaredState === "partially_closed") {
    return {
      action: "slow_verify",
      reason: "A fresh declared partial closure is nearby.",
      vehicleUsable: true
    };
  }

  if (hasDiscrepancy) {
    return {
      action: "slow_verify",
      reason: "A possible road-state information gap is active nearby.",
      vehicleUsable: true
    };
  }

  if (["blocked", "possibly_blocked", "obstruction", "vehicles_stopped"].includes(observedState)) {
    return {
      action: "slow_verify",
      reason: "Observed signals suggest possible abnormal road conditions.",
      vehicleUsable: true
    };
  }

  return {
    action: "proceed",
    reason: "No fresh vehicle-usable closure or blockage signal was found in the requested radius.",
    vehicleUsable: true
  };
}

function confidenceForEvent(event?: EnrichedRoadEvent) {
  if (!event) return 0;
  if (event.locationQuality === "official_coordinates") return 0.86;
  if (event.locationQuality === "geocoded_address") return 0.72;
  if (event.locationQuality === "geocoded_street_center") return 0.4;
  return 0.2;
}

function sourceFreshnessSeconds(event?: EnrichedRoadEvent) {
  if (!event) return null;
  const seenAt = eventTimeMs(event);
  return Number.isFinite(seenAt) ? Math.max(0, Math.round((Date.now() - seenAt) / 1000)) : null;
}
