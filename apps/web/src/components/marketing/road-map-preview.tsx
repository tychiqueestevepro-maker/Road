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

export type RoadMapPreviewProps = {
  mode: "developer-hero" | "dashboard";
  showCameras?: boolean;
  showDiscrepancies?: boolean;
  showTraffic?: boolean;
  interactive?: boolean;
  events?: RoadEvent[];
  cameras?: Camera[];
  observations?: Observation[];
};

export function RoadMapPreview({
  mode = "developer-hero",
  showCameras = true,
  showDiscrepancies = true,
  showTraffic = true,
  interactive = true,
  events = [],
  cameras = [],
  observations = []
}: RoadMapPreviewProps) {
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
  // Light style preferred for developer-hero
  const lightStyle = "mapbox://styles/mapbox/light-v11";
  const styleUrl = mode === "developer-hero" ? lightStyle : (process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL || lightStyle);
  
  const canRenderMap = Boolean(accessToken || !styleUrl.startsWith("mapbox://"));
  const [nowMs, setNowMs] = useState(() => Date.now());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), EVENT_MAP_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  const dedupedEvents = useMemo(
    () => selectEventMapPoints(events, nowMs),
    [events, nowMs]
  );

  useEffect(() => {
    if (!canRenderMap || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = accessToken;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [-122.4558, 37.8012], // Centered near Halleck Street/SF
      zoom: 13,
      pitch: 45, // Slightly tilted
      bearing: -10, // Subtle bearing
      interactive: interactive,
      cooperativeGestures: mode === "developer-hero",
      attributionControl: false
    });
    
    if (interactive) {
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-left");
    }
    mapRef.current = map;

    map.on('load', () => {
      // Add traffic if needed (requires Mapbox Traffic v1 plugin or layer, assuming mapbox light has some basic styling we can rely on or we add it)
      // For developer-hero, we can just highlight a road segment to simulate a signal
      if (showTraffic && map.getSource('composite')) {
        // Optional: styling tweaks for light map to emphasize roads
      }
    });

    const updateZoomScale = () => {
      const zoom = map.getZoom();
      // Base zoom is 13. Scale down as we zoom out. 
      // e.g. zoom 13 = 1.0, zoom 10 = ~0.6, zoom 16 = ~1.4
      const scale = Math.max(0.4, Math.min(1.5, Math.pow(1.2, zoom - 13)));
      if (containerRef.current) {
        containerRef.current.style.setProperty('--marker-scale', scale.toString());
      }
    };

    map.on('zoom', updateZoomScale);
    // Initial call
    updateZoomScale();

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [accessToken, canRenderMap, styleUrl, interactive, showTraffic]);

  // Maintain marker references to prevent bouncing/animation reset
  const markerDictRef = useRef<{ [key: string]: mapboxgl.Marker }>({});

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const currentDict = markerDictRef.current;
    const newKeys = new Set<string>();

    // Cameras
    if (showCameras) {
      const cams = cameras.length > 0 ? cameras : [
        { id: "cam-1", latitude: 37.802, longitude: -122.454, name: "SF Cam 1" } as any,
        { id: "cam-2", latitude: 37.798, longitude: -122.458, name: "SF Cam 2" } as any
      ];
      
      for (const camera of cams) {
        if (!camera.latitude || !camera.longitude) continue;
        const key = `cam-${camera.id}`;
        newKeys.add(key);
        
        if (currentDict[key]) {
          currentDict[key].setLngLat([camera.longitude, camera.latitude]);
        } else {
          const wrapper = document.createElement('div');
          wrapper.className = "marker-scaler";
          wrapper.innerHTML = `
            <div class="camera-marker-light">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>
            </div>
          `;
          currentDict[key] = new mapboxgl.Marker({ element: wrapper })
            .setLngLat([camera.longitude, camera.latitude])
            .addTo(map);
        }
      }
    }

    // Discrepancies
    if (showDiscrepancies) {
      const evs = dedupedEvents.length > 0 ? dedupedEvents : [
        { id: "disc_demo", latitude: 37.801, longitude: -122.456, title: "Halleck Street" } as any
      ];

      for (const event of evs) {
        if (!event.latitude || !event.longitude) continue;
        const key = `ev-${event.id}`;
        newKeys.add(key);
        
        if (currentDict[key]) {
          currentDict[key].setLngLat([event.longitude, event.latitude]);
        } else {
          const wrapper = document.createElement('div');
          wrapper.className = "marker-scaler";
          wrapper.innerHTML = `
            <div class="discrepancy-marker-pulsing">
              <div class="ring-outer"></div>
              <div class="ring-inner"></div>
              <div class="core"></div>
            </div>
          `;
          currentDict[key] = new mapboxgl.Marker({ element: wrapper })
            .setLngLat([event.longitude, event.latitude])
            .addTo(map);
        }
      }
    }

    // Remove old markers
    for (const key of Object.keys(currentDict)) {
      if (!newKeys.has(key)) {
        currentDict[key]?.remove();
        delete currentDict[key];
      }
    }

    // Do NOT return a cleanup function that removes all markers here,
    // otherwise they will all be removed on unmount/re-render.
    // The unmount cleanup is handled in the map init useEffect.
  }, [cameras, dedupedEvents, showCameras, showDiscrepancies]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[14px] bg-slate-50 border border-slate-200 shadow-sm">
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-md border border-slate-200 bg-white/95 px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm backdrop-blur-sm">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
        </span>
        LIVE ROAD STATE
        <span className="text-slate-400 ml-1 font-normal">Updated 12s ago</span>
      </div>

      <div ref={containerRef} className="h-full w-full min-h-[400px] md:min-h-[500px]" />
      
      <MarkerStyles />
    </div>
  );
}

