import type { CameraProvider } from "./camera-provider.js";
import type { CameraProviderHealth, CameraSourceRegistration } from "./types.js";

export class ManualCameraProvider implements CameraProvider {
  providerName = "manual_camera";

  constructor(private readonly cameras: CameraSourceRegistration[] = []) {}

  async listCameras(): Promise<CameraSourceRegistration[]> {
    return this.cameras.map((camera) => ({
      ...camera,
      provider: "manual_camera",
      active: camera.active ?? true,
      metadata: {
        ...(camera.metadata ?? {}),
        registrationMode: "manual_public_url"
      }
    }));
  }

  async healthCheck(): Promise<CameraProviderHealth> {
    return {
      provider: this.providerName,
      ok: true,
      status: this.cameras.length ? "online" : "demo",
      checkedAt: new Date(),
      message: this.cameras.length
        ? "Manual camera registrations are available"
        : "No manual cameras registered yet"
    };
  }
}

