import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const KEY_BYTE_LENGTH = 32;
const PREFIX_LIVE = "vt_live";
const PREFIX_TEST = "vt_test";
const VALID_PREFIXES = [PREFIX_LIVE, PREFIX_TEST] as const;
const KEY_REGEX = /^vt_(live|test)_[A-Za-z0-9_-]{32,}$/;

export type ApiKeyEnvironment = "live" | "test";

export interface GeneratedApiKey {
  /** The full API key — only exists during generation and email delivery. */
  fullKey: string;
  /** The prefix portion (e.g. "vt_live"). */
  prefix: string;
  /** HMAC-SHA-256 hash of the full key. */
  hash: string;
  /** Last four characters of the full key. */
  lastFour: string;
  /** "live" or "test". */
  environment: ApiKeyEnvironment;
}

// ---------------------------------------------------------------------------
// Key Generation
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically secure API key.
 *
 * Format: vt_live_<base64url random>  or  vt_test_<base64url random>
 *
 * The full key only exists transiently — callers must hash it before storage.
 */
export function generateApiKey(
  environment: ApiKeyEnvironment = "live",
  hashSecret: string
): GeneratedApiKey {
  if (!hashSecret) {
    throw new Error("API_KEY_HASH_SECRET is required for key generation");
  }

  const prefix = environment === "test" ? PREFIX_TEST : PREFIX_LIVE;
  const randomBytes = crypto.randomBytes(KEY_BYTE_LENGTH);
  const secret = randomBytes.toString("base64url");
  const fullKey = `${prefix}_${secret}`;
  const hash = hashApiKey(fullKey, hashSecret);
  const lastFour = fullKey.slice(-4);

  return { fullKey, prefix, hash, lastFour, environment };
}

// ---------------------------------------------------------------------------
// Key Hashing
// ---------------------------------------------------------------------------

/**
 * Compute HMAC-SHA-256 of a full API key using the server-side hash secret.
 */
export function hashApiKey(fullKey: string, hashSecret: string): string {
  return crypto
    .createHmac("sha256", hashSecret)
    .update(fullKey)
    .digest("hex");
}

// ---------------------------------------------------------------------------
// Key Format Validation
// ---------------------------------------------------------------------------

/**
 * Validate that a string looks like a Verytis API key.
 */
export function isValidKeyFormat(key: string): boolean {
  return KEY_REGEX.test(key);
}

/**
 * Extract the prefix from an API key string.
 * Returns undefined if the format is invalid.
 */
export function extractKeyPrefix(key: string): string | undefined {
  if (!isValidKeyFormat(key)) return undefined;
  const idx = key.indexOf("_", 3); // skip "vt_"
  if (idx === -1) return undefined;
  return key.slice(0, idx);
}

/**
 * Extract the environment from an API key string.
 */
export function extractKeyEnvironment(key: string): ApiKeyEnvironment | undefined {
  const prefix = extractKeyPrefix(key);
  if (prefix === PREFIX_LIVE) return "live";
  if (prefix === PREFIX_TEST) return "test";
  return undefined;
}

/**
 * Safely represent a key for logging: prefix + last four only.
 */
export function safeKeyReference(key: string): string {
  const prefix = extractKeyPrefix(key);
  if (!prefix) return "[invalid_format]";
  const lastFour = key.slice(-4);
  return `${prefix}_****${lastFour}`;
}
