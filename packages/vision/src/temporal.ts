import type { NormalizedRoadObservation } from "@road-reality/shared";

export interface TemporalCameraSignal {
  observedState: NormalizedRoadObservation["observedState"];
  confidence: number;
  evidence: Record<string, unknown>;
}

export function analyzeTemporalCameraSequence(
  observations: NormalizedRoadObservation[]
): TemporalCameraSignal {
  const sorted = [...observations].sort(
    (left, right) => left.observedAt.valueOf() - right.observedAt.valueOf()
  );
  const recent = sorted.slice(-5);
  const vehicleCounts = recent
    .map((item) => Number(item.evidence.vehicle_count ?? item.evidence.vehicleCount))
    .filter((count) => Number.isFinite(count));
  const barrierCount = recent.filter((item) => item.evidence.barrier_detected).length;
  const blockedCount = recent.filter((item) =>
    ["blocked", "possibly_blocked", "obstruction", "vehicles_stopped", "low_flow"].includes(
      item.observedState
    )
  ).length;

  if (recent.length >= 4 && (barrierCount >= 1 || blockedCount >= 3)) {
    return {
      observedState: "possibly_blocked",
      confidence: 0.78,
      evidence: {
        temporal_signal: "persistent_flow_interruption",
        persistent_flow_interruption: true,
        observations_evaluated: recent.length,
        vehicle_counts: vehicleCounts
      }
    };
  }

  if (vehicleCounts.length >= 3) {
    const first = vehicleCounts[0] ?? 0;
    const last = vehicleCounts[vehicleCounts.length - 1] ?? 0;
    if (first >= 4 && last <= 1) {
      return {
        observedState: "low_flow",
        confidence: 0.7,
        evidence: {
          temporal_signal: "vehicle_count_drop",
          vehicle_counts: vehicleCounts
        }
      };
    }
  }

  return {
    observedState: "unknown",
    confidence: 0.2,
    evidence: {
      temporal_signal: "insufficient_temporal_evidence",
      observations_evaluated: recent.length
    }
  };
}

