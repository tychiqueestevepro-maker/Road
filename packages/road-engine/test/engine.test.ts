import { describe, expect, it } from "vitest";
import type { NormalizedRoadEvent, NormalizedRoadObservation } from "@road-reality/shared";
import { evaluateRoadState } from "../src/engine.js";
import { recordsSpatiallyMatch } from "../src/spatial.js";

const now = new Date("2026-07-13T10:34:00Z");
const location = {
  roadName: "Halleck Street",
  latitude: 37.80128,
  longitude: -122.45582
};

function event(
  declaredState: NormalizedRoadEvent["declaredState"],
  overrides: Partial<NormalizedRoadEvent> = {}
): NormalizedRoadEvent {
  return {
    source: "official_source",
    externalId: `event-${declaredState}`,
    eventType: declaredState === "open" ? "unknown" : "closure",
    declaredState,
    ingestedAt: now,
    sourceUpdatedAt: now,
    rawPayload: {},
    ...location,
    ...overrides
  };
}

function observation(
  observedState: NormalizedRoadObservation["observedState"],
  offsetSeconds: number,
  evidence: Record<string, unknown> = {},
  overrides: Partial<NormalizedRoadObservation> = {}
): NormalizedRoadObservation {
  const observedAt = new Date(now.valueOf() + offsetSeconds * 1000);
  return {
    source: "camera",
    observationType: "visual",
    observedState,
    confidence: 0.8,
    evidence,
    observedAt,
    ...location,
    ...overrides
  };
}

describe("road verification engine", () => {
  it("treats absence of a closure as UNKNOWN, not OPEN", () => {
    const results = evaluateRoadState({
      events: [],
      observations: [
        observation("low_flow", -120),
        observation("obstruction", -60, { barrier_detected: true }),
        observation("possibly_blocked", 0, {
          persistent_flow_interruption: true,
          temporal_signal: "persistent_flow_interruption"
        })
      ],
      now
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.type).toBe("possible_unreported_closure");
    expect(results[0]?.declaredState).toBe("unknown");
  });

  it("does not create a high-confidence discrepancy from unknown state plus one weak observation", () => {
    const results = evaluateRoadState({
      events: [],
      observations: [observation("possibly_blocked", 0, { model_interpretation: true })],
      now
    });

    expect(results).toHaveLength(0);
  });

  it("creates possible_unreported_closure from repeated interruption plus barrier evidence", () => {
    const results = evaluateRoadState({
      events: [],
      observations: [
        observation("low_flow", -120),
        observation("obstruction", -60, { barrier_detected: true }),
        observation("possibly_blocked", 0, {
          temporal_signal: "persistent_flow_interruption",
          persistent_flow_interruption: true
        })
      ],
      now
    });

    expect(results[0]?.type).toBe("possible_unreported_closure");
    expect(results[0]?.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("creates declared_open_observed_blocked for explicit open state plus blockage", () => {
    const results = evaluateRoadState({
      events: [event("open")],
      observations: [
        observation("obstruction", -60, { barrier_detected: true }),
        observation("possibly_blocked", 0, {
          persistent_flow_interruption: true,
          temporal_signal: "persistent_flow_interruption"
        })
      ],
      now
    });

    expect(results[0]?.type).toBe("declared_open_observed_blocked");
  });

  it("reduces stale visual evidence weight", () => {
    const fresh = evaluateRoadState({
      events: [],
      observations: [
        observation("low_flow", -30),
        observation("obstruction", -20, { barrier_detected: true }),
        observation("possibly_blocked", -10, {
          persistent_flow_interruption: true,
          temporal_signal: "persistent_flow_interruption"
        })
      ],
      now
    });
    const stale = evaluateRoadState({
      events: [],
      observations: [
        observation("low_flow", -1000),
        observation("obstruction", -900, { barrier_detected: true }),
        observation("possibly_blocked", -800, {
          persistent_flow_interruption: true,
          temporal_signal: "persistent_flow_interruption"
        })
      ],
      now
    });

    expect((stale[0]?.confidence ?? 0)).toBeLessThan(fresh[0]?.confidence ?? 1);
  });

  it("does not match spatially distant records", () => {
    const results = evaluateRoadState({
      events: [
        event("open", {
          roadName: "Market Street",
          latitude: 37.7749,
          longitude: -122.4194
        })
      ],
      observations: [
        observation("obstruction", -30, { barrier_detected: true }),
        observation("possibly_blocked", 0, {
          persistent_flow_interruption: true,
          temporal_signal: "persistent_flow_interruption"
        })
      ],
      now
    });

    expect(results.some((result) => result.type === "declared_open_observed_blocked")).toBe(false);
  });

  it("matches nearby records using the spatial abstraction", () => {
    expect(
      recordsSpatiallyMatch(
        { roadName: "Halleck St", latitude: 37.80128, longitude: -122.45582 },
        { roadName: "Halleck Street", latitude: 37.80131, longitude: -122.45579 },
        100
      )
    ).toBe(true);
  });

  it("does not create source_conflict from source absence", () => {
    const results = evaluateRoadState({
      events: [event("closed", { source: "sf511_wzdx" })],
      observations: [],
      now
    });

    expect(results.some((result) => result.type === "source_conflict")).toBe(false);
  });
});

