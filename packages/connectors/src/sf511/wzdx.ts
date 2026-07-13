import type {
  ConnectorHealth,
  DeclaredRoadState,
  NormalizedRoadEvent,
  RawSourceResult,
  RoadDataConnector,
  RoadEventType
} from "@road-reality/shared";
import type { Geometry } from "geojson";
import {
  asArray,
  asRecord,
  calculateFreshnessSeconds,
  fetchJsonWithRetry,
  readDate,
  readNumber,
  readString
} from "../http.js";
import { isWithinSanFranciscoScope } from "./scope.js";

const SOURCE = "sf511_wzdx";
const BASE_URL = "https://api.511.org/traffic/wzdx";

export class Sf511WzdxConnector implements RoadDataConnector {
  sourceName = SOURCE;
  sourceType = "declared_state";

  constructor(private readonly options: { apiKey?: string; timeoutMs?: number } = {}) {}

  async fetch(): Promise<RawSourceResult> {
    const apiKey = this.options.apiKey ?? process.env.SF511_API_KEY;
    if (!apiKey) throw new Error("SF511_API_KEY is required for 511 WZDx ingestion");

    const url = new URL(BASE_URL);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("includeAllDefinedEnums", "true");

    const fetchedAt = new Date();
    const response = await fetchJsonWithRetry(url, {
      timeoutMs: this.options.timeoutMs ?? 10000,
      retries: 2
    });

    return {
      source: SOURCE,
      sourceType: this.sourceType,
      fetchedAt,
      url: BASE_URL,
      records: extractWzdxEvents(response.body),
      raw: response.body,
      metadata: {
        contentType: response.contentType,
        status: response.status,
        rawLength: response.rawText.length
      }
    };
  }

  async normalize(result: RawSourceResult): Promise<NormalizedRoadEvent[]> {
    const ingestedAt = new Date();
    return result.records
      .map((record) => normalizeWzdxRoadEvent(record, ingestedAt))
      .filter((event): event is NormalizedRoadEvent => Boolean(event));
  }

