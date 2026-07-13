import { CaltransProvider, type CaltransProviderOptions } from "@road-reality/connectors";
import { captureLiveStreamFrame } from "@road-reality/vision";
import {
  getDataSourceBySlug,
  markSourcePoll,
  seedDataSources,
  upsertCamera,
  type RoadRealityDb
} from "@road-reality/database";

export interface CameraSyncResult {
  provider: string;
  source: string;
  cameras_received: number;
  cameras_upserted: number;
  cameras_with_stream: number;
  live_streams_available: number;
  snapshot_cadence_minutes: number[];
  checked_at: string;
}

export type CameraSyncOptions = CaltransProviderOptions & {
  verifyStreams?: boolean;
};

export async function syncCaltransCameras(
  db: RoadRealityDb,
  options: CameraSyncOptions = {}
): Promise<CameraSyncResult> {
  await seedDataSources(db);
  const source = await getDataSourceBySlug(db, "caltrans_camera");
  if (!source) throw new Error("caltrans_camera source is missing");

  const { verifyStreams = true, ...providerOptions } = options;
  const provider = new CaltransProvider(providerOptions);
  const cameras = await provider.listCameras();
  const streamAvailability = verifyStreams
    ? new Map(
        await mapWithConcurrency(cameras, 6, async (camera) => [
          camera.externalId,
          camera.streamUrl ? await isLiveStreamAvailable(camera.streamUrl) : false
        ])
      )
    : new Map(cameras.map((camera) => [camera.externalId, Boolean(camera.streamUrl)]));
  let camerasUpserted = 0;

  for (const camera of cameras) {
    const liveStreamAvailable = streamAvailability.get(camera.externalId) ?? false;
    await upsertCamera(db, source.id, {
      externalId: camera.externalId,
      name: camera.name,
      roadName: camera.roadName,
      direction: camera.direction,
      latitude: camera.latitude,
      longitude: camera.longitude,
      snapshotUrl: null,
      streamUrl: camera.streamUrl ?? undefined,
      active: camera.active && liveStreamAvailable,
      metadata: {
        ...(camera.metadata ?? {}),
        registration_mode: "caltrans_cwwp2_sync",
        analysis_mode: liveStreamAvailable ? "live_hls_stream" : "not_live_streamable",
        live_stream_available: liveStreamAvailable,
        live_analysis_interval_seconds: 30,
        static_snapshot_disabled: true,
        synced_at: new Date().toISOString()
      }
    });
    camerasUpserted += 1;
  }

  const cadenceMinutes = [
    ...new Set(
      cameras
        .map((camera) => camera.metadata?.current_image_update_frequency_minutes)
        .filter((item): item is number => typeof item === "number" && Number.isFinite(item))
    )
  ].sort((left, right) => left - right);

  const result: CameraSyncResult = {
    provider: provider.providerName,
    source: source.slug,
    cameras_received: cameras.length,
    cameras_upserted: camerasUpserted,
    cameras_with_stream: cameras.filter((camera) => Boolean(camera.streamUrl)).length,
    live_streams_available: [...streamAvailability.values()].filter(Boolean).length,
    snapshot_cadence_minutes: cadenceMinutes,
    checked_at: new Date().toISOString()
  };

  await markSourcePoll(db, source.id, {
    ok: true,
    metadata: {
      provider: provider.providerName,
      feed: "https://cwwp2.dot.ca.gov/data/d4/cctv/cctvStatusD04.json",
      default_scope: "San Francisco District 4 CCTV",
      cameras_received: result.cameras_received,
      cameras_upserted: result.cameras_upserted,
      cameras_with_stream: result.cameras_with_stream,
      live_streams_available: result.live_streams_available,
      snapshot_cadence_minutes: result.snapshot_cadence_minutes,
      fair_use:
        "Do not bulk stream 10 or more Caltrans video feeds without written agreement."
    }
  });

  return result;
}

async function isLiveStreamAvailable(streamUrl: string) {
  try {
    await captureLiveStreamFrame(streamUrl, { timeoutMs: 15000 });
    return true;
  } catch {
    return false;
  }
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
