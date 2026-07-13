import { z } from "zod";

export const filtersSchema = z.object({
  bbox: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  radius: z.coerce.number().optional(),
  source: z.string().optional(),
  event_type: z.string().optional(),
  severity: z.coerce.number().optional(),
  confidence_min: z.coerce.number().optional(),
  status: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).optional()
});

export const createCameraSchema = z.object({
  external_id: z.string().optional(),
  name: z.string().min(1),
  road_name: z.string().optional(),
  direction: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  snapshot_url: z.string().url().optional(),
  stream_url: z.string().url().optional(),
  active: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional()
});