  async healthCheck(): Promise<ConnectorHealth> {
    const checkedAt = new Date();
    if (!(this.options.apiKey ?? process.env.SF511_API_KEY)) {
      return {
        source: SOURCE,
        ok: false,
        status: "not_configured",
        message: "SF511_API_KEY is not configured",
        checkedAt
      };
    }
    const start = performance.now();
    try {
      await this.fetch();
      return {
        source: SOURCE,
        ok: true,
        status: "online",
        checkedAt,
        latencyMs: Math.round(performance.now() - start)
      };
    } catch (error) {
      return {
        source: SOURCE,
        ok: false,
        status: "degraded",
        checkedAt,
        latencyMs: Math.round(performance.now() - start),
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

function extractWzdxEvents(body: unknown): unknown[] {
  const record = asRecord(body);
  if (record?.road_events && Array.isArray(record.road_events)) {
    return record.road_events;
  }
  return asArray(body);
}

export function normalizeWzdxRoadEvent(
  value: unknown,
  ingestedAt = new Date()
): NormalizedRoadEvent | undefined {
  const feature = asRecord(value);
  if (!feature) return undefined;

  const properties = asRecord(feature.properties) ?? {};
  const coreDetails = asRecord(properties.core_details) ?? {};
  const record = {
    ...feature,
    ...properties,
    ...coreDetails
  };

  const eventTypeText = readString(record, [
    "event_type",
    "type",
    "activity_type",
    "work_zone_type"
  ]);
  const vehicleImpact = readString(record, [
    "vehicle_impact",
    "vehicleImpact",
    "impact",
    "lane_status"
  ]);
  const status = readString(record, ["status", "event_status", "work_zone_status"]);
  const roadName = readStringOrArray(record, [
    "road_name",
    "road_names",
    "route",
    "route_name",
    "name",
    "location_description"
  ]);
  const description = readString(record, ["description", "comment", "restrictions"]);
  const restrictions = readString(record, ["restrictions", "restriction", "description"]);
  const combined = `${eventTypeText ?? ""} ${vehicleImpact ?? ""} ${status ?? ""} ${
    restrictions ?? ""
  } ${description ?? ""}`.toLowerCase();

  const geometry = extractGeometry(record);
  const point = extractPoint(record, geometry);
  if (
    !isWithinSanFranciscoScope({
      latitude: point?.latitude,
      longitude: point?.longitude,
      text: `${roadName ?? ""} ${description ?? ""} ${restrictions ?? ""}`
    })
  ) {
    return undefined;
  }

  const sourceUpdatedAt = readDate(record, [
    "update_date",
    "updated",
    "last_updated",
    "modified_date"
  ]);

  return {
    source: SOURCE,
    externalId:
      readString(record, ["id", "event_id", "road_event_id", "identifier"]) ?? undefined,
    sourceUrl: BASE_URL,
    eventType: classifyWzdxType(combined),
    title:
      readString(record, ["name", "title", "headline"]) ??
      ([roadName, description].filter(Boolean).join(" - ") ||
        `${eventTypeText ?? "WZDx road event"}`),
    description: description ?? JSON.stringify({ eventTypeText, vehicleImpact, status }),
    roadName,
    direction: readCleanString(record, ["direction", "directionality", "travel_direction"]),
    severity: severityFromWzdx(combined),
    declaredState: inferWzdxDeclaredState(combined),
    geometry,
    latitude: point?.latitude,
    longitude: point?.longitude,
    startTime: readDate(record, ["start_date", "start_time", "start"]),
    endTime: readDate(record, ["end_date", "end_time", "end"]),
    sourceUpdatedAt,
    firstSeenAt: ingestedAt,
    lastSeenAt: ingestedAt,
    ingestedAt,
    freshnessSeconds: calculateFreshnessSeconds(sourceUpdatedAt, ingestedAt),
    rawPayload: feature,
    metadata: {
      sourceSemantics: "sf511_wzdx_geojson",
      sourceScope: "san_francisco"
    }
  };
}

function readStringOrArray(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (!Array.isArray(value)) continue;

    const items = value.filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0
    );
    if (items.length > 0) return items.join(", ");
  }

  return readString(record, keys);
}

function readCleanString(record: Record<string, unknown>, keys: string[]) {
  const value = readString(record, keys);
  if (!value || value.toLowerCase() === "undefined" || value.toLowerCase() === "null") {
    return undefined;
  }
  return value;
}

function extractGeometry(record: Record<string, unknown>): Geometry | undefined {
  const geometry = record.geometry;
  if (geometry && typeof geometry === "object") return geometry as Geometry;

  const location = asRecord(record.location);
  if (location?.geometry && typeof location.geometry === "object") {
    return location.geometry as Geometry;
  }
  return undefined;
}

function extractPoint(
  record: Record<string, unknown>,
  geometry?: Geometry
): { latitude: number; longitude: number } | undefined {
  const lat = readNumber(record, ["latitude", "lat"]);
  const lon = readNumber(record, ["longitude", "lon", "lng"]);
  if (lat !== undefined && lon !== undefined) return { latitude: lat, longitude: lon };

  if (geometry?.type === "Point") {
    const longitude = geometry.coordinates[0];
    const latitude = geometry.coordinates[1];
    if (typeof latitude === "number" && typeof longitude === "number") {
      return { latitude, longitude };
    }
  }
  if (geometry?.type === "LineString") {
    const firstCoordinate = geometry.coordinates[0];
    const longitude = firstCoordinate?.[0];
    const latitude = firstCoordinate?.[1];
    if (typeof latitude === "number" && typeof longitude === "number") {
      return { latitude, longitude };
    }
  }
  return undefined;
}

function classifyWzdxType(text: string): RoadEventType {
  if (text.includes("road_closure") || text.includes("full closure")) return "closure";
  if (text.includes("lane") || text.includes("partial")) return "lane_closure";
  if (text.includes("detour")) return "detour";
  if (text.includes("work") || text.includes("maintenance") || text.includes("construction")) {
    return "construction";
  }
  return "unknown";
}

function inferWzdxDeclaredState(text: string): DeclaredRoadState {
  if (text.includes("road_closure") || text.includes("full closure") || text.includes("closed")) {
    return "closed";
  }
  if (text.includes("lane") || text.includes("partial")) return "partially_closed";
  if (text.includes("planned") || text.includes("pending")) return "planned";
  if (text.includes("restricted") || text.includes("detour")) return "restricted";
  if (text.includes("open")) return "open";
  return "unknown";
}

function severityFromWzdx(text: string): number {
  if (text.includes("full closure") || text.includes("road_closure")) return 5;
  if (text.includes("lane") || text.includes("detour")) return 3;
  return 2;
}
