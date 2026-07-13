import { freshnessMultiplier } from "./freshness.js";

export type EvidenceSignal =
  | "fresh_official_explicit_closure"
  | "fresh_explicit_declared_open"
  | "fresh_visual_barrier_detection"
  | "repeated_visual_blockage_observations"
  | "persistent_flow_interruption"
  | "single_visual_model_interpretation"
  | "stale_source_record"
  | "normal_usage_repeated"
  | "explicit_source_conflict";

export interface EvidenceFactor {
  source: string;
  signal: EvidenceSignal;
  weight: number;
  freshnessMultiplier: number;
  description: string;
  observedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface EvidenceScore {
  score: number;
  factors: EvidenceFactor[];
  explanation: string[];
}

export const evidenceWeights: Record<EvidenceSignal, number> = {
  fresh_official_explicit_closure: 1,
  fresh_explicit_declared_open: 0.9,
  fresh_visual_barrier_detection: 0.75,
  repeated_visual_blockage_observations: 0.85,
  persistent_flow_interruption: 0.7,
  single_visual_model_interpretation: 0.5,
  stale_source_record: 0.35,
  normal_usage_repeated: 0.8,
  explicit_source_conflict: 0.8
};

export function factor(
  input: Omit<EvidenceFactor, "weight" | "freshnessMultiplier"> & {
    staleAfterSeconds: number;
    now: Date;
  }
): EvidenceFactor {
  return {
    source: input.source,
    signal: input.signal,
    weight: evidenceWeights[input.signal],
    freshnessMultiplier: freshnessMultiplier(
      input.observedAt,
      input.staleAfterSeconds,
      input.now
    ),
    description: input.description,
    observedAt: input.observedAt,
    metadata: input.metadata
  };
}

export function scoreEvidence(factors: EvidenceFactor[]): EvidenceScore {
  const adjusted = factors.map((item) =>
    Math.max(0, Math.min(1, item.weight * item.freshnessMultiplier))
  );
  const combined = adjusted.reduce((score, item) => 1 - (1 - score) * (1 - item), 0);
  const sourceCount = new Set(factors.map((item) => item.source)).size;
  const independenceBonus = sourceCount > 1 && factors.length > 1 ? 0.04 : 0;
  const score = clamp(combined + independenceBonus);

  return {
    score,
    factors,
    explanation: factors.map((item) => item.description)
  };
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

