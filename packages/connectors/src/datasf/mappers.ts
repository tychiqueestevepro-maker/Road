import type { DeclaredRoadState, NormalizedRoadEvent, RoadEventType } from "@road-reality/shared";
import {
  asRecord,
  calculateFreshnessSeconds,
  readDate,
  readNumber,
  readString
} from "../http.js";

const SOURCE = "datasf_temporary_closures";
const SOURCE_URL = "https://data.sfgov.org/resource/8x25-yybr.json";

export interface DataSfFieldMap {
  id?: string;
  street?: string;
  type?: string;
  start?: string;
  end?: string;
  updated?: string;
  latitude?: string;
  longitude?: string;
}

export function inferDataSfFieldMap(rows: unknown[], metadata?: unknown): DataSfFieldMap {
  const sample = rows.map(asRecord).find(Boolean) ?? {};
  const keys = new Set(Object.keys(sample));

  const metadataColumns = asRecord(metadata)?.columns;
  if (Array.isArray(metadataColumns)) {
    for (const column of metadataColumns) {
      const record = asRecord(column);
      const fieldName = readString(record ?? {}, ["fieldName", "field_name", "name"]);
      if (fieldName) keys.add(fieldName);
    }
  }

  const find = (...candidates: string[]) =>
    candidates.find((candidate) => keys.has(candidate)) ??
    [...keys].find((key) =>
      candidates.some((candidate) => key.toLowerCase().includes(candidate.toLowerCase()))
    );

  return {
    id: find(":id", "id", "objectid", "permit", "event_id"),
    street: find("street", "location", "block", "closure_location", "locationdesc"),
    type: find("closure_type", "type", "event_type", "reason", "description"),
    start: find("start_date", "starttime", "start_time", "start"),
    end: find("end_date", "endtime", "end_time", "end"),
    updated: find(":updated_at", "updated_at", "last_updated", "modified"),
    latitude: find("latitude", "lat", "y"),
    longitude: find("longitude", "lon", "lng", "x")
  };
}

export function normalizeDataSfClosure(
  value: unknown,
  fieldMap: DataSfFieldMap,
  ingestedAt = new Date()
): NormalizedRoadEvent | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const readMappedString = (key: keyof DataSfFieldMap) => {
    const field = fieldMap[key];
    return field ? readString(record, [field]) : undefined;
  };
  const readMappedDate = (key: keyof DataSfFieldMap) => {
    const field = fieldMap[key];
    return field ? readDate(record, [field]) : undefined;
  };
  const readMappedNumber = (key: keyof DataSfFieldMap) => {
    const field = fieldMap[key];
    return field ? readNumber(record, [field]) : undefined;
  };

  const typeText = readMappedString("type") ?? "";
  const title = readMappedString("street") ?? "San Francisco temporary street closure";
  const sourceUpdatedAt = readMappedDate("updated");
  const startTime = readMappedDate("start");
  const endTime = readMappedDate("end");

  return {
    source: SOURCE,
    externalId: readMappedString("id"),
    sourceUrl: SOURCE_URL,
    eventType: classifyDataSfType(typeText),
    title,
    description: typeText || title,
    roadName: title,
    severity: severityForDataSf(typeText),
    declaredState: inferDataSfDeclaredState(typeText, startTime, endTime, ingestedAt),
    latitude: readMappedNumber("latitude"),
    longitude: readMappedNumber("longitude"),
    startTime,
    endTime,
    sourceUpdatedAt,
    firstSeenAt: ingestedAt,
    lastSeenAt: ingestedAt,
    ingestedAt,
    freshnessSeconds: calculateFreshnessSeconds(sourceUpdatedAt, ingestedAt),
    rawPayload: record,
    metadata: {
      fieldMap,
      sourceSemantics: "absence_is_unknown_not_open"
    }
  };
}

function classifyDataSfType(text: string): RoadEventType {
  const lower = text.toLowerCase();
  if (lower.includes("detour")) return "detour";
  if (lower.includes("lane")) return "lane_closure";
  if (lower.includes("construction") || lower.includes("work")) return "construction";
  if (lower.includes("event")) return "special_event";
  return "closure";
}

function inferDataSfDeclaredState(
  text: string,
  startTime: Date | undefined,
  endTime: Date | undefined,
  now: Date
): DeclaredRoadState {
  const lower = text.toLowerCase();
  if (startTime && startTime > now) return "planned";
  if (endTime && endTime < now) return "unknown";
  if (lower.includes("lane")) return "partially_closed";
  if (lower.includes("detour") || lower.includes("restricted")) return "restricted";
  return "closed";
}

function severityForDataSf(text: string): number {
  const lower = text.toLowerCase();
  if (lower.includes("full") || lower.includes("street closure")) return 4;
  if (lower.includes("lane")) return 3;
  return 2;
}
