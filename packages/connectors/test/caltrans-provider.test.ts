import { describe, expect, it } from "vitest";
import { normalizeCaltransCamera } from "../src/cameras/caltrans-provider.js";

describe("Caltrans CWWP2 camera normalization", () => {
  it("maps District 4 public CCTV records to camera registrations", () => {
    const camera = normalizeCaltransCamera({
      index: "36",
      recordTimestamp: {
        recordDate: "2026-01-16",
        recordTime: "09:54:44",
        recordEpoch: "1768586084"
      },
      location: {
        district: "4",
        locationName: "TV304 -- I-80 : US-101",
        nearbyPlace: "San Francisco",
        longitude: "-122.40554",
        latitude: "37.77025",
        direction: "East",
        county: "San Francisco",
        route: "I-80"
      },
      inService: "true",
      imageData: {
        imageDescription: "",
        streamingVideoURL: "https://wzmedia.dot.ca.gov/D4/E80_at_JCT_101.stream/playlist.m3u8",
        static: {
          currentImageUpdateFrequency: "5",
          currentImageURL:
            "https://cwwp2.dot.ca.gov/data/d4/cctv/image/tv304i80us101/tv304i80us101.jpg",
          referenceImageUpdateFrequency: "60"
        }
      }
    });

    expect(camera?.externalId).toBe("caltrans:d4:36");
    expect(camera?.provider).toBe("caltrans_camera");
    expect(camera?.roadName).toBe("I-80");
    expect(camera?.streamUrl).toContain("playlist.m3u8");
    expect(camera?.snapshotUrl).toContain("tv304i80us101.jpg");
    expect(camera?.metadata?.current_image_update_frequency_minutes).toBe(5);
    expect(camera?.metadata?.camera_page_url).toBe(
      "https://cwwp2.dot.ca.gov/vm/loc/d4/tv304i80us101.htm"
    );
  });
});
