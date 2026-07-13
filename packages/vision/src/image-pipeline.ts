import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { assertUrlResolvesPublicly } from "./url-safety.js";
import type { VisionAnalysisResult, VisualAnalyzer } from "./analyzers/types.js";

const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static") as string | null;

export interface FetchedImage {
  image: Uint8Array;
  mimeType: string;
  width?: number;
  height?: number;
  hash: string;
  fetchedAt: Date;
  url: string;
}

export async function fetchCameraImage(
  url: string,
  options: { timeoutMs?: number; maxBytes?: number } = {}
): Promise<FetchedImage> {
  const parsed = await assertUrlResolvesPublicly(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10000);

  try {
    const response = await fetch(parsed, { signal: controller.signal });
    if (!response.ok) throw new Error(`image fetch HTTP ${response.status}`);

    const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      throw new Error(`unsupported image MIME type: ${mimeType || "unknown"}`);
    }

    const contentLength = Number.parseInt(response.headers.get("content-length") ?? "0", 10);
    const maxBytes = options.maxBytes ?? 5_000_000;
    if (contentLength > maxBytes) throw new Error("image response is too large");

    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) throw new Error("image body is too large");

    const dimensions = detectImageDimensions(buffer, mimeType);
    if (dimensions.width && dimensions.height) {
      if (dimensions.width < 32 || dimensions.height < 32) {
        throw new Error("image dimensions are too small");
      }
      if (dimensions.width > 5000 || dimensions.height > 5000) {
        throw new Error("image dimensions are too large");
      }
    }

    return {
      image: buffer,
      mimeType,
      ...dimensions,
      hash: hashImage(buffer),
      fetchedAt: new Date(),
      url
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function captureLiveStreamFrame(
  streamUrl: string,
  options: { timeoutMs?: number; maxBytes?: number } = {}
): Promise<FetchedImage> {
  if (!ffmpegPath) throw new Error("ffmpeg binary is not available");

  const parsed = await assertUrlResolvesPublicly(streamUrl);
  const timeoutMs = options.timeoutMs ?? 15000;
  const maxBytes = options.maxBytes ?? 5_000_000;
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-nostdin",
    "-analyzeduration",
    "1000000",
    "-probesize",
    "1000000",
    "-i",
    parsed.toString(),
    "-frames:v",
    "1",
    "-q:v",
    "3",
    "-f",
    "image2pipe",
    "-vcodec",
    "mjpeg",
    "pipe:1"
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    const errors: Buffer[] = [];
    let receivedBytes = 0;
    let settled = false;
    let timeout: NodeJS.Timeout | undefined;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) {
        reject(error);
        return;
      }

      const buffer = Buffer.concat(chunks);
      if (!buffer.byteLength) {
        const stderr = Buffer.concat(errors).toString("utf8").trim();
        reject(new Error(stderr || "ffmpeg did not return a live frame"));
        return;
      }

      const image = new Uint8Array(buffer);
      const dimensions = detectImageDimensions(image, "image/jpeg");
      resolve({
        image,
        mimeType: "image/jpeg",
        ...dimensions,
        hash: hashImage(image),
        fetchedAt: new Date(),
        url: parsed.toString()
      });
    };

    timeout = setTimeout(() => {
      finish(new Error(`live stream frame capture timed out after ${timeoutMs}ms`));
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      receivedBytes += chunk.byteLength;
      if (receivedBytes > maxBytes) {
        finish(new Error("captured live frame is too large"));
        child.kill("SIGKILL");
        return;
      }
      chunks.push(chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      errors.push(chunk);
    });

    child.on("error", (error) => finish(error));
    child.on("close", (code) => {
      if (code === 0) {
        finish();
        return;
      }
      const stderr = Buffer.concat(errors).toString("utf8").trim();
      finish(new Error(stderr || `ffmpeg exited with code ${code ?? "unknown"}`));
    });
  });
}

export async function analyzeFetchedImage(
  analyzer: VisualAnalyzer,
  image: FetchedImage,
  metadata?: Record<string, unknown>
): Promise<VisionAnalysisResult> {
  return analyzer.analyze({
    image: image.image,
    mimeType: image.mimeType,
    metadata
  });
}

export function hashImage(image: Uint8Array): string {
  return createHash("sha256").update(image).digest("hex");
}

export function detectImageDimensions(
  buffer: Uint8Array,
  mimeType: string
): { width?: number; height?: number } {
  if (mimeType === "image/png" && buffer.byteLength >= 24) {
    return {
      width: readUInt32BE(buffer, 16),
      height: readUInt32BE(buffer, 20)
    };
  }

  if (mimeType === "image/jpeg") {
    return readJpegDimensions(buffer);
  }

  return {};
}

function readUInt32BE(buffer: Uint8Array, offset: number) {
  return (
    (byte(buffer, offset) << 24) |
    (byte(buffer, offset + 1) << 16) |
    (byte(buffer, offset + 2) << 8) |
    byte(buffer, offset + 3)
  ) >>> 0;
}

function readJpegDimensions(buffer: Uint8Array): { width?: number; height?: number } {
  let offset = 2;
  while (offset < buffer.byteLength) {
    if (byte(buffer, offset) !== 0xff) break;
    const marker = buffer[offset + 1];
    if (marker === undefined) break;
    const length = (byte(buffer, offset + 2) << 8) + byte(buffer, offset + 3);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: (byte(buffer, offset + 5) << 8) + byte(buffer, offset + 6),
        width: (byte(buffer, offset + 7) << 8) + byte(buffer, offset + 8)
      };
    }
    offset += 2 + length;
  }
  return {};
}

function byte(buffer: Uint8Array, offset: number) {
  return buffer[offset] ?? 0;
}
