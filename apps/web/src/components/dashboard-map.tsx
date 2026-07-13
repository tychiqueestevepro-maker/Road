"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import type { Camera, Observation, RoadEvent } from "@/lib/api";

const SF_BOUNDS = {
  minLat: 37.68,
  maxLat: 37.84,
  minLon: -122.53,
  maxLon: -122.35
};

const EVENT_MAP_TTL_MS = 5 * 60 * 1000;
const EVENT_MAP_REFRESH_MS = 60 * 1000;
const MAX_EVENT_MARKERS = 100;

type EventMapPoint = {
  event: RoadEvent;
  latitude: number;
  longitude: number;
};

export function DashboardMap({
  events,
  cameras,
  observations
}: {
  events: RoadEvent[];
  cameras: Camera[];
  observations: Observation[];
}) {
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
  const styleUrl =
    process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL ||
    process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
    "mapbox://styles/mapbox/streets-v12";
  const canRenderMap = Boolean(accessToken || !styleUrl.startsWith("mapbox://"));
  const [nowMs, setNowMs] = useState(() => Date.now());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const eventPoints = useMemo(
    () => selectEventMapPoints(events, nowMs),
    [events, nowMs]
  );

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), EVENT_MAP_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!canRenderMap || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = accessToken;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [-122.4558, 37.8012],
      zoom: 12
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-left");
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [accessToken, canRenderMap, styleUrl]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const markers: mapboxgl.Marker[] = [];

    for (const point of eventPoints) {
      markers.push(
        new mapboxgl.Marker({ element: createEventMarker(point) })
          .setLngLat([point.longitude, point.latitude])
          .addTo(map)
      );
    }

    for (const camera of cameras) {
      if (!hasCoordinates(camera)) continue;
      markers.push(
        new mapboxgl.Marker({ element: createCameraMarker(camera) })
          .setLngLat([camera.longitude, camera.latitude])
          .addTo(map)
      );
    }

    for (const observation of observations.slice(0, 100)) {
      if (!hasCoordinates(observation)) continue;
      markers.push(
        new mapboxgl.Marker({ element: createObservationMarker(observation) })
          .setLngLat([observation.longitude, observation.latitude])
          .addTo(map)
      );
    }

    return () => markers.forEach((marker) => marker.remove());
  }, [cameras, eventPoints, observations]);

  if (canRenderMap) {
    return (
      <div className="relative h-full min-h-[520px] w-full">
        <div ref={containerRef} className="h-full min-h-[520px] w-full" />
        <MapOverlay eventCount={eventPoints.length} />
        <MarkerStyles />
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[520px] overflow-hidden bg-[#f8fafc]">
      <div className="absolute inset-0 bg-[linear-gradient(#e2e8f0_1px,transparent_1px),linear-gradient(90deg,#e2e8f0_1px,transparent_1px)] bg-[size:42px_42px] opacity-70" />
      <div className="absolute left-4 top-4 rounded-md border border-[var(--rr-border)] bg-white/95 px-3 py-2 text-xs text-[var(--rr-muted)] shadow-sm">
        SF Bay Area - map style fallback
      </div>
      {eventPoints.map((point) => (
        <Point
          key={point.event.id}
          lat={point.latitude}
          lon={point.longitude}
          className="bg-[var(--rr-blue)] ring-[var(--rr-blue)]/20"
          href={`/events/${point.event.id}`}
          title={markerTitle(point)}
        />
      ))}
      {cameras.map((camera) => (
        <Point
          key={camera.id}
          lat={camera.latitude}
          lon={camera.longitude}
          className="bg-[var(--rr-green)] ring-[var(--rr-green)]/20"
          href={`/cameras/${camera.id}`}
          title={camera.name}
        />
      ))}
      {observations.slice(0, 100).map((observation) => (
        <Point
          key={observation.id}
          lat={observation.latitude}
          lon={observation.longitude}
          className="bg-slate-500 ring-slate-300/60"
          title={observation.roadName ?? "Live observation"}
        />
      ))}
      <MapOverlay eventCount={eventPoints.length} />
      <MarkerStyles />
    </div>
  );
}

function MapOverlay({ eventCount }: { eventCount: number }) {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 max-w-sm rounded-md border border-[var(--rr-border)] bg-white/95 p-3 shadow-sm">
      <div className="text-xs text-[var(--rr-muted)]">Active Layer</div>
      <div className="mt-1 text-sm font-semibold">Blue events - green cameras - gray observations</div>
      <div className="mt-1 text-xs text-[var(--rr-muted)]">
        {eventCount} positioned live event markers. 5 min TTL means map freshness, not real-world reopening.
      </div>
    </div>
  );
}

