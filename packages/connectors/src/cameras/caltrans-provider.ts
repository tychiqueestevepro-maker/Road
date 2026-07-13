import type { CameraProvider } from "./camera-provider.js";
import type { CameraProviderHealth, CameraSourceRegistration } from "./types.js";
import { fetchJsonWithRetry } from "../http.js";

const DEFAULT_FEED_URL = "https://cwwp2.dot.ca.gov/data/d4/cctv/cctvStatusD04.json";
const DEFAULT_CAMERA_PAGE_BASE = "https://cwwp2.dot.ca.gov/vm/loc";

export interface CaltransProviderOptions {
  feedUrl?: string;
  district?: number;
  county?: string;
  nearbyPlace?: string;
  routes?: string[];
  includeInactive?: boolean;
  maxCameras?: number;
}

interface CaltransCctvResponse {
  data?: Array<{
    cctv?: CaltransCctvRecord;
  }>;
}

interface CaltransCctvRecord {
  index?: string;
  recordTimestamp?: {
    recordDate?: string;
    recordTime?: string;
    recordEpoch?: string;
  };
  location?: {
    district?: string;
    locationName?: string;
    nearbyPlace?: string;
    longitude?: string;
    latitude?: string;
    elevation?: string;
    direction?: string;
    county?: string;
    route?: string;
    postmile?: string;
    milepost?: string;
  };
  inService?: string;
  imageData?: {
    imageDescription?: string;
    streamingVideoURL?: string;
    static?: {
      currentImageUpdateFrequency?: string;
      currentImageURL?: string;
      referenceImageUpdateFrequency?: string;
    };
  };
}

export class CaltransProvider implements CameraProvider {
  providerName = "caltrans_camera";

  private readonly options: Required<Pick<CaltransProviderOptions, "feedUrl" | "district">> &
    Omit<CaltransProviderOptions, "feedUrl" | "district">;

  constructor(options: CaltransProviderOptions = {}) {
    this.options = {
      feedUrl: options.feedUrl ?? DEFAULT_FEED_URL,
      district: options.district ?? 4,
      county: options.county ?? "San Francisco",
      nearbyPlace: options.nearbyPlace ?? "San Francisco",
      routes: options.routes,
      includeInactive: options.includeInactive,
      maxCameras: options.maxCameras
    };
  }

  async listCameras(): Promise<CameraSourceRegistration[]> {
    const response = await fetchJsonWithRetry<CaltransCctvResponse>(this.options.feedUrl, {
      timeoutMs: 15000,
      retries: 2
    });
    const records = (response.body.data ?? [])
      .map((item) => item.cctv)
      .filter((item): item is CaltransCctvRecord => Boolean(item));

    const cameras = records.flatMap((record) => {
      const camera = normalizeCaltransCamera(record, this.options.district);
      if (!camera) return [];
      if (!this.options.includeInactive && !camera.active) return [];
      if (!matchesArea(camera, this.options)) return [];
      if (!matchesRoute(camera, this.options.routes)) return [];
      return [camera];
    });

    return this.options.maxCameras ? cameras.slice(0, this.options.maxCameras) : cameras;
  }

  async healthCheck(): Promise<CameraProviderHealth> {
    const startedAt = Date.now();
    try {
      const cameras = await this.listCameras();
      return {
        provider: this.providerName,
        ok: cameras.length > 0,
        status: cameras.length > 0 ? "online" : "degraded",
        checkedAt: new Date(),
        message: `Caltrans CWWP2 returned ${cameras.length} matching public cameras`,
        details: {
          feed_url: this.options.feedUrl,
          district: this.options.district,
          county: this.options.county,
          nearby_place: this.options.nearbyPlace,
          latency_ms: Date.now() - startedAt
        }
      };
    } catch (error) {
      return {
        provider: this.providerName,
        ok: false,
        status: "offline",
        checkedAt: new Date(),
        message: error instanceof Error ? error.message : String(error),
        details: {
          feed_url: this.options.feedUrl,
          district: this.options.district,
          latency_ms: Date.now() - startedAt
        }
      };
    }
  }
}

