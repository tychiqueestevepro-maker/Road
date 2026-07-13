import { createHash } from "node:crypto";
import type { VisionAnalysisResult, VisualAnalyzer } from "./types.js";

export class MockVisualAnalyzer implements VisualAnalyzer {
  analyzerName = "mock_visual_analyzer";

  async analyze(input: {
    image: Uint8Array;
    mimeType: string;
    metadata?: Record<string, unknown>;
  }): Promise<VisionAnalysisResult> {
    const scenario = String(input.metadata?.scenario ?? "");
    const hash = createHash("sha256").update(input.image).digest("hex");
    const seed = Number.parseInt(hash.slice(0, 2), 16);

    if (scenario.includes("blocked") || scenario.includes("barrier")) {
      return {
        objects: [
          { label: "barrier", confidence: 0.82, bbox: [80, 140, 360, 210] },
          { label: "car", confidence: 0.73, bbox: [400, 120, 510, 190] }
        ],
        counts: { barrier: 1, car: 1 },
        metrics: {
          vehicle_count: 1,
          person_count: 0,
          barrier_count: 1,
          obstruction_score: 0.82
        },
        interpretation: {
          observed_state: "possibly_blocked",
          confidence: 0.82,
          evidence: {
            barrier_detected: true,
            demo_model: true,
            hash
          }
        }
      };
    }

    const vehicleCount = 3 + (seed % 9);
    return {
      objects: Array.from({ length: vehicleCount }, (_, index) => ({
        label: "car",
        confidence: 0.65,
        bbox: [20 + index * 15, 120, 70 + index * 15, 170] as [number, number, number, number]
      })),
      counts: { car: vehicleCount },
      metrics: {
        vehicle_count: vehicleCount,
        person_count: 0,
        obstruction_score: 0
      },
      interpretation: {
        observed_state: vehicleCount > 7 ? "congested" : "normal",
        confidence: 0.65,
        evidence: {
          vehicle_count: vehicleCount,
          demo_model: true,
          hash
        }
      }
    };
  }
}

