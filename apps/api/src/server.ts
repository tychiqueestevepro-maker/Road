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

loadLocalEnv();
const config = loadConfig();
const { db, sql } = createDb(config.DATABASE_URL);

// ---------------------------------------------------------------------------
// API-platform configuration (env vars with sensible defaults)
// ---------------------------------------------------------------------------
const API_KEY_HASH_SECRET = process.env.API_KEY_HASH_SECRET || "dev-hash-secret-change-in-production";
const API_RATE_LIMIT_PER_MINUTE = Number(process.env.API_RATE_LIMIT_PER_MINUTE || "600");
const ACCESS_RATE_LIMIT_PER_HOUR = Number(process.env.ACCESS_RATE_LIMIT_PER_HOUR || "5");
const API_ACCESS_REQUEST_COOLDOWN_MINUTES = Number(process.env.API_ACCESS_REQUEST_COOLDOWN_MINUTES || "15");
const API_ACCESS_ALLOW_ADDITIONAL_KEYS = process.env.API_ACCESS_ALLOW_ADDITIONAL_KEYS !== "false";
const API_MAX_ACTIVE_KEYS_PER_CONSUMER = Number(process.env.API_MAX_ACTIVE_KEYS_PER_CONSUMER || "3");
const API_ALLOWED_ORIGINS = (process.env.API_ALLOWED_ORIGINS || "http://localhost:3000").split(",").map((s) => s.trim());
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "Verytis <api@verytis.dev>";
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || "";

const app = Fastify({
  logger: {
    level: config.LOG_LEVEL
  },
  genReqId: () => `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`,
  bodyLimit: 1024 * 1024
});

// ---------------------------------------------------------------------------
// CORS — allow internal dashboard (open) + configured origins for public API
// ---------------------------------------------------------------------------
await app.register(cors, {
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, server-to-server)
    if (!origin) return cb(null, true);
    // Allow configured origins
    if (API_ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    // In development, allow localhost origins
    if (config.NODE_ENV === "development" && (origin.includes("localhost") || origin.includes("127.0.0.1"))) {
      return cb(null, true);
    }
    return cb(null, false);
  },
  credentials: true
});

// ---------------------------------------------------------------------------
// Rate Limiting
// ---------------------------------------------------------------------------
await app.register(rateLimit, {
  global: false
});

// ---------------------------------------------------------------------------
// OpenAPI / Swagger
// ---------------------------------------------------------------------------
await app.register(swagger, {
  openapi: {
    info: {
      title: "Verytis API",
      description: "Real-time road verification infrastructure. Detect when observed road conditions no longer match declared road data.",
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

// ---------------------------------------------------------------------------
// OpenAPI JSON endpoint
// ---------------------------------------------------------------------------
app.get("/openapi.json", async () => app.swagger());

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------
registerErrorHandler(app);

// ---------------------------------------------------------------------------
// API Key Authentication Plugin
// ---------------------------------------------------------------------------
await app.register(apiAuthPlugin, { db, hashSecret: API_KEY_HASH_SECRET });

// ---------------------------------------------------------------------------
// Internal routes (existing dashboard API — no API key auth)
// ---------------------------------------------------------------------------
registerRoutes(app, db);

// ---------------------------------------------------------------------------
// Access request endpoint (public, rate-limited per IP)
// ---------------------------------------------------------------------------
registerAccessRoutes(app, {
  db,
  hashSecret: API_KEY_HASH_SECRET,
  cooldownMinutes: API_ACCESS_REQUEST_COOLDOWN_MINUTES,
  allowAdditionalKeys: API_ACCESS_ALLOW_ADDITIONAL_KEYS,
  maxActiveKeysPerConsumer: API_MAX_ACTIVE_KEYS_PER_CONSUMER,
  emailFrom: EMAIL_FROM,
  emailReplyTo: EMAIL_REPLY_TO || undefined,
  resendApiKey: RESEND_API_KEY || undefined
});

// Rate-limit the access endpoint separately
app.addHook("onRoute", (routeOptions) => {
  if (routeOptions.url === "/api/v1/access" && routeOptions.method === "POST") {
    const existingConfig = routeOptions.config || {};
    routeOptions.config = {
      ...existingConfig,
      rateLimit: {
        max: ACCESS_RATE_LIMIT_PER_HOUR,
        timeWindow: "1 hour",
        keyGenerator: (request: any) => request.ip
      }
    };
  }
});

// ---------------------------------------------------------------------------
// Public developer API (requires API key auth, rate-limited per key)
// ---------------------------------------------------------------------------
registerPublicApiRoutes(app, db);

// ---------------------------------------------------------------------------
// Shutdown
// ---------------------------------------------------------------------------
const close = async () => {
  await app.close();
  await sql.end();
};
process.on("SIGINT", close);
process.on("SIGTERM", close);

await app.listen({
  port: config.API_PORT,
  host: "0.0.0.0"
});