export function normalizeCaltransCamera(
  record: CaltransCctvRecord,
  defaultDistrict = 4
): CameraSourceRegistration | undefined {
  const location = record.location;
  const imageData = record.imageData;
  const staticImage = imageData?.static;
  const index = clean(record.index);
  const name = clean(location?.locationName);
  const latitude = toNumber(location?.latitude);
  const longitude = toNumber(location?.longitude);
  const snapshotUrl = cleanUrl(staticImage?.currentImageURL);

  if (!index || !name || latitude === undefined || longitude === undefined || !snapshotUrl) {
    return undefined;
  }

  const district = toNumber(location?.district) ?? defaultDistrict;
  const route = clean(location?.route);
  const streamUrl = cleanUrl(imageData?.streamingVideoURL) ?? null;
  const currentImageUpdateFrequencyMinutes = toNumber(staticImage?.currentImageUpdateFrequency);
  const referenceImageUpdateFrequencyMinutes = toNumber(
    staticImage?.referenceImageUpdateFrequency
  );

  return {
    provider: "caltrans_camera",
    externalId: `caltrans:d${district}:${index}`,
    name,
    roadName: route,
    direction: clean(location?.direction),
    latitude,
    longitude,
    snapshotUrl,
    streamUrl,
    active: clean(record.inService)?.toLowerCase() === "true",
    metadata: {
      source: "caltrans_cwwp2",
      district,
      index,
      route,
      county: clean(location?.county),
      nearby_place: clean(location?.nearbyPlace),
      image_description: clean(imageData?.imageDescription),
      current_image_update_frequency_minutes: currentImageUpdateFrequencyMinutes,
      reference_image_update_frequency_minutes: referenceImageUpdateFrequencyMinutes,
      record_timestamp: normalizeRecordTimestamp(record.recordTimestamp),
      camera_page_url: buildCameraPageUrl(snapshotUrl, district),
      fair_use_note: "Do not bulk stream 10 or more Caltrans video feeds without written agreement."
    }
  };
}

function matchesArea(
  camera: CameraSourceRegistration,
  options: Pick<CaltransProviderOptions, "county" | "nearbyPlace">
) {
  const county = String(camera.metadata?.county ?? "");
  const nearbyPlace = String(camera.metadata?.nearby_place ?? "");
  return (
    (options.county ? sameText(county, options.county) : false) ||
    (options.nearbyPlace ? sameText(nearbyPlace, options.nearbyPlace) : false)
  );
}

function matchesRoute(camera: CameraSourceRegistration, routes?: string[]) {
  if (!routes?.length) return true;
  const route = camera.roadName?.toLowerCase();
  return routes.some((item) => item.toLowerCase() === route);
}

function buildCameraPageUrl(snapshotUrl: string, district: number) {
  const match = /\/image\/([^/]+)\/[^/]+\.jpg$/i.exec(snapshotUrl);
  if (!match?.[1]) return undefined;
  return `${DEFAULT_CAMERA_PAGE_BASE}/d${district}/${match[1]}.htm`;
}

function normalizeRecordTimestamp(timestamp: CaltransCctvRecord["recordTimestamp"]) {
  if (!timestamp) return undefined;
  return {
    date: clean(timestamp.recordDate),
    time: clean(timestamp.recordTime),
    epoch: toNumber(timestamp.recordEpoch)
  };
}

function clean(value: unknown) {
  return typeof value === "string" && value.trim() && value.trim() !== "Not Reported"
    ? value.trim()
    : undefined;
}

function cleanUrl(value: unknown) {
  const cleaned = clean(value);
  if (!cleaned) return undefined;
  try {
    return new URL(cleaned).toString();
  } catch {
    return undefined;
  }
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function sameText(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}
