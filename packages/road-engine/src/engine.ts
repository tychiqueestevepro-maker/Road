import type {
  DeclaredRoadState,
  DiscrepancyType,
  NormalizedRoadEvent,
  NormalizedRoadObservation,
  ObservedRoadState
} from "@road-reality/shared";
import type { RoadEngineConfig } from "@road-reality/config/road-engine";
import { defaultRoadEngineConfig } from "@road-reality/config/road-engine";
import { factor, scoreEvidence, type EvidenceFactor } from "./confidence.js";
import { recordsSpatiallyMatch } from "./spatial.js";

export interface EngineRoadEvent extends NormalizedRoadEvent {
  id?: string;
  sourceId?: string;
}

export interface EngineRoadObservation extends NormalizedRoadObservation {
  id?: string;
}

export interface EvaluatedDiscrepancy {
  type: DiscrepancyType;
  status: "active" | "monitoring";
  declaredState: DeclaredRoadState;
  observedState: ObservedRoadState;
  confidence: number;
  evidenceScore: ReturnType<typeof scoreEvidence>;
  severity: number;
  title: string;
  summary: string;
  explanation: string[];
  roadName?: string;
  latitude?: number;
  longitude?: number;
  firstDetectedAt: Date;
  lastDetectedAt: Date;
  eventIds: string[];
  observationIds: string[];
}

export interface EvaluateRoadStateInput {
  events: EngineRoadEvent[];
  observations: EngineRoadObservation[];
  now?: Date;
  config?: Partial<RoadEngineConfig>;
}

export function evaluateRoadState(input: EvaluateRoadStateInput): EvaluatedDiscrepancy[] {
  const now = input.now ?? new Date();
  const config: RoadEngineConfig = {
    ...defaultRoadEngineConfig,
    ...input.config
  };
  const results: EvaluatedDiscrepancy[] = [];

  results.push(...evaluateSourceConflicts(input.events, now, config));
  results.push(...evaluateStaleDeclaredEvents(input.events, now, config));

  const observationGroups = groupObservations(input.observations, config.matchRadiusMeters);
  for (const group of observationGroups) {
    const nearbyEvents = input.events.filter((event) =>
      recordsSpatiallyMatch(event, group.anchor, config.matchRadiusMeters)
    );
    const activeClosedEvents = nearbyEvents.filter((event) =>
      isActiveDeclaredClosure(event, now)
    );
    const explicitOpenEvents = nearbyEvents.filter((event) => isActiveDeclaredOpen(event, now));
    const blockedSignals = buildBlockedEvidence(group.items, now, config);
    const normalSignals = buildNormalEvidence(group.items, now, config);

    if (explicitOpenEvents.length > 0 && blockedSignals.length > 0) {
      const score = scoreEvidence([
        factor({
          source: "declared_state_feed",
          signal: "fresh_explicit_declared_open",
          staleAfterSeconds: config.trafficObservationStaleSeconds,
          observedAt: explicitOpenEvents[0]?.sourceUpdatedAt ?? explicitOpenEvents[0]?.lastSeenAt,
          now,
          description: "An official source explicitly declares the road open."
        }),
        ...blockedSignals
      ]);
      if (score.score >= config.discrepancyMinScore) {
        results.push(
          makeDiscrepancy({
            type: "declared_open_observed_blocked",
            declaredState: "open",
            observedState: strongestObservedState(group.items),
            score,
            severity: 5,
            title: "Observed road state conflicts with declared open state",
            summary: "Observed blockage conflicts with an explicit declared open state.",
            baseExplanation: [
              "A configured declared-state source explicitly reports the road open.",
              "Fresh observed evidence suggests the road may be blocked."
            ],
            events: explicitOpenEvents,
            observations: group.items,
            now
          })
        );
      }
    }

    if (activeClosedEvents.length > 0 && normalSignals.length > 0) {
      const score = scoreEvidence([
        factor({
          source: "declared_state_feed",
          signal: "fresh_official_explicit_closure",
          staleAfterSeconds: config.trafficObservationStaleSeconds,
          observedAt: activeClosedEvents[0]?.sourceUpdatedAt ?? activeClosedEvents[0]?.lastSeenAt,
          now,
          description: "An official source explicitly declares a closure or restriction."
        }),
        ...normalSignals
      ]);
      if (score.score >= config.discrepancyMinScore) {
        results.push(
          makeDiscrepancy({
            type: "declared_closed_observed_normal",
            declaredState: "closed",
            observedState: "normal",
            score,
            severity: 4,
            title: "Declared closure may no longer match observed usage",
            summary: "Repeated fresh observations suggest normal road usage near an active closure.",
            baseExplanation: [
              "A configured declared-state source reports a closure or restriction.",
              "Fresh repeated observations suggest normal road usage."
            ],
            events: activeClosedEvents,
            observations: group.items,
            now
          })
        );
      }
    }

    if (activeClosedEvents.length === 0 && explicitOpenEvents.length === 0) {
      const independentSignals = new Set(blockedSignals.map((item) => item.signal));
      if (blockedSignals.length >= 2 && independentSignals.size >= 2) {
        const score = scoreEvidence(blockedSignals);
        if (score.score >= config.discrepancyMinScore) {
          results.push(
            makeDiscrepancy({
              type: "possible_unreported_closure",
              declaredState: "unknown",
              observedState: strongestObservedState(group.items),
              score,
              severity: 4,
              title: "Possible information gap detected",
              summary: "Possible unreported road closure",
              baseExplanation: [
                `No active closure was found in configured declared-state feeds within ${config.matchRadiusMeters} meters.`,
                "Fresh observed evidence suggests the road may be blocked."
              ],
              events: nearbyEvents,
              observations: group.items,
              now
            })
          );
        }
      }
    }
  }

  return dedupeDiscrepancies(results);
}

