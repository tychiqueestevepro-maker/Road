import { z } from "zod";
import { loadRoadEngineConfig } from "./road-engine.js";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  WEB_PORT: z.coerce.number().default(3000),
  API_PORT: z.coerce.number().default(4000),
  VISION_PORT: z.coerce.number().default(5000),
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),
  NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: z.string().optional().default(""),
  NEXT_PUBLIC_MAPBOX_STYLE_URL: z.string().optional().default("mapbox://styles/mapbox/streets-v12"),
  NEXT_PUBLIC_MAP_STYLE_URL: z.string().optional().default(""),
  MAPBOX_ACCESS_TOKEN: z.string().optional().default(""),
  MAPBOX_GEOCODING_ENABLED: z.coerce.boolean().default(true),
  MAPBOX_GEOCODING_PERMANENT: z.coerce.boolean().default(false),
  MAPBOX_GEOCODING_MAX_EVENTS_PER_RESPONSE: z.coerce.number().default(20),
  LIVE_EVENT_DISPLAY_TTL_SECONDS: z.coerce.number().default(300),
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:postgres@localhost:5432/verytis"),
  DATABASE_POOL_MAX: z.coerce.number().default(10),
  SF511_API_KEY: z.string().optional().default(""),
  SF511_EVENTS_POLL_SECONDS: z.coerce.number().default(60),
  SF511_WZDX_POLL_SECONDS: z.coerce.number().default(60),
  SOCRATA_APP_TOKEN: z.string().optional().default(""),
  DATASF_CLOSURES_POLL_SECONDS: z.coerce.number().default(300),
  CAMERA_POLL_SECONDS: z.coerce.number().default(30),
  CAMERA_FETCH_TIMEOUT_MS: z.coerce.number().default(10000),
  VISION_PROVIDER: z.enum(["local", "mock", "external"]).default("local"),
  VISION_API_KEY: z.string().optional().default(""),
  VISION_MODEL: z.string().optional().default(""),
  VISION_SERVICE_URL: z.string().url().default("http://localhost:5000"),
  DEMO_MODE: z.coerce.boolean().default(true),
  LOG_LEVEL: z.string().default("info"),
  // Developer API Platform
  PUBLIC_API_BASE_URL: z.string().default("https://api.verytis.com/v1"),
  API_KEY_HASH_SECRET: z.string().default("dev-hash-secret-change-in-production"),
  API_RATE_LIMIT_PER_MINUTE: z.coerce.number().default(600),
  API_ACCESS_REQUEST_COOLDOWN_MINUTES: z.coerce.number().default(15),
  API_ACCESS_ALLOW_ADDITIONAL_KEYS: z.coerce.boolean().default(true),
  API_MAX_ACTIVE_KEYS_PER_CONSUMER: z.coerce.number().default(3),
  ACCESS_RATE_LIMIT_PER_HOUR: z.coerce.number().default(5),
  API_ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().default("Verytis <api@verytis.com>"),
  EMAIL_REPLY_TO: z.string().optional().default(""),
  WEBHOOK_SIGNING_SECRET: z.string().optional().default("")
});

export type AppConfig = z.infer<typeof envSchema> & {
  roadEngine: ReturnType<typeof loadRoadEngineConfig>;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    ...envSchema.parse(env),
    roadEngine: loadRoadEngineConfig(env)
  };
}