function Point({
  lat,
  lon,
  className,
  href,
  title
}: {
  lat?: number | null;
  lon?: number | null;
  className: string;
  href?: string;
  title?: string;
}) {
  if (!isValidCoordinate(lat, lon)) return null;
  const props = {
    className: `absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-8 ${href ? "z-10 cursor-pointer transition hover:scale-150" : ""} ${className}`,
    style: position(lat, lon),
    title
  };

  if (href) {
    return <a href={href} aria-label={title ?? "Open map item"} {...props} />;
  }

  return <span {...props} />;
}

function selectEventMapPoints(events: RoadEvent[], nowMs: number): EventMapPoint[] {
  const byRoad = new Map<string, EventMapPoint>();

  for (const event of events) {
    if (!isVisibleDeclaredEvent(event, nowMs)) continue;
    const point = eventPoint(event);
    if (!point) continue;

    const key = normalizeRoadKey(event.roadName ?? event.title ?? event.id);
    const existing = byRoad.get(key);
    if (!existing || eventTimeMs(event) > eventTimeMs(existing.event)) {
      byRoad.set(key, point);
    }
  }

  return [...byRoad.values()]
    .sort((left, right) => eventTimeMs(right.event) - eventTimeMs(left.event))
    .slice(0, MAX_EVENT_MARKERS);
}

function isVisibleDeclaredEvent(event: RoadEvent, nowMs: number) {
  if (!["closed", "partially_closed", "restricted", "planned"].includes(event.declaredStatus)) {
    return false;
  }
  const seenAt = eventTimeMs(event);
  if (!Number.isFinite(seenAt)) return false;
  return nowMs - seenAt <= EVENT_MAP_TTL_MS;
}

function eventPoint(event: RoadEvent): EventMapPoint | undefined {
  if (hasCoordinates(event)) {
    return {
      event,
      latitude: event.latitude,
      longitude: event.longitude
    };
  }

  return undefined;
}

function createEventMarker(point: EventMapPoint) {
  const marker = document.createElement("a");
  marker.className = "declared-event-marker";
  marker.href = `/events/${point.event.id}`;
  marker.title = markerTitle(point);
  marker.setAttribute("aria-label", marker.title);
  return marker;
}

function createCameraMarker(camera: Camera) {
  const marker = document.createElement("a");
  marker.className = "camera-marker";
  marker.href = `/cameras/${camera.id}`;
  marker.title = camera.name;
  marker.setAttribute("aria-label", `Open camera ${camera.name}`);
  return marker;
}

function createObservationMarker(observation: Observation) {
  const marker = document.createElement("span");
  marker.className = "observation-marker";
  marker.title = observation.roadName ?? "Live observation";
  return marker;
}

function markerTitle(point: EventMapPoint) {
  const label = point.event.roadName ?? point.event.title ?? "Traffic event";
  const quality = point.event.locationQuality ? ` - ${point.event.locationQuality}` : "";
  return `${label}${quality}`;
}

function eventTimeMs(event: RoadEvent) {
  const value = event.lastSeenAt ?? event.updatedAt ?? event.createdAt ?? event.firstSeenAt;
  return value ? new Date(value).valueOf() : Number.NaN;
}

function normalizeRoadKey(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

function hasCoordinates<T extends { latitude?: number | null; longitude?: number | null }>(
  value: T
): value is T & { latitude: number; longitude: number } {
  return isValidCoordinate(value.latitude, value.longitude);
}

function isValidCoordinate(lat?: number | null, lon?: number | null) {
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

function position(lat?: number | null, lon?: number | null): React.CSSProperties {
  const x = lon ? ((lon - SF_BOUNDS.minLon) / (SF_BOUNDS.maxLon - SF_BOUNDS.minLon)) * 100 : 50;
  const y = lat ? (1 - (lat - SF_BOUNDS.minLat) / (SF_BOUNDS.maxLat - SF_BOUNDS.minLat)) * 100 : 50;
  return {
    left: `${Math.max(4, Math.min(96, x))}%`,
    top: `${Math.max(4, Math.min(96, y))}%`
  };
}

function MarkerStyles() {
  return (
    <style jsx global>{`
      .declared-event-marker,
      .camera-marker,
      .observation-marker {
        border-radius: 999px;
        cursor: pointer;
        display: block;
      }

      .declared-event-marker {
        width: 18px;
        height: 18px;
        border: 2px solid #ffffff;
        background: #2563eb;
        box-shadow: 0 8px 22px rgba(37, 99, 235, 0.28);
      }

      .camera-marker {
        width: 20px;
        height: 20px;
        border: 2px solid #ffffff;
        background: #16a34a;
        box-shadow: 0 8px 22px rgba(22, 163, 74, 0.28);
      }

      .observation-marker {
        width: 10px;
        height: 10px;
        border: 1px solid #ffffff;
        background: #64748b;
        box-shadow: 0 5px 14px rgba(100, 116, 139, 0.22);
        cursor: default;
      }

      .declared-event-marker:hover,
      .camera-marker:hover {
        transform: scale(1.25);
      }
    `}</style>
  );
}
