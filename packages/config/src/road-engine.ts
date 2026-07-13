import { z } from "zod";

export const roadEngineConfigSchema = z.object({
  matchRadiusMeters: z.coerce.number().positive().default(100),
  cameraObservationStaleSeconds: z.coerce.number().positive().default(120),
  trafficObservationStaleSeconds: z.coerce.number().positive().default(300),
  discrepancyMinScore: z.coerce.number().min(0).max(1).default(0.7)
});

export type RoadEngineConfig = z.infer<typeof roadEngineConfigSchema>;

export const defaultRoadEngineConfig: RoadEngineConfig = {
  matchRadiusMeters: 100,
  cameraObservationStaleSeconds: 120,
  trafficObservationStaleSeconds: 300,
  discrepancyMinScore: 0.7
};

export function loadRoadEngineConfig(
  env: NodeJS.ProcessEnv = process.env
): RoadEngineConfig {
  return roadEngineConfigSchema.parse({
    matchRadiusMeters: env.ROAD_EVENT_MATCH_RADIUS_METERS,
    cameraObservationStaleSeconds: env.CAMERA_OBSERVATION_STALE_SECONDS,
    trafficObservationStaleSeconds: env.TRAFFIC_OBSERVATION_STALE_SECONDS,
    discrepancyMinScore: env.DISCREPANCY_MIN_SCORE
  });
}

