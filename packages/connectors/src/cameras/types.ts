export interface CameraSourceRegistration {
  id?: string;
  provider: string;
  externalId: string;
  name: string;
  latitude: number;
  longitude: number;
  roadName?: string;
  direction?: string;
  snapshotUrl?: string;
  streamUrl?: string | null;
  active: boolean;
  metadata?: Record<string, unknown>;
}

export interface CameraProviderHealth {
  provider: string;
  ok: boolean;
  status: "online" | "degraded" | "offline" | "demo" | "not_configured";
  message?: string;
  checkedAt: Date;
  details?: Record<string, unknown>;
}

