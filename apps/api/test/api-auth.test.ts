import { describe, it, expect, vi } from "vitest";
import Fastify from "fastify";
import apiAuthPlugin from "../src/plugins/api-auth.js";
import { registerErrorHandler } from "../src/errors.js";
import { generateApiKey } from "../src/api-keys.js";
import type { RoadRealityDb } from "@road-reality/database";
import * as dbPackage from "@road-reality/database";

vi.mock("@road-reality/database", async () => {
  const actual = await vi.importActual<typeof import("@road-reality/database")>("@road-reality/database");
  return {
    ...actual,
    findApiKeyByHash: vi.fn(),
    getApiConsumer: vi.fn(),
    updateApiKeyLastUsed: vi.fn(),
    updateConsumerLastRequest: vi.fn()
  };
});

describe("api-auth plugin", () => {
  const hashSecret = "test-secret";

  async function buildApp() {
    const app = Fastify();
    registerErrorHandler(app);
    
    // Create a dummy db object
    const db = {} as RoadRealityDb;
    
    await app.register(apiAuthPlugin, { db, hashSecret });
    
    app.get("/test", {
      preHandler: [(app as any).authenticateApiKey]
    }, async (request) => {
      return { ok: true, consumer: (request as any).apiConsumer };
    });
    
    return app;
  }

  it("should reject missing authorization header", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/test" });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("INVALID_API_KEY");
  });

  it("should reject invalid authorization scheme", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/test", headers: { authorization: "Basic foo" } });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("INVALID_API_KEY");
  });

  it("should reject malformed api key format", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/test", headers: { authorization: "Bearer not_a_real_key" } });
    expect(res.statusCode).toBe(401);
  });

  it("should authenticate valid api key", async () => {
    const app = await buildApp();
    const key = generateApiKey("live", hashSecret);

    vi.mocked(dbPackage.findApiKeyByHash).mockResolvedValueOnce({
      id: "key-id",
      consumerId: "consumer-id",
      environment: "live",
      status: "active",
      keyPrefix: key.prefix,
      keyHash: key.hash,
      keyLastFour: key.lastFour,
      createdAt: new Date(),
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: null,
      metadata: {}
    });

    vi.mocked(dbPackage.getApiConsumer).mockResolvedValueOnce({
      id: "consumer-id",
      companyName: "Test Co",
      email: "test@co.com",
      emailNormalized: "test@co.com",
      useCase: null,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastRequestAt: null,
      metadata: {}
    });

    vi.mocked(dbPackage.updateApiKeyLastUsed).mockResolvedValueOnce(undefined as any);
    vi.mocked(dbPackage.updateConsumerLastRequest).mockResolvedValueOnce(undefined as any);

    const res = await app.inject({
      method: "GET",
      url: "/test",
      headers: { authorization: `Bearer ${key.fullKey}` }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().consumer.id).toBe("consumer-id");
    expect(res.json().consumer.companyName).toBe("Test Co");
  });

  it("should reject revoked api key", async () => {
    const app = await buildApp();
    const key = generateApiKey("live", hashSecret);

    vi.mocked(dbPackage.findApiKeyByHash).mockResolvedValueOnce({
      id: "key-id",
      consumerId: "consumer-id",
      environment: "live",
      status: "revoked",
      keyPrefix: key.prefix,
      keyHash: key.hash,
      keyLastFour: key.lastFour,
      createdAt: new Date(),
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: null,
      metadata: {}
    });

    const res = await app.inject({
      method: "GET",
      url: "/test",
      headers: { authorization: `Bearer ${key.fullKey}` }
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("API_KEY_REVOKED");
  });
});
