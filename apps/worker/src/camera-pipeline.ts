import {
  createObservation,
  getCamera,
  getDataSource,
  getCameraSnapshotByHash,
  listCameras,
  markCameraError,
  markCameraSuccess,
  upsertCameraSnapshot,
  type Camera,
  type RoadRealityDb
} from "@road-reality/database";
import { loadConfig } from "@road-reality/config";
import {
  analyzeFetchedImage,
  captureLiveStreamFrame,
  MockVisualAnalyzer,
  ObjectDetectorAnalyzer,
  VisionApiAnalyzer,
  type VisualAnalyzer
} from "@road-reality/vision";

export async function analyzeRegisteredCamera(db: RoadRealityDb, cameraId: string) {
  const camera = await getCamera(db, cameraId);
  if (!camera) throw new Error("camera not found");
  if (!camera.streamUrl) throw new Error("camera has no stream_url");

  const config = loadConfig();
  const source = await getDataSource(db, camera.sourceId);
  if (!source) throw new Error("camera source is missing");

  const image = await captureLiveStreamFrame(camera.streamUrl, {
    timeoutMs: Math.max(config.CAMERA_FETCH_TIMEOUT_MS, 20000)
  });
  const existingSnapshot = await getCameraSnapshotByHash(db, camera.id, image.hash);
  if (existingSnapshot?.analysisStatus === "complete") {
    await markCameraSuccess(db, camera.id);
    return {
      camera,
      snapshot: existingSnapshot,
      observation: null,
      analysis: existingSnapshot.metadata?.analysis ?? null,
      duplicate: true
    };
  }

  const analyzer = createAnalyzer(config);
  const analysis = await analyzeFetchedImage(analyzer, image, {
    camera_id: camera.id,
    road_name: camera.roadName,
    capture_mode: "live_hls_frame",
    stream_url: camera.streamUrl
  });
  const snapshot = await upsertCameraSnapshot(db, {
    cameraId: camera.id,
    fetchedAt: image.fetchedAt,
    imageHash: image.hash,
    width: image.width,
    height: image.height,
    analysisStatus: "complete",
    metadata: {
      capture_mode: "live_hls_frame",
      stream_url: camera.streamUrl,
      analyzer: analyzer.analyzerName,
      analysis
    }
  });
  const observation = await createObservation(db, source.id, {
    source: source.slug,
    cameraId: camera.id,
    snapshotId: snapshot.id,
    observationType: "visual",
    roadName: camera.roadName ?? undefined,
    latitude: camera.latitude ?? undefined,
    longitude: camera.longitude ?? undefined,
    observedState: analysis.interpretation.observed_state,
    confidence: analysis.interpretation.confidence,
    evidence: {
      ...analysis.interpretation.evidence,
      capture_mode: "live_hls_frame",
      stream_url: camera.streamUrl,
      counts: analysis.counts,
      metrics: analysis.metrics
    },
    observedAt: image.fetchedAt,
    expiresAt: new Date(image.fetchedAt.valueOf() + config.roadEngine.cameraObservationStaleSeconds * 1000)
  });
  await markCameraSuccess(db, camera.id);

  return { camera, snapshot, observation, analysis };
}

export async function runCameraAnalysisCycle(
  db: RoadRealityDb,
  options: { maxCameras?: number; concurrency?: number } = {}
) {
  const config = loadConfig();
  const now = new Date();
  const cameras = await listCameras(db);
  const activeCameras = cameras.filter((camera) => camera.active && camera.streamUrl);
  const dueCameras = activeCameras
    .filter((camera) => shouldPollCamera(camera, now, config.CAMERA_POLL_SECONDS))
    .slice(0, options.maxCameras ?? activeCameras.length);

  const results = await mapWithConcurrency(dueCameras, options.concurrency ?? 4, async (camera) => {
    try {
      const result = await analyzeRegisteredCamera(db, camera.id);
      return {
        camera_id: camera.id,
        name: camera.name,
        ok: true,
        capture_mode: "live_hls_frame",
        duplicate: Boolean(result.duplicate),
        observation_created: Boolean(result.observation)
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await markCameraError(db, camera.id, message);
      return {
        camera_id: camera.id,
        name: camera.name,
        ok: false,
        error: message
      };
    }
  });

  return {
    checked_at: new Date().toISOString(),
    cameras_total: cameras.length,
    cameras_active: activeCameras.length,
    cameras_due: dueCameras.length,
    cameras_polled: dueCameras.length,
    results
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
) {
  const results: R[] = [];
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        const item = items[currentIndex];
        if (item === undefined) continue;
        results[currentIndex] = await mapper(item);
      }
    })
  );

  return results;
}

function shouldPollCamera(camera: Camera, now: Date, defaultIntervalSeconds: number) {
  const intervalSeconds = getCameraLiveCadenceSeconds(camera, defaultIntervalSeconds);
  const lastCheckedAt = latestDate(camera.lastSuccessAt, camera.lastErrorAt);
  if (!lastCheckedAt) return true;
  return now.valueOf() - lastCheckedAt.valueOf() >= intervalSeconds * 1000;
}

function getCameraLiveCadenceSeconds(camera: Camera, defaultIntervalSeconds: number) {
  const metadata = camera.metadata ?? {};
  const liveSeconds = metadata.live_analysis_interval_seconds;
  if (typeof liveSeconds === "number" && Number.isFinite(liveSeconds) && liveSeconds > 0) {
    return Math.max(5, liveSeconds);
  }
  return defaultIntervalSeconds;
}

function latestDate(...dates: Array<Date | null | undefined>) {
  return dates
    .filter((date): date is Date => date instanceof Date)
    .sort((left, right) => right.valueOf() - left.valueOf())[0];
}

function createAnalyzer(config: ReturnType<typeof loadConfig>): VisualAnalyzer {
  if (config.VISION_PROVIDER === "mock") return new MockVisualAnalyzer();
  if (config.VISION_PROVIDER === "external") {
    return new VisionApiAnalyzer({
      apiKey: config.VISION_API_KEY,
      model: config.VISION_MODEL,
      timeoutMs: 20000
    });
  }
  return new ObjectDetectorAnalyzer({
    serviceUrl: config.VISION_SERVICE_URL,
    timeoutMs: 15000
  });
}
