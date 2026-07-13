import { describe, it, expect } from "vitest";
import {
  generateApiKey,
  hashApiKey,
  isValidKeyFormat,
  extractKeyPrefix,
  extractKeyEnvironment,
  safeKeyReference
} from "../src/api-keys.js";

describe("API Keys", () => {
  const hashSecret = "test-secret-key-12345";

  describe("generateApiKey", () => {
    it("should generate a valid live key", () => {
      const key = generateApiKey("live", hashSecret);
      expect(key.environment).toBe("live");
      expect(key.prefix).toBe("vt_live");
      expect(key.fullKey.startsWith("vt_live_")).toBe(true);
      expect(key.fullKey.length).toBeGreaterThan(40);
      expect(key.lastFour).toBe(key.fullKey.slice(-4));
      expect(key.hash).toBe(hashApiKey(key.fullKey, hashSecret));
    });

    it("should generate a valid test key", () => {
      const key = generateApiKey("test", hashSecret);
      expect(key.environment).toBe("test");
      expect(key.prefix).toBe("vt_test");
      expect(key.fullKey.startsWith("vt_test_")).toBe(true);
    });

    it("should throw if hash secret is missing", () => {
      expect(() => generateApiKey("live", "")).toThrow();
    });
  });

  describe("isValidKeyFormat", () => {
    it("should return true for valid formats", () => {
      expect(isValidKeyFormat(generateApiKey("live", hashSecret).fullKey)).toBe(true);
      expect(isValidKeyFormat(generateApiKey("test", hashSecret).fullKey)).toBe(true);
    });

    it("should return false for invalid formats", () => {
      expect(isValidKeyFormat("")).toBe(false);
      expect(isValidKeyFormat("vt_live_short")).toBe(false); // too short
      expect(isValidKeyFormat("rr_invalid_12345678901234567890123456789012")).toBe(false);
      expect(isValidKeyFormat("just_some_random_string_12345678901234567890")).toBe(false);
    });
  });

  describe("extract utilities", () => {
    it("extractKeyPrefix", () => {
      const liveKey = generateApiKey("live", hashSecret).fullKey;
      expect(extractKeyPrefix(liveKey)).toBe("vt_live");

      const testKey = generateApiKey("test", hashSecret).fullKey;
      expect(extractKeyPrefix(testKey)).toBe("vt_test");

      expect(extractKeyPrefix("invalid")).toBeUndefined();
    });

    it("extractKeyEnvironment", () => {
      const liveKey = generateApiKey("live", hashSecret).fullKey;
      expect(extractKeyEnvironment(liveKey)).toBe("live");

      const testKey = generateApiKey("test", hashSecret).fullKey;
      expect(extractKeyEnvironment(testKey)).toBe("test");

      expect(extractKeyEnvironment("invalid")).toBeUndefined();
    });

    it("safeKeyReference", () => {
      const key = generateApiKey("live", hashSecret);
      expect(safeKeyReference(key.fullKey)).toBe(`vt_live_****${key.lastFour}`);
      expect(safeKeyReference("invalid")).toBe("[invalid_format]");
    });
  });
});
