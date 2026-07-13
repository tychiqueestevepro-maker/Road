"use client";

import React, { useEffect, useMemo, useState } from "react";
import { DeveloperHeader } from "@/components/marketing/developer-header";
import { useLiveRoadData } from "@/lib/use-live-road-data";
import { RoadMapPreview } from "@/components/marketing/road-map-preview";
import { API_URL } from "@/lib/api";

type ServiceStatus = "operational" | "degraded" | "offline";

type EndpointProbe = {
  label: string;
  method: "GET";
  path: string;
  displayPath: string;
  status: ServiceStatus;
  latencyMs?: number;
  checkedAt?: string;
  error?: string;
};

const endpointChecks: Array<Pick<EndpointProbe, "label" | "method" | "path" | "displayPath">> = [
  { label: "API health", method: "GET", path: "/health", displayPath: "/health" },
  { label: "Metrics", method: "GET", path: "/metrics", displayPath: "/metrics" },
  { label: "Live state", method: "GET", path: "/api/v1/live/state", displayPath: "/v1/live/state" },
  { label: "Events", method: "GET", path: "/api/v1/events?limit=1", displayPath: "/v1/events" },
  { label: "Cameras", method: "GET", path: "/api/v1/cameras", displayPath: "/v1/cameras" },
  { label: "Sources", method: "GET", path: "/api/v1/connectors", displayPath: "/v1/connectors" }
];