function groupObservations(
  observations: EngineRoadObservation[],
  radiusMeters: number
): Array<{ anchor: EngineRoadObservation; items: EngineRoadObservation[] }> {
  const groups: Array<{ anchor: EngineRoadObservation; items: EngineRoadObservation[] }> = [];
  for (const observation of observations) {
    const group = groups.find((candidate) =>
      recordsSpatiallyMatch(candidate.anchor, observation, radiusMeters)
    );
    if (group) {
      group.items.push(observation);
    } else {
      groups.push({ anchor: observation, items: [observation] });
    }
  }
  return groups;
}

function isActiveByTime(event: EngineRoadEvent, now: Date): boolean {
  if (event.startTime && event.startTime > now) return false;
  if (event.endTime && event.endTime < now) return false;
  return true;
}

function isActiveDeclaredClosure(event: EngineRoadEvent, now: Date): boolean {
  return (
    isActiveByTime(event, now) &&
    ["closed", "partially_closed", "restricted"].includes(event.declaredState)
  );
}

function isActiveDeclaredOpen(event: EngineRoadEvent, now: Date): boolean {
  return isActiveByTime(event, now) && event.declaredState === "open";
}

function buildBlockedEvidence(
  observations: EngineRoadObservation[],
  now: Date,
  config: RoadEngineConfig
): EvidenceFactor[] {
  const factors: EvidenceFactor[] = [];
  const blockedObservations = observations.filter((observation) =>
    ["blocked", "possibly_blocked", "obstruction", "vehicles_stopped", "low_flow"].includes(
      observation.observedState
    )
  );

  const barrier = blockedObservations.find((observation) =>
    Boolean(observation.evidence?.barrier_detected ?? observation.evidence?.barrierVisible)
  );
  if (barrier) {
    factors.push(
      factor({
        source: barrier.source,
        signal: "fresh_visual_barrier_detection",
        staleAfterSeconds: config.cameraObservationStaleSeconds,
        observedAt: barrier.observedAt,
        now,
        description: "A possible road barrier was detected.",
        metadata: barrier.evidence
      })
    );
  }

  const persistent = blockedObservations.find((observation) =>
    Boolean(
      observation.evidence?.persistent_flow_interruption ??
        observation.evidence?.temporal_signal === "persistent_flow_interruption"
    )
  );
  if (persistent) {
    factors.push(
      factor({
        source: persistent.source,
        signal: "persistent_flow_interruption",
        staleAfterSeconds: config.trafficObservationStaleSeconds,
        observedAt: persistent.observedAt,
        now,
        description: "Traffic activity remained abnormally low across recent observations.",
        metadata: persistent.evidence
      })
    );
  }

  if (blockedObservations.length >= 3) {
    factors.push(
      factor({
        source: "camera_temporal_analysis",
        signal: "repeated_visual_blockage_observations",
        staleAfterSeconds: config.cameraObservationStaleSeconds,
        observedAt: newestObservation(blockedObservations)?.observedAt,
        now,
        description: "Repeated visual observations suggest persistent blockage.",
        metadata: { observation_count: blockedObservations.length }
      })
    );
  } else if (blockedObservations.length === 1 && factors.length === 0) {
    const observation = blockedObservations[0];
    if (!observation) return factors;
    factors.push(
      factor({
        source: observation.source,
        signal: "single_visual_model_interpretation",
        staleAfterSeconds: config.cameraObservationStaleSeconds,
        observedAt: observation.observedAt,
        now,
        description: "A single visual interpretation suggests possible blockage.",
        metadata: observation.evidence
      })
    );
  }

  return factors;
}

