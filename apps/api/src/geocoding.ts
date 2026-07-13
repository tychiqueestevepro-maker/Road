import type { RoadEvent } from "@road-reality/database";

const SF_BOUNDS = {
  minLat: 37.68,
  maxLat: 37.84,
  minLon: -122.53,
  maxLon: -122.35
};

const SF_BBOX = `${SF_BOUNDS.minLon},${SF_BOUNDS.minLat},${SF_BOUNDS.maxLon},${SF_BOUNDS.maxLat}`;
const DEFAULT_DISPLAY_TTL_SECONDS = 5 * 60;

export type LocationQuality =
  | "official_coordinates"
  | "geocoded_address"
  | "geocoded_street_center"
  | "street_only"
  | "unpositioned";

export type VehicleAction = "proceed" | "slow_verify" | "avoid" | "operator_review";

export type EnrichedRoadEvent = RoadEvent & {
  locationQuality: LocationQuality;
  locationSource: string;
  vehicleUsable: boolean;
  locationWarning?: string;
  displayTtlSeconds: number;
  mapExpiresAt: string | null;
  realWorldState: "not_asserted_resolved";
};

type GeocodeResult = {
  latitude: number;
  longitude: number;
  quality: Extract<LocationQuality, "geocoded_address" | "geocoded_street_center">;
  source: string;
  warning: string;
};

type CacheEntry = {
  expiresAt: number;
  result: GeocodeResult | null;
};

const geocodeCache = new Map<string, CacheEntry>();

export async function enrichEventsForDisplay(events: RoadEvent[]): Promise<EnrichedRoadEvent[]> {
  const config = geocodingConfig();
  let geocodeAttempts = 0;

  return Promise.all(
    events.map(async (event) => {
      const base = enrichKnownLocation(event, config.displayTtlSeconds);
      if (base.vehicleUsable || !config.enabled || geocodeAttempts >= config.maxEventsPerResponse) {
        return base;
      }

      if (!event.roadName && !event.title) return base;
      geocodeAttempts += 1;

      const result = await geocodeEvent(event, config);
      if (!result) return base;

      return {
        ...base,
        latitude: result.latitude,
        longitude: result.longitude,
        locationQuality: result.quality,
        locationSource: result.source,
        vehicleUsable: isVehicleUsableLocation(result.quality),
        locationWarning: result.warning
      };
    })
  );
}

export function enrichKnownLocation(
  event: RoadEvent,
  displayTtlSeconds = liveEventDisplayTtlSeconds()
): EnrichedRoadEvent {
  const hasOfficialCoordinates = isValidCoordinate(event.latitude, event.longitude);
  const hasStreet = Boolean(event.roadName ?? event.title);

  return {
    ...event,
    locationQuality: hasOfficialCoordinates ? "official_coordinates" : hasStreet ? "street_only" : "unpositioned",
    locationSource: hasOfficialCoordinates ? "source_coordinates" : "source_text",
    vehicleUsable: hasOfficialCoordinates,
    locationWarning: hasOfficialCoordinates
      ? undefined
      : hasStreet
        ? "Street-only events are display hints, not vehicle-grade positions."
        : "No reliable event location is available.",
    displayTtlSeconds,
    mapExpiresAt: mapExpiresAt(event, displayTtlSeconds),
    realWorldState: "not_asserted_resolved"
  };
}

export function serializePublicEvent(event: EnrichedRoadEvent) {
  return {
    id: event.id,
    event_type: event.eventType,
    title: event.title,
    description: event.description,
    road_name: event.roadName,
    direction: event.direction,
    severity: event.severity,
    declared_status: event.declaredStatus,
    location: {
      latitude: event.latitude,
      longitude: event.longitude,
      quality: event.locationQuality,
      source: event.locationSource,
      vehicle_usable: event.vehicleUsable,
      warning: event.locationWarning ?? null
    },
    display_lifecycle: {
      live_map_ttl_seconds: event.displayTtlSeconds,
      map_expires_at: event.mapExpiresAt,
      removal_meaning: "not_fresh_enough_for_live_map_not_confirmed_resolved"
    },
    start_time: event.startTime?.toISOString() ?? null,
    end_time: event.endTime?.toISOString() ?? null,
    first_seen_at: event.firstSeenAt?.toISOString(),
    last_seen_at: event.lastSeenAt?.toISOString()
  };
}

