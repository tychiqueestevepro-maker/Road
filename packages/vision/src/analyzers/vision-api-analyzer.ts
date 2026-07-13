import type { DetectedObject, VisionAnalysisResult, VisualAnalyzer } from "./types.js";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_VISION_MODEL = "gpt-5.6-luna";
const ALLOWED_STATES = new Set([
  "normal",
  "blocked",
  "possibly_blocked",
  "low_flow",
  "congested",
  "obstruction",
  "vehicles_stopped",
  "unknown"
]);

export class VisionApiAnalyzer implements VisualAnalyzer {
  analyzerName = "external_openai_vision";

  constructor(
    private readonly options: {
      apiKey?: string;
      model?: string;
      timeoutMs?: number;
    }
  ) {}

  async analyze(input: {
    image: Uint8Array;
    mimeType: string;
    metadata?: Record<string, unknown>;
  }): Promise<VisionAnalysisResult> {
    if (!this.options.apiKey) {
      return unknownResult("VISION_API_KEY is not configured", input);
    }

    const model = this.options.model?.trim() || DEFAULT_OPENAI_VISION_MODEL;
    const base64Image = Buffer.from(input.image).toString("base64");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 20000);

    try {
      const response = await fetch(OPENAI_RESPONSES_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model,
          max_output_tokens: 900,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: buildPrompt(input.metadata)
                },
                {
                  type: "input_image",
                  image_url: `data:${input.mimeType};base64,${base64Image}`,
                  detail: "low"
                }
              ]
            }
          ]
        })
      });

      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) {
        const message = readApiError(payload) ?? `OpenAI vision API HTTP ${response.status}`;
        throw new Error(message);
      }

      const text = extractOutputText(payload);
      if (!text) {
        throw new Error("OpenAI vision API returned no output text");
      }

      return normalizeVisionResult(parseJsonText(text), {
        analyzer: this.analyzerName,
        model,
        metadata: input.metadata ?? {}
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return unknownResult(message, input, {
        analyzer: this.analyzerName,
        model
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

function buildPrompt(metadata?: Record<string, unknown>) {
  return [
    "Analyze this single frame from a road traffic camera.",
    "Return only valid JSON with this exact shape:",
    JSON.stringify({
      objects: [{ label: "car", confidence: 0.8, bbox: [0, 0, 10, 10] }],
      counts: { car: 1, truck: 0, bus: 0, motorcycle: 0, person: 0, barrier: 0 },
      metrics: {
        vehicle_count: 1,
        person_count: 0,
        barrier_count: 0,
        obstruction_score: 0
      },
      interpretation: {
        observed_state: "normal",
        confidence: 0.7,
        evidence: { reason: "short explanation" }
      }
    }),
    "Allowed observed_state values: normal, blocked, possibly_blocked, low_flow, congested, obstruction, vehicles_stopped, unknown.",
    "Use low_flow when the roadway is visible but there are very few or no vehicles.",
    "Use possibly_blocked or blocked only when barriers, closures, stopped vehicles, or clear obstructions are visible.",
    `Metadata: ${JSON.stringify(metadata ?? {})}`
  ].join("\n");
}

function parseJsonText(text: string) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("OpenAI vision output was not valid JSON");
  }
}

function normalizeVisionResult(
  value: unknown,
  evidenceBase: Record<string, unknown>
): VisionAnalysisResult {
  const record = asRecord(value);
  const objects = normalizeObjects(record.objects);
  const counts = normalizeCounts(record.counts, objects);
  const metrics = normalizeMetrics(record.metrics, counts);
  const interpretation = asRecord(record.interpretation);
  const observedState =
    typeof interpretation.observed_state === "string" &&
    ALLOWED_STATES.has(interpretation.observed_state)
      ? interpretation.observed_state
      : "unknown";

  return {
    objects,
    counts,
    metrics,
    interpretation: {
      observed_state: observedState as VisionAnalysisResult["interpretation"]["observed_state"],
      confidence: clamp01(readNumber(interpretation.confidence, 0)),
      evidence: {
        ...evidenceBase,
        ...(asRecord(interpretation.evidence) ?? {})
      }
    }
  };
}

function normalizeObjects(value: unknown): DetectedObject[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = asRecord(item);
      const bbox = Array.isArray(record.bbox) ? record.bbox.map(Number) : [];
      if (typeof record.label !== "string" || bbox.length !== 4) return null;
      return {
        label: record.label,
        confidence: clamp01(readNumber(record.confidence, 0)),
        bbox: [bbox[0] ?? 0, bbox[1] ?? 0, bbox[2] ?? 0, bbox[3] ?? 0] as [
          number,
          number,
          number,
          number
        ]
      };
    })
    .filter((item): item is DetectedObject => Boolean(item));
}

function normalizeCounts(value: unknown, objects: DetectedObject[]) {
  const counts: Record<string, number> = {};
  const source = asRecord(value);
  for (const [key, rawValue] of Object.entries(source)) {
    const count = Number(rawValue);
    if (Number.isFinite(count)) counts[key] = Math.max(0, Math.round(count));
  }
  if (Object.keys(counts).length > 0) return counts;

  for (const object of objects) {
    counts[object.label] = (counts[object.label] ?? 0) + 1;
  }
  return counts;
}

function normalizeMetrics(value: unknown, counts: Record<string, number>) {
  const record = asRecord(value);
  const explicitVehicleCount = readNumber(record.vehicle_count, NaN);
  const vehicleCount = Number.isFinite(explicitVehicleCount)
    ? explicitVehicleCount
    : (counts.car ?? 0) +
      (counts.truck ?? 0) +
      (counts.bus ?? 0) +
      (counts.motorcycle ?? 0);
  return {
    vehicle_count: Math.max(0, Math.round(vehicleCount)),
    person_count: Math.max(0, Math.round(readNumber(record.person_count, counts.person ?? 0))),
    barrier_count: Math.max(0, Math.round(readNumber(record.barrier_count, counts.barrier ?? 0))),
    obstruction_score: clamp01(readNumber(record.obstruction_score, 0))
  };
}

function unknownResult(
  reason: string,
  input: { image: Uint8Array; mimeType: string; metadata?: Record<string, unknown> },
  extra: Record<string, unknown> = {}
): VisionAnalysisResult {
  return {
    objects: [],
    counts: {},
    metrics: { vehicle_count: 0, person_count: 0 },
    interpretation: {
      observed_state: "unknown",
      confidence: 0,
      evidence: {
        analyzer: "external_openai_vision",
        reason,
        bytes: input.image.byteLength,
        mimeType: input.mimeType,
        metadata: input.metadata ?? {},
        ...extra
      }
    }
  };
}

function extractOutputText(payload: Record<string, unknown>): string | undefined {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = payload.output;
  if (!Array.isArray(output)) return undefined;

  const parts: string[] = [];
  for (const item of output) {
    const content = asRecord(item).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const record = asRecord(part);
      if (typeof record.text === "string") parts.push(record.text);
    }
  }
  return parts.join("\n").trim() || undefined;
}

function readApiError(payload: Record<string, unknown>) {
  const error = asRecord(payload.error);
  return typeof error.message === "string" ? error.message : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
