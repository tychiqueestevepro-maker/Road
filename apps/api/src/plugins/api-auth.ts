import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import {
  findApiKeyByHash,
  getApiConsumer,
  updateApiKeyLastUsed,
  updateConsumerLastRequest,
  type RoadRealityDb
} from "@road-reality/database";
import { hashApiKey, isValidKeyFormat, extractKeyPrefix, safeKeyReference } from "../api-keys.js";
import { ApiError } from "../errors.js";

export interface ApiConsumerContext {
  id: string;
  companyName: string;
  apiKeyId: string;
  environment: string;
}

declare module "fastify" {
  interface FastifyRequest {
    apiConsumer?: ApiConsumerContext;
  }
}

async function apiAuthPlugin(
  app: FastifyInstance,
  opts: { db: RoadRealityDb; hashSecret: string }
) {
  const { db, hashSecret } = opts;

  app.decorate("authenticateApiKey", async function authenticateApiKey(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const authorization = request.headers.authorization;
    if (!authorization) {
      throw new ApiError("INVALID_API_KEY", "Missing Authorization header.", 401);
    }

    const parts = authorization.split(" ");
    const scheme = parts[0];
    const providedKey = parts[1];
    if (parts.length !== 2 || scheme !== "Bearer" || !providedKey) {
      throw new ApiError("INVALID_API_KEY", "Authorization header must use Bearer scheme.", 401);
    }

    if (!isValidKeyFormat(providedKey)) {
      throw new ApiError("INVALID_API_KEY", "The provided API key format is invalid.", 401);
    }

    const prefix = extractKeyPrefix(providedKey);
    if (!prefix) {
      throw new ApiError("INVALID_API_KEY", "The provided API key format is invalid.", 401);
    }

    const keyHash = hashApiKey(providedKey, hashSecret);
    const apiKey = await findApiKeyByHash(db, prefix, keyHash);

    if (!apiKey) {
      request.log.warn({ key_ref: safeKeyReference(providedKey), request_id: request.id }, "API key not found");
      throw new ApiError("INVALID_API_KEY", "The provided API key is invalid.", 401);
    }

    if (apiKey.status === "revoked") {
      request.log.warn({ key_ref: `${prefix}_****${apiKey.keyLastFour}`, request_id: request.id }, "Revoked API key used");
      throw new ApiError("API_KEY_REVOKED", "This API key has been revoked.", 401);
    }

    if (apiKey.status === "expired" || (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date())) {
      throw new ApiError("API_KEY_EXPIRED", "This API key has expired.", 401);
    }

    if (apiKey.status !== "active") {
      throw new ApiError("INVALID_API_KEY", "The provided API key is not active.", 401);
    }

    const consumer = await getApiConsumer(db, apiKey.consumerId);
    if (!consumer || consumer.status !== "active") {
      throw new ApiError("INVALID_API_KEY", "The API consumer account is not active.", 401);
    }

    request.apiConsumer = {
      id: consumer.id,
      companyName: consumer.companyName,
      apiKeyId: apiKey.id,
      environment: apiKey.environment
    };

    // Update last-used timestamps asynchronously — do not block the request.
    updateApiKeyLastUsed(db, apiKey.id).catch(() => {});
    updateConsumerLastRequest(db, consumer.id).catch(() => {});
  });
}

export default fp(apiAuthPlugin, {
  name: "api-auth",
  fastify: "5.x"
});
