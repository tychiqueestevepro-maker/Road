"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/shell";
import { getConnectors } from "@/lib/api";
import { relativeSeconds } from "@/lib/format";

export default function SourcesPage() {
  const { data, error } = useQuery({ queryKey: ["connectors"], queryFn: getConnectors });

  return (
    <AppShell>
      <div className="px-4 pt-20">
        <div className="mb-4">
          <div className="text-xs uppercase text-[var(--rr-muted)]">Source Status</div>
          <h1 className="text-2xl font-semibold">Declared and Observed Feeds</h1>
        </div>
        {error ? <div className="mb-4 text-sm text-[var(--rr-red)]">Backend unavailable.</div> : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).map((source) => (
            <SourceCard key={String(source.id ?? source.slug)} source={source} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function SourceCard({ source }: { source: Record<string, unknown> }) {
  const health = (source.health ?? {}) as Record<string, unknown>;
  const status = String(health.status ?? (source.lastErrorAt ? "DEGRADED" : "DEMO")).toUpperCase();
  const statusColor =
    status === "ONLINE" ? "text-[var(--rr-green)]" : status === "DEGRADED" ? "text-[var(--rr-amber)]" : "text-[var(--rr-muted)]";

  return (
    <article className="rounded-md border border-[var(--rr-border)] bg-[var(--rr-panel)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{String(source.name ?? source.slug)}</h2>
          <div className="mt-1 text-xs text-[var(--rr-muted)]">{String(source.slug)}</div>
        </div>
        <div className={`text-xs font-bold ${statusColor}`}>{status}</div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <Metric label="Last polled" value={relativeSeconds(source.lastPolledAt as string | undefined)} />
        <Metric label="Last success" value={relativeSeconds(source.lastSuccessAt as string | undefined)} />
        <Metric label="Freshness" value={source.pollIntervalSeconds ? `${source.pollIntervalSeconds}s poll` : "manual"} />
        <Metric label="Current error" value={String(source.lastError ?? health.message ?? "none")} />
      </dl>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase text-[var(--rr-muted)]">{label}</dt>
      <dd className="truncate text-sm">{value}</dd>
    </div>
  );
}
