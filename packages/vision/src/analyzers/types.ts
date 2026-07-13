export interface DetectedObject {
  label: string;
  confidence: number;
  bbox: [number, number, number, number];
}

export interface VisionAnalysisResult {
  objects: DetectedObject[];
  counts: Record<string, number>;
  metrics: {
    vehicle_count: number;
    person_count: number;
    barrier_count?: number;
    obstruction_score?: number;
  };
  interpretation: {
    observed_state:
      | "normal"
      | "blocked"
      | "possibly_blocked"
      | "low_flow"
      | "congested"
      | "obstruction"
      | "vehicles_stopped"
      | "unknown";
    confidence: number;
    evidence: Record<string, unknown>;
  };
}

export interface VisualAnalyzer {
  analyzerName: string;
  analyze(input: {
    image: Uint8Array;
    mimeType: string;
    metadata?: Record<string, unknown>;
  }): Promise<VisionAnalysisResult>;
}

