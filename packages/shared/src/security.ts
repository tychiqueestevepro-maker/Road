import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const forbiddenHosts = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal"
]);

function isPrivateIPv4(host: string): boolean {
  const parts = host.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [a = 0, b = 0] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 0
  );
}

function isPrivateIPv6(host: string): boolean {
  const normalized = host.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

export function validatePublicHttpUrl(value: string): URL {
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http and https URLs are allowed");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    forbiddenHosts.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname === "169.254.169.254"
  ) {
    throw new Error("Local or metadata URLs are not allowed");
  }

  const ipVersion = isIP(hostname);
  if (ipVersion === 4 && isPrivateIPv4(hostname)) {
    throw new Error("Private IPv4 URLs are not allowed");
  }
  if (ipVersion === 6 && isPrivateIPv6(hostname)) {
    throw new Error("Private IPv6 URLs are not allowed");
  }

  return parsed;
}

export async function assertUrlResolvesPublicly(value: string): Promise<URL> {
  const parsed = validatePublicHttpUrl(value);
  const records = await lookup(parsed.hostname, { all: true, verbatim: true });
  for (const record of records) {
    if (record.family === 4 && isPrivateIPv4(record.address)) {
      throw new Error("URL resolves to a private IPv4 address");
    }
    if (record.family === 6 && isPrivateIPv6(record.address)) {
      throw new Error("URL resolves to a private IPv6 address");
    }
  }
  return parsed;
}

