import { loadConfig } from "@road-reality/config";
import { createDb, type RoadRealityDb } from "@road-reality/database";
import { runCameraAnalysisCycle } from "@road-reality/worker/camera-pipeline";
import { syncCaltransCameras } from "@road-reality/worker/camera-sync";
import { runDiscrepancyEngine } from "@road-reality/worker/engine-runner";
import { runIngestionOnce } from "@road-reality/worker/ingestion";
import { inngest } from "./client";

export const ingestDeclaredRoadSources = inngest.createFunction(
  {
    id: "ingest-declared-road-sources",
    name: "Ingest declared road sources",
    triggers: [
      { cron: "*/2 * * * *", jitter: "30s" },
      { event: "verytis/ingestion.requested" }
    ]
  },
  async ({ step }) => {
    const ingestion = await step.run("ingest official feeds", async () =>
      withDb((db) => runIngestionOnce(db))
    );
    const discrepancies = await step.run("evaluate road state", async () =>
      withDb((db) => runDiscrepancyEngine(db, loadConfig().roadEngine))
    );

    return {
      ingestion,
      discrepancies_created_or_updated: discrepancies.length
    };
  }
);

export const syncPublicLiveCameras = inngest.createFunction(
  {
    id: "sync-public-live-cameras",
    name: "Sync public live cameras",
    triggers: [
      { cron: "*/10 * * * *", jitter: "2m" },
      { event: "verytis/cameras.sync.requested" }
    ]
  },
  async ({ step }) =>
    step.run("sync Caltrans live camera registry", async () =>
      withDb((db) =>
        syncCaltransCameras(db, {
          maxCameras: 200,
          verifyStreams: false
        })
      )
    )
);

export const analyzeLiveCameras = inngest.createFunction(
  {
    id: "analyze-live-cameras",
    name: "Analyze live cameras",
    triggers: [
      { cron: "*/5 * * * *", jitter: "1m" },
      { event: "verytis/cameras.analyze.requested" }
    ]
  },
  async ({ step }) => {
    if (process.env.VISION_PROVIDER === "local") {
      return {
        skipped: true,
        reason: "VISION_PROVIDER=local is not reachable from Vercel serverless"
      };
    }

    const cameraCycle = await step.run("analyze due live cameras", async () =>
      withDb((db) => runCameraAnalysisCycle(db, { maxCameras: 3, concurrency: 1 }))
    );
    const discrepancies = await step.run("evaluate observed road state", async () =>
      withDb((db) => runDiscrepancyEngine(db, loadConfig().roadEngine))
    );

    return {
      camera_cycle: cameraCycle,
      discrepancies_created_or_updated: discrepancies.length
    };
  }
);

export const functions = [ingestDeclaredRoadSources, syncPublicLiveCameras, analyzeLiveCameras];

async function withDb<T>(task: (db: RoadRealityDb) => Promise<T>) {
  const { db, sql } = createDb();
  try {
    return await task(db);
  } finally {
    await sql.end();
  }
}