function MarkerStyles() {
  return (
    <style jsx global>{`
      .mapboxgl-ctrl-logo, .mapboxgl-ctrl-attrib {
        display: none !important;
      }
      .mapboxgl-canvas {
        filter: grayscale(100%);
      }
      .marker-scaler {
        transform: scale(var(--marker-scale, 1));
        transform-origin: center;
        transition: transform 0.1s ease-out;
      }
      .camera-marker-light {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: #ffffff;
        border: 2px solid #0866FF;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #0866FF;
        box-shadow: 0 4px 12px rgba(8, 102, 255, 0.15);
        cursor: pointer;
      }
      .camera-marker-light:hover {
        transform: scale(1.1);
        transition: transform 0.2s ease;
      }
      
      .discrepancy-marker-pulsing {
        width: 24px;
        height: 24px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .discrepancy-marker-pulsing .core {
        width: 14px;
        height: 14px;
        background: #0866FF;
        border-radius: 50%;
        border: 2px solid #ffffff;
        z-index: 3;
        box-shadow: 0 2px 8px rgba(8, 102, 255, 0.4);
      }
      .discrepancy-marker-pulsing .ring-inner,
      .discrepancy-marker-pulsing .ring-outer {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        border-radius: 50%;
        background: rgba(8, 102, 255, 0.2);
        z-index: 1;
      }
      .discrepancy-marker-pulsing .ring-inner {
        width: 100%;
        height: 100%;
        animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
      }
      .discrepancy-marker-pulsing .ring-outer {
        width: 150%;
        height: 150%;
        background: rgba(8, 102, 255, 0.1);
        animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite 0.5s;
      }
      
      @keyframes pulse-ring {
        0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
      }
    `}</style>
  );
}

function eventTimeMs(event: RoadEvent) {
  const value = event.lastSeenAt ?? event.updatedAt ?? event.createdAt ?? event.firstSeenAt;
  return value ? new Date(value).valueOf() : Number.NaN;
}

function normalizeRoadKey(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

function selectEventMapPoints(events: RoadEvent[], nowMs: number) {
  const byRoad = new Map<string, RoadEvent>();

  for (const event of events) {
    if (!["closed", "partially_closed", "restricted", "planned"].includes(event.declaredStatus)) continue;
    const seenAt = eventTimeMs(event);
    if (!Number.isFinite(seenAt) || nowMs - seenAt > EVENT_MAP_TTL_MS) continue;
    if (!event.latitude || !event.longitude) continue;

    const key = normalizeRoadKey(event.roadName ?? event.title ?? event.id);
    const existing = byRoad.get(key);
    if (!existing || eventTimeMs(event) > eventTimeMs(existing)) {
      byRoad.set(key, event);
    }
  }

  return [...byRoad.values()].sort((left, right) => eventTimeMs(right) - eventTimeMs(left)).slice(0, 100);
}
