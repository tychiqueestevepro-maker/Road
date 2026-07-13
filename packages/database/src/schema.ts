import {
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

const geometry = customType<{ data: string | null; driverData: string | null }>({
  dataType() {
    return "geometry";
  }
});

const createdUpdated = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const dataSources = pgTable("data_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  sourceType: text("source_type").notNull(),
  baseUrl: text("base_url"),
  enabled: boolean("enabled").default(true).notNull(),
  pollIntervalSeconds: integer("poll_interval_seconds"),
  lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
  lastError: text("last_error"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  ...createdUpdated()
});

export const ingestionRuns = pgTable("ingestion_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id").references(() => dataSources.id),
  status: text("status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  recordsReceived: integer("records_received").default(0).notNull(),
  recordsCreated: integer("records_created").default(0).notNull(),
  recordsUpdated: integer("records_updated").default(0).notNull(),
  recordsFailed: integer("records_failed").default(0).notNull(),
  error: text("error"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull()
});

export const rawSourceRecords = pgTable(
  "raw_source_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id").references(() => dataSources.id).notNull(),
    externalId: text("external_id"),
    recordHash: text("record_hash").notNull(),
    payload: jsonb("payload").$type<unknown>().notNull(),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    sourceHashIdx: uniqueIndex("raw_source_records_source_hash_idx").on(
      table.sourceId,
      table.recordHash
    ),
    sourceExternalIdx: index("raw_source_records_source_external_idx").on(
      table.sourceId,
      table.externalId
    )
  })
);

export const roadEvents = pgTable(
  "road_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id").references(() => dataSources.id).notNull(),
    externalId: text("external_id"),
    eventType: text("event_type").notNull(),
    title: text("title"),
    description: text("description"),
    roadName: text("road_name"),
    direction: text("direction"),
    severity: integer("severity"),
    declaredStatus: text("declared_status").notNull(),
    startTime: timestamp("start_time", { withTimezone: true }),
    endTime: timestamp("end_time", { withTimezone: true }),
    geometry: geometry("geometry"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    rawRecordId: uuid("raw_record_id").references(() => rawSourceRecords.id),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    ...createdUpdated()
  },
  (table) => ({
    sourceExternalIdx: uniqueIndex("road_events_source_external_idx").on(
      table.sourceId,
      table.externalId
    ),
    roadNameIdx: index("road_events_road_name_idx").on(table.roadName)
  })
);

export const roadSegments = pgTable("road_segments", {
  id: uuid("id").primaryKey().defaultRandom(),
  externalId: text("external_id"),
  name: text("name"),
  geometry: geometry("geometry").notNull(),
  center: geometry("center"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  ...createdUpdated()
});

export const cameras = pgTable(
  "cameras",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id").references(() => dataSources.id).notNull(),
    externalId: text("external_id"),
    name: text("name").notNull(),
    roadName: text("road_name"),
    direction: text("direction"),
    location: geometry("location"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    snapshotUrl: text("snapshot_url"),
    streamUrl: text("stream_url"),
    active: boolean("active").default(true).notNull(),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
    lastError: text("last_error"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    ...createdUpdated()
  },
  (table) => ({
    sourceExternalIdx: uniqueIndex("cameras_source_external_idx").on(
      table.sourceId,
      table.externalId
    )
  })
);

export const cameraSnapshots = pgTable(
  "camera_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cameraId: uuid("camera_id").references(() => cameras.id).notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
    imageUrl: text("image_url"),
    storagePath: text("storage_path"),
    imageHash: text("image_hash").notNull(),
    width: integer("width"),
    height: integer("height"),
    analysisStatus: text("analysis_status").default("pending").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    cameraHashIdx: uniqueIndex("camera_snapshots_camera_hash_idx").on(
      table.cameraId,
      table.imageHash
    )
  })
);

export const roadObservations = pgTable(
  "road_observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id").references(() => dataSources.id).notNull(),
    cameraId: uuid("camera_id").references(() => cameras.id),
    snapshotId: uuid("snapshot_id").references(() => cameraSnapshots.id),
    observationType: text("observation_type").notNull(),
    roadName: text("road_name"),
    geometry: geometry("geometry"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    observedState: text("observed_state").notNull(),
    confidence: doublePrecision("confidence").notNull(),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().default({}).notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    roadNameIdx: index("road_observations_road_name_idx").on(table.roadName)
  })
);

