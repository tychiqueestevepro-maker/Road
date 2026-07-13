import { z } from "zod";
import type { Geometry } from "geojson";

export const declaredRoadStateSchema = z.enum([
  "open",
  "partially_closed",
  "closed",
  "restricted",
  "planned",
  "unknown"
]);

export type DeclaredRoadState = z.infer<typeof declaredRoadStateSchema>;

export const observedRoadStateSchema = z.enum([
  "normal",
  "blocked",
  "possibly_blocked",
  "low_flow",
  "congested",
  "obstruction",
  "vehicles_stopped",
  "unknown"
]);

export type ObservedRoadState = z.infer<typeof observedRoadStateSchema>;

export const roadEventTypeSchema = z.enum([
  "closure",
  "lane_closure",
  "construction",
  "collision",
  "hazard",
  "congestion",
  "detour",
  "disabled_vehicle",
  "special_event",
  "unknown"
]);

export type RoadEventType = z.infer<typeof roadEventTypeSchema>;

export const observationTypeSchema = z.enum([
  "visual",
  "traffic_flow",
  "official_event",
  "derived"
]);

export type ObservationType = z.infer<typeof observationTypeSchema>;

export const discrepancyTypeSchema = z.enum([
  "possible_unreported_closure",
  "declared_open_observed_blocked",
  "declared_closed_observed_normal",
  "unexpected_flow_interruption",
  "source_conflict",
  "stale_declared_event",
  "unknown_state_anomaly"
]);

export type DiscrepancyType = z.infer<typeof discrepancyTypeSchema>;

export const discrepancyStatusSchema = z.enum([
  "active",
  "monitoring",
  "resolved",
  "dismissed"
]);

export type DiscrepancyStatus = z.infer<typeof discrepancyStatusSchema>;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface NormalizedRoadEvent {
  source: string;
  externalId?: string;
  sourceUrl?: string;
  eventType: RoadEventType;
  title?: string;
  description?: string;
  roadName?: string;
  direction?: string;
  severity?: number;
  declaredState: DeclaredRoadState;
  geometry?: Geometry;
  latitude?: number;
  longitude?: number;
  startTime?: Date;
  endTime?: Date;
  sourceUpdatedAt?: Date;
  firstSeenAt?: Date;
  lastSeenAt?: Date;
  ingestedAt: Date;
  freshnessSeconds?: number;
  rawPayload: unknown;
  metadata?: Record<string, unknown>;
}

export interface NormalizedRoadObservation {
  source: string;
  cameraId?: string;
  snapshotId?: string;
  observationType: ObservationType;
  roadName?: string;
  geometry?: Geometry;
  latitude?: number;
  longitude?: number;
  observedState: ObservedRoadState;
  confidence: number;
  evidence: Record<string, unknown>;
  observedAt: Date;
  expiresAt?: Date;
  freshnessSeconds?: number;
  metadata?: Record<string, unknown>;
}

export interface RawSourceResult<T = unknown> {
  source: string;
  sourceType: string;
  fetchedAt: Date;
  url?: string;
  records: T[];
  raw: unknown;
  metadata?: Record<string, unknown>;
}

export interface ConnectorHealth {
  source: string;
  ok: boolean;
  status: "online" | "degraded" | "offline" | "not_configured" | "demo";
  message?: string;
  checkedAt: Date;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

export interface RoadDataConnector<T = unknown> {
  sourceName: string;
  sourceType: string;
  fetch(): Promise<RawSourceResult<T>>;
  normalize(result: RawSourceResult<T>): Promise<NormalizedRoadEvent[]>;
  healthCheck(): Promise<ConnectorHealth>;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    request_id: string;
  };
}

export interface RoadRealityFilters {
  bbox?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  source?: string;
  event_type?: string;
  severity?: number;
  confidence_min?: number;
  status?: string;
  since?: string;
  until?: string;
  limit?: number;
}

export interface RoadIntelligenceResponse {
  id: string;
  type: DiscrepancyType;
  status: DiscrepancyStatus;
  location: {
    road_name?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  declared_state: DeclaredRoadState;
  observed_state: ObservedRoadState;
  confidence: number;
  severity: number;
  first_detected_at: string;
  last_detected_at: string;
  summary: string;
  explanation: string[];
  evidence: Array<Record<string, unknown>>;
  raw?: Record<string, unknown>;
}
