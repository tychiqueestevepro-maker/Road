"use client";

import type { LiveConnectionState } from "@/lib/use-live-road-data";
import type { LivePayload } from "@/lib/api";

export function StatusBar({
  live,
  status
}: {
  live?: LivePayload;
  status: LiveConnectionState;
}) {
  const data = live?.metrics;
  const streamText =
    status === "connected"
      ? "LIVE"
      : status === "reconnecting"
        ? "RECONNECTING"
        : status === "offline"
          ? "OFFLINE"
          : "CONNECTING";

  return (
    <section className="grid min-h-16 grid-cols-2 gap-2 border-b border-[var(--rr-border)] bg-[var(--rr-panel)] px-4 py-3 md:grid-cols-4">
      <Metric label="Sources online" value={`${data?.connectors_online ?? 0}/${data?.connectors_total ?? 0}`} />
      <Metric label="Live events" value={String(live?.events.length ?? 0)} />
      <Metric label="Road observations" value={String(data?.observations_last_hour ?? 0)} />
      <Metric label="Realtime API" value={streamText} live={status === "connected"} hot={status === "reconnecting"} />
    </section>
  );
}

function Metric({
  label,
  value,
  hot = false,
  live = false
}: {
  label: string;
  value: string;
  hot?: boolean;
  live?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase text-[var(--rr-muted)]">{label}</div>
      <div
        className={
          live
            ? "text-lg font-semibold text-[var(--rr-green)]"
            : hot
              ? "text-lg font-semibold text-[var(--rr-amber)]"
              : "text-lg font-semibold"
        }
      >
        {value}
      </div>
    </div>
  );
}
