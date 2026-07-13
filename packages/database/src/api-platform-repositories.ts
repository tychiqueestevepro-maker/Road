import { and, eq, gte, desc, sql as drizzleSql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  apiConsumers,
  apiKeys,
  apiRequests,
  apiAccessEmails,
  developerEvents
} from "./schema.js";
import type { RoadRealityDb } from "./client.js";

// ---------------------------------------------------------------------------
// API Consumers
// ---------------------------------------------------------------------------

export async function findConsumerByEmail(db: RoadRealityDb, emailNormalized: string) {
  const [consumer] = await db
    .select()
    .from(apiConsumers)
    .where(eq(apiConsumers.emailNormalized, emailNormalized))
    .limit(1);
  return consumer;
}

export async function createApiConsumer(
  db: RoadRealityDb,
  input: {
    companyName: string;
    email: string;
    emailNormalized: string;
    useCase?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const [consumer] = await db
    .insert(apiConsumers)
    .values({
      companyName: input.companyName,
      email: input.email,
      emailNormalized: input.emailNormalized,
      useCase: input.useCase,
      metadata: input.metadata ?? {}
    })
    .returning();
  if (!consumer) throw new Error("createApiConsumer did not return a row");
  return consumer;
}

export async function getApiConsumer(db: RoadRealityDb, id: string) {
  const [consumer] = await db
    .select()
    .from(apiConsumers)
    .where(eq(apiConsumers.id, id));
  return consumer;
}

export async function updateConsumerLastRequest(db: RoadRealityDb, consumerId: string) {
  await db
    .update(apiConsumers)
    .set({ lastRequestAt: new Date(), updatedAt: new Date() })
    .where(eq(apiConsumers.id, consumerId));
}

// ---------------------------------------------------------------------------
// API Keys
// ---------------------------------------------------------------------------

export async function createApiKey(
  db: RoadRealityDb,
  input: {
    consumerId: string;
    keyPrefix: string;
    keyHash: string;
    keyLastFour: string;
    environment?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const [key] = await db
    .insert(apiKeys)
    .values({
      consumerId: input.consumerId,
      keyPrefix: input.keyPrefix,
      keyHash: input.keyHash,
      keyLastFour: input.keyLastFour,
      environment: input.environment ?? "live",
      metadata: input.metadata ?? {}
    })
    .returning();
  if (!key) throw new Error("createApiKey did not return a row");
  return key;
}

export async function findApiKeyByHash(db: RoadRealityDb, keyPrefix: string, keyHash: string) {
  const [key] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyPrefix, keyPrefix), eq(apiKeys.keyHash, keyHash)))
    .limit(1);
  return key;
}

export async function countActiveKeysForConsumer(db: RoadRealityDb, consumerId: string) {
  const [result] = await db
    .select({ count: drizzleSql<number>`count(*)::int` })
    .from(apiKeys)
    .where(and(eq(apiKeys.consumerId, consumerId), eq(apiKeys.status, "active")));
  return result?.count ?? 0;
}

export async function updateApiKeyLastUsed(db: RoadRealityDb, keyId: string) {
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, keyId));
}

export async function revokeApiKey(db: RoadRealityDb, keyId: string) {
  const [key] = await db
    .update(apiKeys)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(eq(apiKeys.id, keyId))
    .returning();
  return key;
}

export async function listConsumerApiKeys(db: RoadRealityDb, consumerId: string) {
  return db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.consumerId, consumerId))
    .orderBy(desc(apiKeys.createdAt));
}

export async function getRecentKeyForConsumer(
  db: RoadRealityDb,
  consumerId: string,
  cooldownMinutes: number
) {
  const cutoff = new Date(Date.now() - cooldownMinutes * 60 * 1000);
  const [key] = await db
    .select()
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.consumerId, consumerId),
        gte(apiKeys.createdAt, cutoff)
      )
    )
    .orderBy(desc(apiKeys.createdAt))
    .limit(1);
  return key;
}

// ---------------------------------------------------------------------------
// API Requests
// ---------------------------------------------------------------------------

export async function logApiRequest(
  db: RoadRealityDb,
  input: {
    apiKeyId?: string;
    consumerId?: string;
    requestId: string;
    method: string;
    path: string;
    statusCode?: number;
    durationMs?: number;
    ipHash?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const [row] = await db
    .insert(apiRequests)
    .values({
      apiKeyId: input.apiKeyId,
      consumerId: input.consumerId,
      requestId: input.requestId,
      method: input.method,
      path: input.path,
      statusCode: input.statusCode,
      durationMs: input.durationMs,
      ipHash: input.ipHash,
      userAgent: input.userAgent,
      metadata: input.metadata ?? {}
    })
    .returning();
  return row;
}

// ---------------------------------------------------------------------------
// API Access Emails
// ---------------------------------------------------------------------------

export async function logAccessEmail(
  db: RoadRealityDb,
  input: {
    consumerId: string;
    apiKeyId?: string;
    emailType: string;
    providerMessageId?: string;
    status: string;
    sentAt?: Date;
    error?: string;
  }
) {
  const [row] = await db
    .insert(apiAccessEmails)
    .values({
      consumerId: input.consumerId,
      apiKeyId: input.apiKeyId,
      emailType: input.emailType,
      providerMessageId: input.providerMessageId,
      status: input.status,
      sentAt: input.sentAt,
      error: input.error
    })
    .returning();
  return row;
}

// ---------------------------------------------------------------------------
// Developer Events
// ---------------------------------------------------------------------------

export async function trackDeveloperEvent(
  db: RoadRealityDb,
  input: {
    eventName: string;
    consumerId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const [row] = await db
    .insert(developerEvents)
    .values({
      eventName: input.eventName,
      consumerId: input.consumerId,
      sessionId: input.sessionId,
      metadata: input.metadata ?? {}
    })
    .returning();
  return row;
}
