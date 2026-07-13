import {
  clearDemoScenario,
  createObservation,
  getDataSourceBySlug,
  seedDataSources,
  upsertCamera,
  upsertCameraSnapshot,
  upsertRawRecord,
  type RoadRealityDb
} from "@road-reality/database";
import type { NormalizedRoadObservation } from "@road-reality/shared";
import { runDiscrepancyEngine } from "./engine-runner.js";

const HALLECK = {
  roadName: "Halleck Street",
  latitude: 37.80128,
  longitude: -122.45582
};

export async function seedDemoScenario(db: RoadRealityDb) {
  await seedDataSources(db);
  await clearDemoScenario(db, "halleck_possible_unreported_closure");
  const manual = await getDataSourceBySlug(db, "manual_camera");
  const datasf = await getDataSourceBySlug(db, "datasf_temporary_closures");
  if (!manual || !datasf) throw new Error("required demo data sources are missing");

  await upsertRawRecord(db, {
    sourceId: datasf.id,
    externalId: "demo-halleck-empty-declared-snapshot",
    payload: {
      demo_data: true,
      demo_scenario: "halleck_possible_unreported_closure",
      records: [],
      statement: "No explicit active declared closure is present in this demo snapshot.",
      absence_semantics: "unknown_not_open"
    },
    ingestedAt: new Date()
  });

  const camera = await upsertCamera(db, manual.id, {
    externalId: "SF-DEMO-001",
    name: "SF-DEMO-001 Halleck Street",
    roadName: HALLECK.roadName,
    direction: "eastbound",
    latitude: HALLECK.latitude,
    longitude: HALLECK.longitude,
    snapshotUrl: "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=960&q=80",
    active: true,
    metadata: {
      demo_data: true,
      demo_scenario: "halleck_possible_unreported_closure",
      note: "Public placeholder snapshot URL; deterministic observations are demo data."
    }
  });

  const base = new Date();
  const observations: NormalizedRoadObservation[] = [
    demoObservation(base, -240, "normal", 0.64, { vehicle_count: 8 }),
    demoObservation(base, -180, "normal", 0.66, { vehicle_count: 5 }),
    demoObservation(base, -120, "low_flow", 0.72, { vehicle_count: 1 }),
    demoObservation(base, -60, "obstruction", 0.84, {
      vehicle_count: 0,
      barrier_detected: true,
      visual_signal: "possible_barrier"
    }),
    demoObservation(base, 0, "possibly_blocked", 0.86, {
      vehicle_count: 0,
      barrier_detected: true,
      temporal_signal: "persistent_flow_interruption",
      persistent_flow_interruption: true
    })
  ];

  const rows = [];
  for (const [index, observation] of observations.entries()) {
    const snapshot = await upsertCameraSnapshot(db, {
      cameraId: camera.id,
      capturedAt: observation.observedAt,
      fetchedAt: observation.observedAt,
      imageUrl: camera.snapshotUrl ?? undefined,
      imageHash: `demo-halleck-${index}`,
      width: 1280,
      height: 720,
      analysisStatus: "complete",
      metadata: {
        demo_data: true,
        demo_scenario: "halleck_possible_unreported_closure",
        sequence_index: index
      }
    });
    rows.push(
      await createObservation(db, manual.id, {
        ...observation,
        cameraId: camera.id,
        snapshotId: snapshot.id
      })
    );
  }

  return {
    camera,
    observations: rows,
    scenario: "halleck_possible_unreported_closure"
  };
}

export async function runDemoScenario(db: RoadRealityDb) {
  await seedDemoScenario(db);
  return runDiscrepancyEngine(db);
}

function demoObservation(
  base: Date,
  offsetSeconds: number,
  observedState: NormalizedRoadObservation["observedState"],
  confidence: number,
  evidence: Record<string, unknown>
): NormalizedRoadObservation {
  const observedAt = new Date(base.valueOf() + offsetSeconds * 1000);
  return {
    source: "manual_camera",
    observationType: "visual",
    roadName: HALLECK.roadName,
    latitude: HALLECK.latitude,
    longitude: HALLECK.longitude,
    observedState,
    confidence,
    evidence: {
      ...evidence,
      demo_data: true,
      demo_scenario: "halleck_possible_unreported_closure"
    },
    observedAt,
    expiresAt: new Date(observedAt.valueOf() + 10 * 60 * 1000),
    freshnessSeconds: Math.max(0, Math.round((Date.now() - observedAt.valueOf()) / 1000))
  };
}
