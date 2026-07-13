import type {
  ConnectorHealth,
  NormalizedRoadEvent,
  RawSourceResult,
  RoadDataConnector
} from "@road-reality/shared";
import { asArray, asRecord, fetchJsonWithRetry } from "../http.js";
import { inferDataSfFieldMap, normalizeDataSfClosure } from "./mappers.js";

const SOURCE = "datasf_temporary_closures";
const RESOURCE_URL = "https://data.sfgov.org/resource/8x25-yybr.json";
const METADATA_URL = "https://data.sfgov.org/api/views/8x25-yybr";

export class DataSfTemporaryClosuresConnector implements RoadDataConnector {
  sourceName = SOURCE;
  sourceType = "declared_state";

  constructor(private readonly options: { appToken?: string; timeoutMs?: number } = {}) {}

  async fetch(): Promise<RawSourceResult> {
    const headers = this.headers();
    const metadataResponse = await fetchJsonWithRetry(METADATA_URL, {
      headers,
      timeoutMs: this.options.timeoutMs ?? 10000,
      retries: 1
    });
    const metadata = metadataResponse.body;
    const url = new URL(RESOURCE_URL);
    for (const [key, value] of Object.entries(buildSoqlParams(metadata))) {
      url.searchParams.set(key, value);
    }

    const fetchedAt = new Date();
    const response = await fetchJsonWithRetry(url, {
      headers,
      timeoutMs: this.options.timeoutMs ?? 10000,
      retries: 2
    });
    const records = asArray(response.body);

    return {
      source: SOURCE,
      sourceType: this.sourceType,
      fetchedAt,
      url: RESOURCE_URL,
      records,
      raw: response.body,
      metadata: {
        dataset: "8x25-yybr",
        fieldNames: records[0] ? Object.keys(asRecord(records[0]) ?? {}) : [],
        metadata,
        query: Object.fromEntries(url.searchParams.entries()),
        contentType: response.contentType,
        status: response.status
      }
    };
  }

  async normalize(result: RawSourceResult): Promise<NormalizedRoadEvent[]> {
    const ingestedAt = new Date();
    const fieldMap = inferDataSfFieldMap(result.records, result.metadata?.metadata);
    return result.records
      .map((record) => normalizeDataSfClosure(record, fieldMap, ingestedAt))
      .filter((event): event is NormalizedRoadEvent => Boolean(event));
  }

  async healthCheck(): Promise<ConnectorHealth> {
    const start = performance.now();
    try {
      await this.fetch();
      return {
        source: SOURCE,
        ok: true,
        status: "online",
        checkedAt: new Date(),
        latencyMs: Math.round(performance.now() - start)
      };
    } catch (error) {
      return {
        source: SOURCE,
        ok: false,
        status: "degraded",
        checkedAt: new Date(),
        latencyMs: Math.round(performance.now() - start),
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private headers() {
    const appToken = this.options.appToken ?? process.env.SOCRATA_APP_TOKEN;
    return appToken ? { "X-App-Token": appToken } : undefined;
  }
}

function buildSoqlParams(metadata: unknown): Record<string, string> {
  const columns = asRecord(metadata)?.columns;
  const fieldNames = Array.isArray(columns)
    ? columns
        .map((column) => asRecord(column))
        .map((column) => column?.fieldName ?? column?.field_name ?? column?.name)
        .filter((field): field is string => typeof field === "string")
    : [];

  const start = findField(fieldNames, ["start_date", "starttime", "start_time", "start"]);
  const end = findField(fieldNames, ["end_date", "endtime", "end_time", "end"]);
  const today = new Date().toISOString().slice(0, 10);
  const params: Record<string, string> = {
    "$limit": "500"
  };

  if (start && end) {
    params["$where"] =
      `(${start} <= '${today}T23:59:59' AND ${end} >= '${today}T00:00:00') ` +
      `OR ${start} >= '${today}T00:00:00'`;
    params["$order"] = `${start} ASC`;
  }

  return params;
}

function findField(fields: string[], candidates: string[]) {
  return (
    candidates.find((candidate) => fields.includes(candidate)) ??
    fields.find((field) =>
      candidates.some((candidate) => field.toLowerCase().includes(candidate.toLowerCase()))
    )
  );
}

