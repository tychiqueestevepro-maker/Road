import { createDb } from "@road-reality/database";
import { loadConfig, loadLocalEnv } from "@road-reality/config";
import { runIngestionOnce } from "./ingestion.js";
import { runDiscrepancyEngine } from "./engine-runner.js";
import { runDemoScenario, seedDemoScenario } from "./demo.js";
import { runCameraAnalysisCycle } from "./camera-pipeline.js";
import { syncCaltransCameras } from "./camera-sync.js";
import { logger } from "./logger.js";

loadLocalEnv();

export { analyzeRegisteredCamera, runCameraAnalysisCycle } from "./camera-pipeline.js";
export { syncCaltransCameras } from "./camera-sync.js";
export { getConnectorHealth, runIngestionOnce } from "./ingestion.js";
export { runDemoScenario, seedDemoScenario } from "./demo.js";
export { runDiscrepancyEngine } from "./engine-runner.js";

async function main() {
  const command = process.argv[2] ?? "worker";
  const { db, sql } = createDb();
  const config = loadConfig();

  try {
    if (command === "ingest:once") {
      console.log(JSON.stringify(await runIngestionOnce(db), null, 2));
      await runDiscrepancyEngine(db, config.roadEngine);
      return;
    }

    if (command === "demo:seed") {
      console.log(JSON.stringify(await seedDemoScenario(db), null, 2));
      return;
    }

    if (command === "demo:run") {
      console.log(JSON.stringify(await runDemoScenario(db), null, 2));
      return;
    }

    if (command === "cameras:sync:caltrans") {
      console.log(JSON.stringify(await syncCaltransCameras(db), null, 2));
      return;
    }

    await runWorkerLoop(db, config);
  } finally {
    await sql.end();
  }
}

async function runWorkerLoop(db: ReturnType<typeof createDb>["db"], config: ReturnType<typeof loadConfig>) {
  logger.info(
    {
      ingestion_poll_seconds: Math.min(
        config.SF511_EVENTS_POLL_SECONDS,
        config.SF511_WZDX_POLL_SECONDS,
        config.DATASF_CLOSURES_POLL_SECONDS
      ),
      camera_poll_seconds: config.CAMERA_POLL_SECONDS
    },
    "worker started"
  );
  let lastIngestionAt = 0;
  let lastCameraAt = 0;

  while (true) {
    const now = Date.now();
    const ingestionIntervalMs =
      Math.min(
        config.SF511_EVENTS_POLL_SECONDS,
        config.SF511_WZDX_POLL_SECONDS,
        config.DATASF_CLOSURES_POLL_SECONDS
      ) * 1000;
    const cameraIntervalMs = config.CAMERA_POLL_SECONDS * 1000;

    if (now - lastIngestionAt >= ingestionIntervalMs) {
      const ingestion = await runIngestionOnce(db);
      await runDiscrepancyEngine(db, config.roadEngine);
      lastIngestionAt = Date.now();
      logger.info({ ingestion }, "official sources ingested");
    }

    if (now - lastCameraAt >= cameraIntervalMs) {
      const cameraCycle = await runCameraAnalysisCycle(db);
      await runDiscrepancyEngine(db, config.roadEngine);
      lastCameraAt = Date.now();
      logger.info({ camera_cycle: cameraCycle }, "camera cycle complete");
    }

    await sleep(1000);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  logger.error({ error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
