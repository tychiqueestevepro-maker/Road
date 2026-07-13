import type {
  ConnectorHealth,
  NormalizedRoadEvent,
  RawSourceResult,
  RoadDataConnector,
  RoadEventType,
  DeclaredRoadState
} from "@road-reality/shared";
import {
  asArray,
  asRecord,
  calculateFreshnessSeconds,
  fetchJsonWithRetry,
  readDate,
  readNumber,
  readString
} from "../http.js";

const SOURCE = "sf511_traffic_events";
const BASE_URL = "https://api.511.org/traffic/events";

export interface Sf511TrafficEventsOptions {
  apiKey?: string;
  timeoutMs?: number;
}

export class Sf511TrafficEventsConnector implements RoadDataConnector {
  sourceName = SOURCE;
  sourceType = "declared_state";

  constructor(private readonly options: Sf511TrafficEventsOptions = {}) {}

  async fetch(): Promise<RawSourceResult> {
    const apiKey = this.options.apiKey ?? process.env.SF511_API_KEY;
    if (!apiKey) {
      throw new Error("SF511_API_KEY is required for 511 Traffic Events ingestion");
    }

    const url = new URL(BASE_URL);
    url.searchParams.set("api_key", apiKey);

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
      records: asArray(response.body),
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
      .map((record) => normalizeTrafficEvent(record, ingestedAt))
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

export function normalizeTrafficEvent(
  value: unknown,
  ingestedAt = new Date()
): NormalizedRoadEvent | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const sourceUpdatedAt = readDate(record, [
    "updated",
    "Updated",
    "last_updated",
    "LastUpdated",
    "lastUpdate",
    "modified"
  ]);
  const eventTypeText = readString(record, [
    "event_type",
    "EventType",
    "eventType",
    "type",
    "Category",
    "category"
  ]);
  const description = readString(record, [
    "description",
    "Description",
    "detail",
    "Details",
    "summary",
    "Summary"
  ]);
  const title =
    readString(record, ["title", "Title", "headline", "Headline"]) ??
    eventTypeText ??
    description;
  const roadName = readString(record, [
    "road_name",
    "RoadName",
    "RoadwayName",
    "roadway",
    "Route",
    "route",
    "Location",
    "location"
  ]);

  const latitude = readNumber(record, ["latitude", "Latitude", "lat", "Lat"]);
  const longitude = readNumber(record, ["longitude", "Longitude", "lon", "lng", "Long"]);
  const startTime = readDate(record, [
    "start_time",
    "StartTime",
    "start",
    "StartDate",
    "EventStartTime"
  ]);
  const endTime = readDate(record, ["end_time", "EndTime", "end", "EndDate", "EventEndTime"]);

  const combined = `${eventTypeText ?? ""} ${title ?? ""} ${description ?? ""}`.toLowerCase();
  return {
    source: SOURCE,
    externalId:
      readString(record, ["id", "ID", "event_id", "EventId", "EventID", "identifier"]) ??
      undefined,
    sourceUrl: BASE_URL,
    eventType: classifyTrafficEvent(combined),
    title,
    description,
    roadName,
    direction: readString(record, ["direction", "Direction", "dir"]),
    severity: readNumber(record, ["severity", "Severity", "priority", "Priority"]),
    declaredState: inferDeclaredState(combined),
    latitude,
    longitude,
    startTime,
    endTime,
    sourceUpdatedAt,
    firstSeenAt: ingestedAt,
    lastSeenAt: ingestedAt,
    ingestedAt,
    freshnessSeconds: calculateFreshnessSeconds(sourceUpdatedAt, ingestedAt),
    rawPayload: record
  };
}

function classifyTrafficEvent(text: string): RoadEventType {
  if (text.includes("full closure") || text.includes("closed")) return "closure";
  if (text.includes("lane")) return "lane_closure";
  if (text.includes("construct") || text.includes("work zone")) return "construction";
  if (text.includes("collision") || text.includes("accident") || text.includes("crash")) {
    return "collision";
  }
  if (text.includes("detour")) return "detour";
  if (text.includes("disabled")) return "disabled_vehicle";
  if (text.includes("hazard") || text.includes("debris")) return "hazard";
  if (text.includes("congestion") || text.includes("traffic")) return "congestion";
  return "unknown";
}

function inferDeclaredState(text: string): DeclaredRoadState {
  if (text.includes("open to traffic") || text.includes("road open")) return "open";
  if (text.includes("full closure") || text.includes("closed")) return "closed";
  if (text.includes("lane") && text.includes("closed")) return "partially_closed";
  if (text.includes("detour") || text.includes("restricted")) return "restricted";
  if (text.includes("planned") || text.includes("scheduled")) return "planned";
  return "unknown";
}

