import { z } from "zod";

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

export const API_URL =
  configuredApiUrl ||
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:4000");

export const API_URL_SOURCE = configuredApiUrl ? "env" : API_URL ? "default" : "same-origin";

export function apiUrl(path: string) {
  const normalizedBase = API_URL.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export const discrepancySchema = z.object({
  id: z.string(),
  type: z.string(),
  status: z.string(),
  location: z.object({
    road_name: z.string().nullable().optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional()
  }),
  declared_state: z.string(),
  observed_state: z.string(),
  confidence: z.number(),
  severity: z.number(),
  first_detected_at: z.string(),
  last_detected_at: z.string(),
  summary: z.string(),
  explanation: z.array(z.string()),
  evidence: z.array(z.record(z.unknown()))
});

export type Discrepancy = z.infer<typeof discrepancySchema>;

export const roadEventSchema = z.object({
  id: z.string(),
  sourceId: z.string().optional(),
  externalId: z.string().nullable().optional(),
  eventType: z.string(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  roadName: z.string().nullable().optional(),
  direction: z.string().nullable().optional(),
  severity: z.number().nullable().optional(),
  declaredStatus: z.string(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  startTime: z.string().or(z.date()).nullable().optional(),
  endTime: z.string().or(z.date()).nullable().optional(),
  firstSeenAt: z.string().or(z.date()).optional(),
  lastSeenAt: z.string().or(z.date()).optional(),
  createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
  locationQuality: z.string().optional(),
  locationSource: z.string().optional(),
  vehicleUsable: z.boolean().optional(),
  locationWarning: z.string().optional(),
  displayTtlSeconds: z.number().optional(),
  mapExpiresAt: z.string().nullable().optional(),
  realWorldState: z.string().optional()
});

export type RoadEvent = z.infer<typeof roadEventSchema>;

export const cameraSchema = z.object({
  id: z.string(),
  name: z.string(),
  roadName: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  active: z.boolean(),
  snapshotUrl: z.string().nullable().optional(),
  streamUrl: z.string().nullable().optional(),
  lastSuccessAt: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
  snapshots: z.array(z.record(z.unknown())).optional()
});

export type Camera = z.infer<typeof cameraSchema>;

export const observationSchema = z.object({
  id: z.string(),
  observationType: z.string(),
  roadName: z.string().nullable().optional(),
  observedState: z.string(),
  confidence: z.number(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  observedAt: z.string().or(z.date()),
  evidence: z.record(z.unknown()).optional()
});

export type Observation = z.infer<typeof observationSchema>;

export async function apiGet<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(apiUrl(path), {
    headers: { accept: "application/json" },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return schema.parse(await response.json());
}

export function getDiscrepancies() {
  return apiGet("/api/v1/discrepancies?status=active&limit=25", z.array(discrepancySchema));
}

export function getEvents() {
  return apiGet("/api/v1/events?limit=100", z.array(roadEventSchema));
}

export function getEvent(id: string) {
  return apiGet(`/api/v1/events/${id}`, roadEventSchema);
}

export function getCameras() {
  return apiGet("/api/v1/cameras", z.array(cameraSchema));
}

export function getObservations() {
  return apiGet("/api/v1/observations?limit=100", z.array(observationSchema));
}

export function getConnectors() {
  return apiGet("/api/v1/connectors", z.array(z.record(z.unknown())));
}

export function getMetrics() {
  return apiGet(
    "/metrics",
    z.object({
      connectors_online: z.number(),
      connectors_total: z.number(),
      active_discrepancies: z.number(),
      observations_last_hour: z.number(),
      last_ingestion_at: z.string().nullable()
    })
  );
}

export const metricsSchema = z.object({
  connectors_online: z.number(),
  connectors_total: z.number(),
  active_discrepancies: z.number(),
  observations_last_hour: z.number(),
  last_ingestion_at: z.string().nullable()
});

export const livePayloadSchema = z.object({
  streamed_at: z.string(),
  stream: z.object({
    mode: z.string(),
    interval_ms: z.number(),
    label: z.string()
  }),
  metrics: metricsSchema,
  discrepancies: z.array(discrepancySchema),
  events: z.array(roadEventSchema),
  cameras: z.array(cameraSchema),
  observations: z.array(observationSchema)
});

export type LivePayload = z.infer<typeof livePayloadSchema>;

export function getLiveSnapshot() {
  return apiGet("/api/v1/live/state", livePayloadSchema);
}