export function isVehicleUsableLocation(quality: LocationQuality) {
  return quality === "official_coordinates" || quality === "geocoded_address";
}

export function liveEventDisplayTtlSeconds() {
  return positiveNumber(process.env.LIVE_EVENT_DISPLAY_TTL_SECONDS, DEFAULT_DISPLAY_TTL_SECONDS);
}

export function eventTimeMs(event: Pick<RoadEvent, "lastSeenAt" | "updatedAt" | "createdAt" | "firstSeenAt">) {
  return (
    event.lastSeenAt?.valueOf() ??
    event.updatedAt?.valueOf() ??
    event.createdAt?.valueOf() ??
    event.firstSeenAt?.valueOf() ??
    Number.NaN
  );
}

export function distanceMeters(
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number }
) {
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(right.latitude - left.latitude);
  const dLon = toRadians(right.longitude - left.longitude);
  const lat1 = toRadians(left.latitude);
  const lat2 = toRadians(right.latitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function geocodingConfig() {
  const serverToken = process.env.MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
  const permanent = process.env.MAPBOX_GEOCODING_PERMANENT === "true";
  return {
    enabled: process.env.MAPBOX_GEOCODING_ENABLED !== "false" && Boolean(serverToken),
    token: serverToken,
    permanent,
    maxEventsPerResponse: positiveNumber(process.env.MAPBOX_GEOCODING_MAX_EVENTS_PER_RESPONSE, 20),
    displayTtlSeconds: liveEventDisplayTtlSeconds(),
    cacheSeconds: permanent ? positiveNumber(process.env.MAPBOX_GEOCODING_CACHE_SECONDS, 3600) : 0
  };
}

async function geocodeEvent(
  event: RoadEvent,
  config: ReturnType<typeof geocodingConfig>
): Promise<GeocodeResult | null> {
  const query = geocodeQuery(event);
  if (!query) return null;

  const cacheKey = `${query}|${config.permanent ? "permanent" : "temporary"}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", query);
  url.searchParams.set("access_token", config.token);
  url.searchParams.set("country", "us");
  url.searchParams.set("bbox", SF_BBOX);
  url.searchParams.set("types", "address,street");
  url.searchParams.set("limit", "1");
  url.searchParams.set("autocomplete", "false");
  if (config.permanent) url.searchParams.set("permanent", "true");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return null;

    const body = (await response.json()) as {
      features?: Array<{
        geometry?: { coordinates?: unknown };
        properties?: { feature_type?: string };
      }>;
    };
    const feature = body.features?.[0];
    const coordinates = feature?.geometry?.coordinates;
    if (!Array.isArray(coordinates)) return null;

    const longitude = Number(coordinates[0]);
    const latitude = Number(coordinates[1]);
    if (!isValidCoordinate(latitude, longitude)) return null;

    const featureType = feature?.properties?.feature_type;
    const quality = featureType === "address" ? "geocoded_address" : "geocoded_street_center";
    const result: GeocodeResult = {
      latitude,
      longitude,
      quality,
      source: "mapbox_geocoding",
      warning:
        quality === "geocoded_address"
          ? "Geocoded address result. Verify before safety-critical use."
          : "Street-center geocode is approximate and not vehicle-grade."
    };

    if (config.cacheSeconds > 0) {
      geocodeCache.set(cacheKey, {
        expiresAt: Date.now() + config.cacheSeconds * 1000,
        result
      });
    }
    return result;
  } catch {
    return null;
  }
}

function geocodeQuery(event: RoadEvent) {
  const road = (event.roadName ?? event.title ?? "").trim();
  if (!road) return undefined;
  if (road.split(/\s+/).length > 12) return undefined;
  return `${road}, San Francisco, CA, United States`;
}

function mapExpiresAt(event: RoadEvent, ttlSeconds: number) {
  const seenAt = eventTimeMs(event);
  if (!Number.isFinite(seenAt)) return null;
  return new Date(seenAt + ttlSeconds * 1000).toISOString();
}

function isValidCoordinate(lat?: number | null, lon?: number | null): lat is number {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= SF_BOUNDS.minLat &&
    lat <= SF_BOUNDS.maxLat &&
    lon >= SF_BOUNDS.minLon &&
    lon <= SF_BOUNDS.maxLon
  );
}

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
