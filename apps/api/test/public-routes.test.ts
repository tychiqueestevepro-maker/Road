import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerPublicApiRoutes } from "../src/public-routes.js";
import { registerErrorHandler } from "../src/errors.js";
import type { RoadRealityDb } from "@road-reality/database";
import * as dbPackage from "@road-reality/database";

vi.mock("@road-reality/database", async () => {
  const actual = await vi.importActual<typeof import("@road-reality/database")>("@road-reality/database");
  return {
    ...actual,
    listDiscrepancies: vi.fn(),
    getDiscrepancy: vi.fn(),
    listDiscrepancyEvidence: vi.fn(),
    listDataSources: vi.fn(),
    toRoadIntelligenceResponse: vi.fn(),
    listRoadEvents: vi.fn(),
    listObservations: vi.fn()
  };
});

describe("Public Routes", () => {
  async function buildApp() {
    const app = Fastify();
    const db = {} as RoadRealityDb;
    
    registerErrorHandler(app);

    // Mock authentication
    app.decorate("authenticateApiKey", async function (request: any, reply: any) {
      request.apiConsumer = { id: "consumer-1", companyName: "Test Co" };
    });

    registerPublicApiRoutes(app, db);

    return app;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should enforce authentication on protected routes", async () => {
    // If authenticateApiKey throws (which we mock here to throw 401), the route should fail
    const app = Fastify();
    registerErrorHandler(app);
    app.decorate("authenticateApiKey", async function () {
      const err = new Error("Unauthorized");
      (err as any).statusCode = 401;
      throw err;
    });
    registerPublicApiRoutes(app, {} as RoadRealityDb);

    const res = await app.inject({ method: "GET", url: "/v1/sources" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /v1/sources returns standard response format", async () => {
    const app = await buildApp();

    vi.mocked(dbPackage.listDataSources).mockResolvedValueOnce([
      {
        id: "source-1",
        slug: "source-slug",
        name: "Source Name",
        sourceType: "declared_state",
        lastSuccessAt: new Date(),
        pollIntervalSeconds: 60
      } as any
    ]);

    const res = await app.inject({ method: "GET", url: "/v1/sources" });
    expect(res.statusCode).toBe(200);
    const json = res.json();
    
    expect(json.data).toBeDefined();
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.meta).toBeDefined();
    expect(json.meta.request_id).toBeDefined();
  });

  it("GET /v1/road-state returns valid output", async () => {
    const app = await buildApp();

    vi.mocked(dbPackage.listDiscrepancies).mockResolvedValueOnce([]);
    vi.mocked(dbPackage.listRoadEvents).mockResolvedValueOnce([]);
    vi.mocked(dbPackage.listObservations).mockResolvedValueOnce([]);

    const res = await app.inject({ 
      method: "GET", 
      url: "/v1/road-state?latitude=37.8&longitude=-122.4&radius=100" 
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.data.declared_state).toBe("unknown");
    expect(json.data.observed_state).toBe("unknown");
    expect(json.data.inferred_state).toBe("unknown");
  });

  it("GET /v1/road-state rejects invalid coordinates", async () => {
    const app = await buildApp();
    const res = await app.inject({ 
      method: "GET", 
      url: "/v1/road-state?latitude=9000&longitude=-122.4" 
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("INVALID_COORDINATES");
  });
});
