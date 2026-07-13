import { describe, expect, it } from "vitest";
import trafficFixture from "./fixtures/sf511-traffic-events.json";
import wzdxFixture from "./fixtures/sf511-wzdx.json";
import datasfFixture from "./fixtures/datasf-closures.json";
import { normalizeTrafficEvent } from "../src/sf511/traffic-events.js";
import { normalizeWzdxRoadEvent } from "../src/sf511/wzdx.js";
import { inferDataSfFieldMap, normalizeDataSfClosure } from "../src/datasf/mappers.js";

describe("connector parsing fixtures", () => {
  it("normalizes 511 Traffic Events closures", () => {
    const event = normalizeTrafficEvent(trafficFixture.Events[0], new Date("2026-07-13T10:00:00Z"));
    expect(event?.source).toBe("sf511_traffic_events");
    expect(event?.declaredState).toBe("closed");
    expect(event?.eventType).toBe("closure");
    expect(event?.rawPayload).toEqual(trafficFixture.Events[0]);
  });

  it("normalizes 511 WZDx road events with geometry-derived coordinates", () => {
    const event = normalizeWzdxRoadEvent(wzdxFixture.road_events[0], new Date("2026-07-13T10:00:00Z"));
    expect(event?.source).toBe("sf511_wzdx");
    expect(event?.declaredState).toBe("closed");
    expect(event?.latitude).toBe(37.82);
    expect(event?.longitude).toBe(-122.37);
  });

  it("normalizes DataSF temporary closures as declared state without treating absence as open", () => {
    const fieldMap = inferDataSfFieldMap(datasfFixture);
    const event = normalizeDataSfClosure(datasfFixture[0], fieldMap, new Date("2026-07-13T10:00:00Z"));
    expect(event?.source).toBe("datasf_temporary_closures");
    expect(event?.declaredState).toBe("closed");
    expect(event?.metadata?.sourceSemantics).toBe("absence_is_unknown_not_open");
  });
});
