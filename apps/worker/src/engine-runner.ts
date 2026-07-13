import type { RoadEngineConfig } from "@road-reality/config/road-engine";
import {
  addDiscrepancyEvidence,
  createDiscrepancy,
  createSystemAlert,
  listObservations,
  listRoadEvents,
  type RoadEvent,
  type RoadObservation,
  type RoadRealityDb
} from "@road-reality/database";
import { evaluateRoadState, type EngineRoadEvent, type EngineRoadObservation } from "@road-reality/road-engine";

export async function runDiscrepancyEngine(
  db: RoadRealityDb,
  config?: Partial<RoadEngineConfig>
) {
  const events = (await listRoadEvents(db, { limit: 500 })).map(toEngineEvent);
  const observations = (await listObservations(db, { limit: 500 })).map(toEngineObservation);
  const evaluated = evaluateRoadState({ events, observations, config });
  const persisted = [];

  for (const discrepancy of evaluated) {
    const row = await createDiscrepancy(db, {
      roadName: discrepancy.roadName,
      latitude: discrepancy.latitude,
      longitude: discrepancy.longitude,
      discrepancyType: discrepancy.type,
      status: discrepancy.status,
      declaredState: discrepancy.declaredState,
      observedState: discrepancy.observedState,
      confidence: discrepancy.confidence,
      severity: discrepancy.severity,
      title: discrepancy.title,
      summary: discrepancy.summary,
      explanation: discrepancy.explanation,
      firstDetectedAt: discrepancy.firstDetectedAt,
      lastDetectedAt: discrepancy.lastDetectedAt
    });

    for (const factor of discrepancy.evidenceScore.factors) {
      await addDiscrepancyEvidence(db, {
        discrepancyId: row.id,
        evidenceType: factor.signal,
        weight: factor.weight * factor.freshnessMultiplier,
        description: factor.description,
        metadata: {
          source: factor.source,
          base_weight: factor.weight,
          freshness_multiplier: factor.freshnessMultiplier,
          ...(factor.metadata ?? {})
        }
      });
    }

    if (discrepancy.status === "active") {
      await createSystemAlert(db, {
        discrepancyId: row.id,
        alertType: discrepancy.type,
        severity: discrepancy.severity,
        message: discrepancy.summary,
        payload: {
          confidence: discrepancy.confidence,
          road_name: discrepancy.roadName
        }
      });
    }
    persisted.push(row);
  }

  return persisted;
}

function toEngineEvent(row: RoadEvent): EngineRoadEvent {
  return {
    id: row.id,
    source: row.sourceId,
    sourceId: row.sourceId,
    externalId: row.externalId ?? undefined,
    eventType: row.eventType as EngineRoadEvent["eventType"],
    title: row.title ?? undefined,
    description: row.description ?? undefined,
    roadName: row.roadName ?? undefined,
    direction: row.direction ?? undefined,
    severity: row.severity ?? undefined,
    declaredState: row.declaredStatus as EngineRoadEvent["declaredState"],
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    startTime: row.startTime ?? undefined,
    endTime: row.endTime ?? undefined,
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
    ingestedAt: row.updatedAt,
    rawPayload: {}
  };
}

function toEngineObservation(row: RoadObservation): EngineRoadObservation {
  return {
    id: row.id,
    source: row.sourceId,
    cameraId: row.cameraId ?? undefined,
    snapshotId: row.snapshotId ?? undefined,
    observationType: row.observationType as EngineRoadObservation["observationType"],
    roadName: row.roadName ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    observedState: row.observedState as EngineRoadObservation["observedState"],
    confidence: row.confidence,
    evidence: row.evidence,
    observedAt: row.observedAt,
    expiresAt: row.expiresAt ?? undefined
  };
}

