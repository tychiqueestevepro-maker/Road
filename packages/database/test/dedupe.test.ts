import { describe, expect, it } from "vitest";
import { buildRawRecordHash, shouldAnalyzeSnapshot } from "../src/dedupe.js";

describe("database dedupe helpers", () => {
  it("generates the same raw record hash for equivalent payloads", () => {
    const left = buildRawRecordHash("abc", { b: 2, a: 1 });
    const right = buildRawRecordHash("abc", { a: 1, b: 2 });
    expect(left).toBe(right);
  });

  it("prevents duplicate camera snapshots from being repeatedly analyzed", () => {
    expect(shouldAnalyzeSnapshot("same-image", "same-image")).toBe(false);
    expect(shouldAnalyzeSnapshot("old-image", "new-image")).toBe(true);
  });
});

