import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerAccessRoutes } from "../src/access-routes.js";
import { registerErrorHandler } from "../src/errors.js";
import type { RoadRealityDb } from "@road-reality/database";
import * as dbPackage from "@road-reality/database";
import * as emailPackage from "@road-reality/email";

vi.mock("@road-reality/database", async () => {
  const actual = await vi.importActual<typeof import("@road-reality/database")>("@road-reality/database");
  return {
    ...actual,
    findConsumerByEmail: vi.fn(),
    createApiConsumer: vi.fn(),
    createApiKey: vi.fn(),
    countActiveKeysForConsumer: vi.fn(),
    getRecentKeyForConsumer: vi.fn(),
    logAccessEmail: vi.fn(),
    trackDeveloperEvent: vi.fn()
  };
});

vi.mock("@road-reality/email", () => ({
  sendApiAccessEmail: vi.fn()
}));

describe("Access Routes", () => {
  const hashSecret = "test-secret";

  async function buildApp() {
    const app = Fastify();
    const db = {} as RoadRealityDb;
    
    registerErrorHandler(app);

    registerAccessRoutes(app, {
      db,
      hashSecret,
      cooldownMinutes: 15,
      allowAdditionalKeys: true,
      maxActiveKeysPerConsumer: 3,
      emailFrom: "test@verytis.dev"
    });

    return app;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbPackage.trackDeveloperEvent).mockResolvedValue({} as any);
  });

  it("should validate input schema", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/access",
      payload: { email: "not_an_email" }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("INVALID_REQUEST");
  });

  it("should create new consumer and key", async () => {
    const app = await buildApp();

    vi.mocked(dbPackage.findConsumerByEmail).mockResolvedValueOnce(undefined);
    vi.mocked(dbPackage.createApiConsumer).mockResolvedValueOnce({ id: "consumer-1" } as any);
    vi.mocked(dbPackage.createApiKey).mockResolvedValueOnce({ id: "key-1" } as any);
    vi.mocked(emailPackage.sendApiAccessEmail).mockResolvedValueOnce({ messageId: "msg-1" });
    vi.mocked(dbPackage.logAccessEmail).mockResolvedValueOnce({} as any);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/access",
      payload: { company_name: "Test Co", email: "test@co.com" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);

    expect(dbPackage.createApiConsumer).toHaveBeenCalled();
    expect(dbPackage.createApiKey).toHaveBeenCalled();
    expect(emailPackage.sendApiAccessEmail).toHaveBeenCalled();
    expect(dbPackage.logAccessEmail).toHaveBeenCalled();
  });

  it("should enforce cooldown period", async () => {
    const app = await buildApp();

    vi.mocked(dbPackage.findConsumerByEmail).mockResolvedValueOnce({ id: "consumer-1" } as any);
    vi.mocked(dbPackage.getRecentKeyForConsumer).mockResolvedValueOnce({ id: "recent-key" } as any);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/access",
      payload: { company_name: "Test Co", email: "test@co.com" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);

    // Should NOT create new key or send email
    expect(dbPackage.createApiKey).not.toHaveBeenCalled();
    expect(emailPackage.sendApiAccessEmail).not.toHaveBeenCalled();
  });

  it("should enforce active keys limit", async () => {
    const app = await buildApp();

    vi.mocked(dbPackage.findConsumerByEmail).mockResolvedValueOnce({ id: "consumer-1" } as any);
    vi.mocked(dbPackage.getRecentKeyForConsumer).mockResolvedValueOnce(undefined);
    vi.mocked(dbPackage.countActiveKeysForConsumer).mockResolvedValueOnce(3); // Max is 3

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/access",
      payload: { company_name: "Test Co", email: "test@co.com" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);

    // Should NOT create new key or send email
    expect(dbPackage.createApiKey).not.toHaveBeenCalled();
    expect(emailPackage.sendApiAccessEmail).not.toHaveBeenCalled();
  });
});
