import crypto from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { createDb } from "@road-reality/database";
import { loadConfig, loadLocalEnv } from "@road-reality/config";
import { registerErrorHandler } from "./errors.js";
import { registerRoutes } from "./routes.js";
import { registerPublicApiRoutes } from "./public-routes.js";
import { registerAccessRoutes } from "./access-routes.js";
import apiAuthPlugin from "./plugins/api-auth.js";

export async function buildApiApp() {
  loadLocalEnv();
  const config = loadConfig();
  const { db, sql } = createDb(config.DATABASE_URL);

  const apiKeyHashSecret = process.env.API_KEY_HASH_SECRET || "dev-hash-secret-change-in-production";
  const accessRateLimitPerHour = Number(process.env.ACCESS_RATE_LIMIT_PER_HOUR || "5");
  const accessCooldownMinutes = Number(process.env.API_ACCESS_REQUEST_COOLDOWN_MINUTES || "15");
  const allowAdditionalKeys = process.env.API_ACCESS_ALLOW_ADDITIONAL_KEYS !== "false";
  const maxActiveKeysPerConsumer = Number(process.env.API_MAX_ACTIVE_KEYS_PER_CONSUMER || "3");
  const allowedOrigins = (process.env.API_ALLOWED_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const resendApiKey = process.env.RESEND_API_KEY || "";
  const emailFrom = process.env.EMAIL_FROM || "Verytis <api@verytis.com>";
  const emailReplyTo = process.env.EMAIL_REPLY_TO || "";

  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL
    },
    genReqId: () => `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`,
    bodyLimit: 1024 * 1024
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      if (
        config.NODE_ENV === "development" &&
        (origin.includes("localhost") || origin.includes("127.0.0.1"))
      ) {
        return cb(null, true);
      }
      return cb(null, false);
    },
    credentials: true
  });

  await app.register(rateLimit, {
    global: false
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Verytis API",
        description:
          "Real-time road verification infrastructure. Detect when observed road conditions no longer match declared road data.",
        version: "1.0.0"
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            description: "API key from Verytis. Format: vt_live_..."
          }
        }
      },
      security: [{ bearerAuth: [] }]
    }
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs"
  });

  app.get("/openapi.json", async () => app.swagger());

  registerErrorHandler(app);
  await app.register(apiAuthPlugin, { db, hashSecret: apiKeyHashSecret });

  registerRoutes(app, db);
  app.addHook("onRoute", (routeOptions) => {
    if (routeOptions.url === "/api/v1/access" && routeOptions.method === "POST") {
      const existingConfig = routeOptions.config || {};
      routeOptions.config = {
        ...existingConfig,
        rateLimit: {
          max: accessRateLimitPerHour,
          timeWindow: "1 hour",
          keyGenerator: (request: any) => request.ip
        }
      };
    }
  });
  registerAccessRoutes(app, {
    db,
    hashSecret: apiKeyHashSecret,
    cooldownMinutes: accessCooldownMinutes,
    allowAdditionalKeys,
    maxActiveKeysPerConsumer,
    emailFrom,
    emailReplyTo: emailReplyTo || undefined,
    resendApiKey: resendApiKey || undefined
  });

  registerPublicApiRoutes(app, db);

  return { app, db, sql };
}
