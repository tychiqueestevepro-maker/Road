import type { CameraProviderHealth, CameraSourceRegistration } from "./types.js";

export interface CameraProvider {
  providerName: string;
  listCameras(): Promise<CameraSourceRegistration[]>;
  healthCheck(): Promise<CameraProviderHealth>;
}