function buildNormalEvidence(
  observations: EngineRoadObservation[],
  now: Date,
  config: RoadEngineConfig
): EvidenceFactor[] {
  const normal = observations.filter((observation) => observation.observedState === "normal");
  if (normal.length < 2) return [];

  return [
    factor({
      source: "camera_temporal_analysis",
      signal: "normal_usage_repeated",
      staleAfterSeconds: config.cameraObservationStaleSeconds,
      observedAt: newestObservation(normal)?.observedAt,
      now,
      description: "Repeated fresh observations suggest normal road usage.",
      metadata: { observation_count: normal.length }
    })
  ];
}

function strongestObservedState(observations: EngineRoadObservation[]): ObservedRoadState {
  const priority: ObservedRoadState[] = [
    "blocked",
    "possibly_blocked",
    "obstruction",
    "vehicles_stopped",
    "low_flow",
    "congested",
    "normal",
    "unknown"
  ];
  return (
    priority.find((state) => observations.some((item) => item.observedState === state)) ??
    "unknown"
  );
}

function newestObservation(observations: EngineRoadObservation[]) {
  return [...observations].sort(
    (left, right) => right.observedAt.valueOf() - left.observedAt.valueOf()
  )[0];
}

function makeDiscrepancy(input: {
  type: DiscrepancyType;
  declaredState: DeclaredRoadState;
  observedState: ObservedRoadState;
  score: ReturnType<typeof scoreEvidence>;
  severity: number;
  title: string;
  summary: string;
  baseExplanation: string[];
  events: EngineRoadEvent[];
  observations: EngineRoadObservation[];
  now: Date;
}): EvaluatedDiscrepancy {
  const anchor = input.observations[0] ?? input.events[0];
  const allTimes = input.observations.map((item) => item.observedAt);
  return {
    type: input.type,
    status: "active",
    declaredState: input.declaredState,
    observedState: input.observedState,
    confidence: input.score.score,
    evidenceScore: input.score,
    severity: input.severity,
    title: input.title,
    summary: input.summary,
    explanation: [...input.baseExplanation, ...input.score.explanation],
    roadName: anchor?.roadName,
    latitude: anchor?.latitude,
    longitude: anchor?.longitude,
    firstDetectedAt:
      allTimes.length > 0
        ? new Date(Math.min(...allTimes.map((item) => item.valueOf())))
        : input.now,
    lastDetectedAt:
      allTimes.length > 0
        ? new Date(Math.max(...allTimes.map((item) => item.valueOf())))
        : input.now,
    eventIds: input.events.map((event) => event.id).filter((id): id is string => Boolean(id)),
    observationIds: input.observations
      .map((observation) => observation.id)
      .filter((id): id is string => Boolean(id))
  };
}

