export interface FetchJsonOptions {
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
}

export async function fetchJsonWithRetry<T = unknown>(
  url: URL | string,
  options: FetchJsonOptions = {}
): Promise<{ body: T; rawText: string; status: number; contentType: string | null }> {
  const timeoutMs = options.timeoutMs ?? 10000;
  const retries = options.retries ?? 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: {
          accept: "application/json",
          ...options.headers
        },
        signal: controller.signal
      });
      const rawText = await response.text();

      if (!response.ok) {
        if (response.status >= 500 && attempt < retries) {
          lastError = new Error(`temporary HTTP ${response.status}`);
          await backoff(attempt);
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${rawText.slice(0, 300)}`);
      }

      let body: unknown;
      try {
        body = JSON.parse(rawText);
      } catch {
        body = rawText;
      }

      return {
        body: body as T,
        rawText,
        status: response.status,
        contentType: response.headers.get("content-type")
      };
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      await backoff(attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function backoff(attempt: number) {
  await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (!record) return [];

  for (const key of [
    "events",
    "Events",
    "road_events",
    "features",
    "data",
    "items",
    "records"
  ]) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }

  return [value];
}

export function readString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

export function readNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

export function readDate(record: Record<string, unknown>, keys: string[]): Date | undefined {
  for (const key of keys) {
    const value = record[key];
    if (value instanceof Date) return value;
    if (typeof value === "string" || typeof value === "number") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.valueOf())) return parsed;
    }
  }
  return undefined;
}

export function calculateFreshnessSeconds(sourceUpdatedAt: Date | undefined, now = new Date()) {
  if (!sourceUpdatedAt) return undefined;
  return Math.max(0, Math.round((now.valueOf() - sourceUpdatedAt.valueOf()) / 1000));
}

