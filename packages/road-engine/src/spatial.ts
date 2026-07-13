import type { GeoPoint } from "@road-reality/shared";
import { streetNamesProbablyMatch } from "@road-reality/shared";

export function haversineDistanceMeters(left: GeoPoint, right: GeoPoint): number {
  const earthRadiusMeters = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(right.latitude - left.latitude);
  const dLon = toRadians(right.longitude - left.longitude);
  const lat1 = toRadians(left.latitude);
  const lat2 = toRadians(right.latitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getPoint(value: {
  latitude?: number | null;
  longitude?: number | null;
}): GeoPoint | undefined {
  if (
    typeof value.latitude === "number" &&
    Number.isFinite(value.latitude) &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.longitude)
  ) {
    return {
      latitude: value.latitude,
      longitude: value.longitude
    };
  }
  return undefined;
}

export function recordsSpatiallyMatch(
  left: { latitude?: number | null; longitude?: number | null; roadName?: string | null },
  right: { latitude?: number | null; longitude?: number | null; roadName?: string | null },
  radiusMeters: number
): boolean {
  const leftPoint = getPoint(left);
  const rightPoint = getPoint(right);
  if (leftPoint && rightPoint) {
    return haversineDistanceMeters(leftPoint, rightPoint) <= radiusMeters;
  }

  return streetNamesProbablyMatch(left.roadName, right.roadName);
}

