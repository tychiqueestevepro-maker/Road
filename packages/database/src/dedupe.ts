import { createHash } from "node:crypto";

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function hashPayload(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function buildRawRecordHash(externalId: string | undefined, payload: unknown): string {
  return hashPayload({
    externalId: externalId ?? null,
    payload
  });
}

export function shouldAnalyzeSnapshot(
  existingHash: string | undefined,
  incomingHash: string
): boolean {
  return existingHash !== incomingHash;
}