function evaluateSourceConflicts(
  events: EngineRoadEvent[],
  now: Date,
  config: RoadEngineConfig
): EvaluatedDiscrepancy[] {
  const results: EvaluatedDiscrepancy[] = [];
  for (const event of events) {
    const conflicting = events.find(
      (candidate) =>
        candidate !== event &&
        candidate.source !== event.source &&
        recordsSpatiallyMatch(candidate, event, config.matchRadiusMeters) &&
        isActiveByTime(candidate, now) &&
        isExplicitConflict(event.declaredState, candidate.declaredState)
    );
    if (!conflicting) continue;

    const score = scoreEvidence([
      factor({
        source: event.source,
        signal: "explicit_source_conflict",
        staleAfterSeconds: config.trafficObservationStaleSeconds,
        observedAt: event.sourceUpdatedAt ?? event.lastSeenAt,
        now,
        description: `${event.source} explicitly reports ${event.declaredState}.`
      }),
      factor({
        source: conflicting.source,
        signal: "explicit_source_conflict",
        staleAfterSeconds: config.trafficObservationStaleSeconds,
        observedAt: conflicting.sourceUpdatedAt ?? conflicting.lastSeenAt,
        now,
        description: `${conflicting.source} explicitly reports ${conflicting.declaredState}.`
      })
    ]);

    results.push(
      makeDiscrepancy({
        type: "source_conflict",
        declaredState: event.declaredState,
        observedState: "unknown",
        score,
        severity: 3,
        title: "Official road sources conflict",
        summary: "Two configured official sources make explicit conflicting road-state assertions.",
        baseExplanation: [
          "Official source conflict is only created for explicit assertions, not source absence."
        ],
        events: [event, conflicting],
        observations: [],
        now
      })
    );
  }
  return results;
}

function isExplicitConflict(left: DeclaredRoadState, right: DeclaredRoadState) {
  if (left === "unknown" || right === "unknown") return false;
  const closureLike = new Set(["closed", "partially_closed", "restricted"]);
  return (left === "open" && closureLike.has(right)) || (right === "open" && closureLike.has(left));
}

function evaluateStaleDeclaredEvents(
  events: EngineRoadEvent[],
  now: Date,
  config: RoadEngineConfig
): EvaluatedDiscrepancy[] {
  return events
    .filter((event) => {
      if (!event.endTime || event.endTime > now) return false;
      if (!["closed", "partially_closed", "restricted", "planned"].includes(event.declaredState)) {
        return false;
      }
      const sourceAgeSeconds = event.sourceUpdatedAt
        ? (now.valueOf() - event.sourceUpdatedAt.valueOf()) / 1000
        : Number.POSITIVE_INFINITY;
      return sourceAgeSeconds > config.trafficObservationStaleSeconds;
    })
    .map((event) => {
      const score = scoreEvidence([
        factor({
          source: event.source,
          signal: "stale_source_record",
          staleAfterSeconds: config.trafficObservationStaleSeconds,
          observedAt: event.sourceUpdatedAt,
          now,
          description: "The declared event remains active past its expected end with no recent source update."
        })
      ]);
      return makeDiscrepancy({
        type: "stale_declared_event",
        declaredState: event.declaredState,
        observedState: "unknown",
        score,
        severity: 2,
        title: "Stale declared road event",
        summary: "A declared road event appears stale relative to its expected end time.",
        baseExplanation: [
          "The official event has passed its expected end time.",
          "No recent source update was found."
        ],
        events: [event],
        observations: [],
        now
      });
    });
}

function dedupeDiscrepancies(discrepancies: EvaluatedDiscrepancy[]) {
  const seen = new Set<string>();
  return discrepancies.filter((discrepancy) => {
    const key = `${discrepancy.type}:${discrepancy.roadName ?? ""}:${Math.round(
      (discrepancy.latitude ?? 0) * 1000
    )}:${Math.round((discrepancy.longitude ?? 0) * 1000)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