export default function StatusPage() {
  const { data, status } = useLiveRoadData();
  const endpoints = useEndpointProbes();
  const routeSummary = summarizeEndpointStatus(endpoints);
  const connectorSummary = summarizeConnectors(data?.metrics.connectors_online, data?.metrics.connectors_total);
  const visionSummary = useMemo(() => summarizeVision(data), [data]);
  const ingestionSummary = summarizeIngestion(data?.metrics.last_ingestion_at);
  
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      <DeveloperHeader />

      <main className="flex min-h-0 flex-1 p-6 gap-6 bg-slate-50">
        <div className="flex-1 rounded-[14px] overflow-hidden border border-slate-200 shadow-sm bg-white">
          <RoadMapPreview 
            mode="dashboard"
            interactive={true}
            events={data?.events ?? []} 
            cameras={data?.cameras ?? []} 
            observations={data?.observations ?? []} 
          />
        </div>
        
        <div className="w-[360px] shrink-0 hidden lg:flex flex-col gap-4">
          <div className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-[14px] font-semibold text-slate-900 mb-4 uppercase tracking-wider">
              API Route Status
            </h2>
            
            <div className="flex flex-col gap-4">
              {endpoints.map((endpoint) => (
                <RouteStatus
                  key={endpoint.path}
                  method={endpoint.method}
                  path={endpoint.displayPath}
                  status={endpoint.status}
                  detail={formatEndpointDetail(endpoint)}
                />
              ))}
            </div>
          </div>

          <div className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm flex-1">
            <h2 className="text-[14px] font-semibold text-slate-900 mb-4 uppercase tracking-wider">
              System Health
            </h2>
            <div className="flex flex-col gap-4">
              <HealthRow label="API routes" status={routeSummary.status} detail={routeSummary.detail} />
              <HealthRow label="Realtime stream" status={mapLiveStatus(status)} detail={status} />
              <HealthRow label="Source connectors" status={connectorSummary.status} detail={connectorSummary.detail} />
              <HealthRow label="Vision inference" status={visionSummary.status} detail={visionSummary.detail} />
              <HealthRow label="Ingestion engine" status={ingestionSummary.status} detail={ingestionSummary.detail} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function useEndpointProbes() {
  const [probes, setProbes] = useState<EndpointProbe[]>(
    endpointChecks.map((check) => ({ ...check, status: "degraded" }))
  );

  useEffect(() => {
    let mounted = true;

    const runChecks = async () => {
      const next = await Promise.all(endpointChecks.map(checkEndpoint));
      if (mounted) setProbes(next);
    };

    void runChecks();
    const interval = setInterval(runChecks, 15000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return probes;
}

async function checkEndpoint(
  check: Pick<EndpointProbe, "label" | "method" | "path" | "displayPath">
): Promise<EndpointProbe> {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${API_URL}${check.path}`, {
      method: check.method,
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: controller.signal
    });
    const latencyMs = Math.round(performance.now() - startedAt);
    return {
      ...check,
      status: response.ok ? "operational" : response.status >= 500 ? "offline" : "degraded",
      latencyMs,
      checkedAt: new Date().toISOString(),
      error: response.ok ? undefined : `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      ...check,
      status: "offline",
      latencyMs: Math.round(performance.now() - startedAt),
      checkedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Request failed"
    };
  } finally {
    clearTimeout(timeout);
  }
}

function RouteStatus({
  method,
  path,
  status,
  detail
}: {
  method: string;
  path: string;
  status: ServiceStatus;
  detail: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
            {method}
          </span>
          <span className="truncate text-[12px] font-mono text-slate-700">
            {path}
          </span>
        </div>
        <div className="mt-1 truncate text-[11px] text-slate-400">{detail}</div>
      </div>
      <ServiceBadge status={status} />
    </div>
  );
}

function HealthRow({ label, status, detail }: { label: string; status: ServiceStatus; detail: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-[13px] text-slate-600">{label}</div>
        <div className="mt-1 truncate text-[11px] text-slate-400">{detail}</div>
      </div>
      <ServiceBadge status={status} />
    </div>
  );
}

function ServiceBadge({ status }: { status: ServiceStatus }) {
  if (status === "operational") {
    return (
      <span className="shrink-0 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
        Operational
      </span>
    );
  }
  if (status === "degraded") {
    return (
      <span className="shrink-0 text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
        Degraded
      </span>
    );
  }
  return (
    <span className="shrink-0 text-[11px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">
      Offline
    </span>
  );
}

function formatEndpointDetail(endpoint: EndpointProbe) {
  if (endpoint.error) return endpoint.error;
  if (typeof endpoint.latencyMs === "number") return `${endpoint.latencyMs} ms`;
  return "checking";
}

function summarizeEndpointStatus(endpoints: EndpointProbe[]) {
  const offline = endpoints.filter((endpoint) => endpoint.status === "offline").length;
  const degraded = endpoints.filter((endpoint) => endpoint.status === "degraded").length;
  if (offline > 0) return { status: "offline" as const, detail: `${offline}/${endpoints.length} offline` };
  if (degraded > 0) return { status: "degraded" as const, detail: `${degraded}/${endpoints.length} degraded` };
  return { status: "operational" as const, detail: `${endpoints.length}/${endpoints.length} responding` };
}

function mapLiveStatus(state: string): ServiceStatus {
  if (state === "connected") return "operational";
  if (state === "reconnecting") return "degraded";
  return "offline";
}

function summarizeConnectors(online = 0, total = 0) {
  if (total <= 0) return { status: "degraded" as const, detail: "no source registry" };
  if (online === total) return { status: "operational" as const, detail: `${online}/${total} online` };
  if (online > 0) return { status: "degraded" as const, detail: `${online}/${total} online` };
  return { status: "offline" as const, detail: `0/${total} online` };
}

function summarizeVision(data: ReturnType<typeof useLiveRoadData>["data"]) {
  const recentObservation = data?.observations
    .map((observation) => new Date(observation.observedAt).valueOf())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];

  const observationsLastHour = data?.metrics.observations_last_hour ?? 0;
  if (recentObservation && Date.now() - recentObservation <= 5 * 60 * 1000) {
    return { status: "operational" as const, detail: `${observationsLastHour} observations last hour` };
  }
  if (observationsLastHour > 0) {
    return { status: "degraded" as const, detail: `${observationsLastHour} older observations` };
  }
  return { status: "offline" as const, detail: "no recent observations" };
}

function summarizeIngestion(lastIngestionAt?: string | null) {
  if (!lastIngestionAt) return { status: "offline" as const, detail: "no ingestion recorded" };
  const ageMs = Date.now() - new Date(lastIngestionAt).valueOf();
  if (!Number.isFinite(ageMs)) return { status: "degraded" as const, detail: "invalid timestamp" };
  const ageMinutes = Math.max(0, Math.round(ageMs / 60000));
  if (ageMs <= 5 * 60 * 1000) return { status: "operational" as const, detail: `${ageMinutes} min ago` };
  if (ageMs <= 30 * 60 * 1000) return { status: "degraded" as const, detail: `${ageMinutes} min ago` };
  return { status: "offline" as const, detail: `${ageMinutes} min ago` };
}
