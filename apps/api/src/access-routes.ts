import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createDb,
  findConsumerByEmail,
  createApiConsumer,
  createApiKey,
  countActiveKeysForConsumer,
  getRecentKeyForConsumer,
  logAccessEmail,
  trackDeveloperEvent,
  type RoadRealityDb
} from "@road-reality/database";
import { generateApiKey } from "./api-keys.js";
import { sendApiAccessEmail } from "@road-reality/email";
import { ApiError } from "./errors.js";

const accessRequestSchema = z.object({
  company_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  use_case: z.string().trim().max(1000).optional()
});

interface AccessRouteOpts {
  db: RoadRealityDb;
  hashSecret: string;
  cooldownMinutes: number;
  allowAdditionalKeys: boolean;
  maxActiveKeysPerConsumer: number;
  emailFrom: string;
  emailReplyTo?: string;
  resendApiKey?: string;
}

export function registerAccessRoutes(app: FastifyInstance, opts: AccessRouteOpts) {
  const {
    db,
    hashSecret,
    cooldownMinutes,
    allowAdditionalKeys,
    maxActiveKeysPerConsumer,
    emailFrom,
    emailReplyTo,
    resendApiKey
  } = opts;

  app.post("/api/v1/access", async (request, reply) => {
    // Validate request body
    const parsed = accessRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ApiError("INVALID_REQUEST", "Request validation failed.", 400, {
        issues: parsed.error.issues
      });
    }

    const { company_name, email, use_case } = parsed.data;
    const emailNormalized = email.toLowerCase();

    // Track the access request event
    trackDeveloperEvent(db, {
      eventName: "api_access_requested",
      metadata: { ip_hash: hashIp(request.ip) }
    }).catch(() => {});

    // Check for existing consumer
    const existingConsumer = await findConsumerByEmail(db, emailNormalized);

    if (existingConsumer) {
      // Check cooldown — if a key was recently created, return generic success
      const recentKey = await getRecentKeyForConsumer(db, existingConsumer.id, cooldownMinutes);
      if (recentKey) {
        return genericSuccess();
      }

      // Check active key limit
      const activeCount = await countActiveKeysForConsumer(db, existingConsumer.id);
      if (activeCount >= maxActiveKeysPerConsumer) {
        // Log the blocked issuance for manual review
        request.log.warn(
          { consumer_id: existingConsumer.id, active_keys: activeCount },
          "API key limit reached for consumer"
        );
        trackDeveloperEvent(db, {
          eventName: "api_access_key_limit_reached",
          consumerId: existingConsumer.id,
          metadata: { active_keys: activeCount }
        }).catch(() => {});
        return genericSuccess();
      }

      if (!allowAdditionalKeys) {
        return genericSuccess();
      }

      // Generate and deliver a new key for existing consumer
      const generated = generateApiKey("live", hashSecret);
      const apiKey = await createApiKey(db, {
        consumerId: existingConsumer.id,
        keyPrefix: generated.prefix,
        keyHash: generated.hash,
        keyLastFour: generated.lastFour,
        environment: generated.environment
      });

      await deliverKey(existingConsumer.id, apiKey.id, generated.fullKey, email, company_name, request);
      return genericSuccess();
    }

    // Create new consumer
    const consumer = await createApiConsumer(db, {
      companyName: company_name,
      email,
      emailNormalized,
      useCase: use_case
    });

    // Generate API key
    const generated = generateApiKey("live", hashSecret);
    const apiKey = await createApiKey(db, {
      consumerId: consumer.id,
      keyPrefix: generated.prefix,
      keyHash: generated.hash,
      keyLastFour: generated.lastFour,
      environment: generated.environment
    });

    await deliverKey(consumer.id, apiKey.id, generated.fullKey, email, company_name, request);
    return genericSuccess();
  });

  async function deliverKey(
    consumerId: string,
    apiKeyId: string,
    fullKey: string,
    email: string,
    companyName: string,
    request: any
  ) {
    try {
      const result = await sendApiAccessEmail({
        to: email,
        apiKey: fullKey,
        companyName,
        from: emailFrom,
        replyTo: emailReplyTo,
        resendApiKey
      });

      await logAccessEmail(db, {
        consumerId,
        apiKeyId,
        emailType: "api_access",
        providerMessageId: result.messageId,
        status: "sent",
        sentAt: new Date()
      });

      trackDeveloperEvent(db, {
        eventName: "api_access_email_sent",
        consumerId
      }).catch(() => {});
    } catch (error) {
      request.log.error({ consumer_id: consumerId, error: String(error) }, "Failed to send API access email");
      await logAccessEmail(db, {
        consumerId,
        apiKeyId,
        emailType: "api_access",
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      });
      // Still return generic success to avoid leaking information
    }
  }
}

function genericSuccess() {
  return {
    success: true,
    message: "API access has been sent to your email.",
    next: "/docs/quickstart"
  };
}

function hashIp(ip: string): string {
  const crypto = require("node:crypto");
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
}
