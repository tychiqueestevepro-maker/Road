import type { VisionAnalysisResult, VisualAnalyzer } from "./types.js";

export class ObjectDetectorAnalyzer implements VisualAnalyzer {
  analyzerName = "local_object_detector";

  constructor(
    private readonly options: {
      serviceUrl: string;
      timeoutMs?: number;
    }
  ) {}

  async analyze(input: {
    image: Uint8Array;
    mimeType: string;
    metadata?: Record<string, unknown>;
  }): Promise<VisionAnalysisResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 15000);
    try {
      const form = new FormData();
      const imageBuffer = input.image.buffer.slice(
        input.image.byteOffset,
        input.image.byteOffset + input.image.byteLength
      ) as ArrayBuffer;
      form.set("image", new Blob([imageBuffer], { type: input.mimeType }), "snapshot");
      if (input.metadata) form.set("metadata", JSON.stringify(input.metadata));

      const response = await fetch(new URL("/analyze", this.options.serviceUrl), {
        method: "POST",
        body: form,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`vision service HTTP ${response.status}: ${await response.text()}`);
      }
      return (await response.json()) as VisionAnalysisResult;
    } finally {
      clearTimeout(timeout);
    }
  }
}