export const discrepancies = pgTable(
  "discrepancies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roadSegmentId: uuid("road_segment_id").references(() => roadSegments.id),
    roadName: text("road_name"),
    geometry: geometry("geometry"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    discrepancyType: text("discrepancy_type").notNull(),
    status: text("status").default("active").notNull(),
    declaredState: text("declared_state").notNull(),
    observedState: text("observed_state").notNull(),
    confidence: doublePrecision("confidence").notNull(),
    severity: integer("severity").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    explanation: jsonb("explanation").$type<string[]>().default([]).notNull(),
    firstDetectedAt: timestamp("first_detected_at", { withTimezone: true }).notNull(),
    lastDetectedAt: timestamp("last_detected_at", { withTimezone: true }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...createdUpdated()
  },
  (table) => ({
    statusIdx: index("discrepancies_status_idx").on(table.status),
    typeIdx: index("discrepancies_type_idx").on(table.discrepancyType)
  })
);

export const discrepancyEvidence = pgTable("discrepancy_evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  discrepancyId: uuid("discrepancy_id")
    .references(() => discrepancies.id)
    .notNull(),
  evidenceType: text("evidence_type").notNull(),
  roadEventId: uuid("road_event_id").references(() => roadEvents.id),
  observationId: uuid("observation_id").references(() => roadObservations.id),
  snapshotId: uuid("snapshot_id").references(() => cameraSnapshots.id),
  weight: doublePrecision("weight").notNull(),
  description: text("description").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const systemAlerts = pgTable("system_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  discrepancyId: uuid("discrepancy_id").references(() => discrepancies.id).notNull(),
  alertType: text("alert_type").notNull(),
  severity: integer("severity").notNull(),
  message: text("message").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

// ---------------------------------------------------------------------------
// API Platform tables
// ---------------------------------------------------------------------------

export const apiConsumers = pgTable(
  "api_consumers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyName: text("company_name").notNull(),
    email: text("email").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    useCase: text("use_case"),
    status: text("status").default("active").notNull(),
    ...createdUpdated(),
    lastRequestAt: timestamp("last_request_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull()
  },
  (table) => ({
    emailNormalizedIdx: index("api_consumers_email_normalized_idx").on(table.emailNormalized)
  })
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consumerId: uuid("consumer_id")
      .references(() => apiConsumers.id)
      .notNull(),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    keyLastFour: text("key_last_four").notNull(),
    environment: text("environment").default("live").notNull(),
    status: text("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull()
  },
  (table) => ({
    keyPrefixIdx: index("api_keys_key_prefix_idx").on(table.keyPrefix),
    consumerIdIdx: index("api_keys_consumer_id_idx").on(table.consumerId),
    statusIdx: index("api_keys_status_idx").on(table.status)
  })
);

export const apiRequests = pgTable("api_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  apiKeyId: uuid("api_key_id").references(() => apiKeys.id),
  consumerId: uuid("consumer_id").references(() => apiConsumers.id),
  requestId: text("request_id").notNull(),
  method: text("method").notNull(),
  path: text("path").notNull(),
  statusCode: integer("status_code"),
  durationMs: integer("duration_ms"),
  ipHash: text("ip_hash"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull()
});

export const apiAccessEmails = pgTable("api_access_emails", {
  id: uuid("id").primaryKey().defaultRandom(),
  consumerId: uuid("consumer_id")
    .references(() => apiConsumers.id)
    .notNull(),
  apiKeyId: uuid("api_key_id").references(() => apiKeys.id),
  emailType: text("email_type").notNull(),
  providerMessageId: text("provider_message_id"),
  status: text("status").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const developerEvents = pgTable(
  "developer_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventName: text("event_name").notNull(),
    consumerId: uuid("consumer_id"),
    sessionId: text("session_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    eventNameIdx: index("developer_events_event_name_idx").on(table.eventName),
    createdAtIdx: index("developer_events_created_at_idx").on(table.createdAt)
  })
);

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type DataSource = typeof dataSources.$inferSelect;
export type RoadEvent = typeof roadEvents.$inferSelect;
export type RoadObservation = typeof roadObservations.$inferSelect;
export type Discrepancy = typeof discrepancies.$inferSelect;
export type Camera = typeof cameras.$inferSelect;
export type CameraSnapshot = typeof cameraSnapshots.$inferSelect;
export type ApiConsumer = typeof apiConsumers.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type ApiRequest = typeof apiRequests.$inferSelect;
export type ApiAccessEmail = typeof apiAccessEmails.$inferSelect;
export type DeveloperEvent = typeof developerEvents.$inferSelect;
