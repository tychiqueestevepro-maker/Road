"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, FileJson, MapPin, RadioTower } from "lucide-react";
import { AppShell } from "@/components/shell";
import { getEvent } from "@/lib/api";
import { relativeSeconds, upperSnake } from "@/lib/format";

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, error } = useQuery({
    queryKey: ["event", params.id],
    queryFn: () => getEvent(params.id)
  });

  return (
    <AppShell>
      <div className="grid min-h-screen gap-4 px-4 pt-20 lg:grid-cols-[1fr_380px]">
        <section>
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-2 rounded-md border border-[var(--rr-border)] bg-white px-3 py-2 text-sm font-medium text-[var(--rr-muted)] transition hover:border-[var(--rr-blue)] hover:bg-[var(--rr-panel-2)] hover:text-[var(--rr-text)]"
          >
            <ArrowLeft className="size-4" />
            Back to ops
          </Link>

          {error ? (
            <div className="rounded-md border border-[var(--rr-red)]/40 bg-[var(--rr-red)]/10 p-4 text-sm text-[var(--rr-red)]">
              Event unavailable.
            </div>
          ) : null}

          <div className="mb-4">
            <div className="flex items-center gap-2 text-xs uppercase text-[var(--rr-blue)]">
              <RadioTower className="size-4" />
              Traffic Event
            </div>
            <h1 className="mt-2 text-2xl font-semibold">
              {data?.title ?? data?.roadName ?? "Loading event"}
            </h1>
            <div className="mt-2 text-sm text-[var(--rr-muted)]">
              {data?.roadName ?? "Unknown road"} {data?.direction ? `- ${data.direction}` : ""}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <StateCard label="Declared" value={data ? upperSnake(data.declaredStatus) : "..."} accent />
            <StateCard label="Type" value={data ? upperSnake(data.eventType) : "..."} />
            <StateCard label="Severity" value={data?.severity == null ? "unknown" : String(data.severity)} />
          </div>

          <section className="mt-4 rounded-md border border-[var(--rr-border)] bg-[var(--rr-panel)] p-4 shadow-sm">
            <div className="text-xs uppercase text-[var(--rr-muted)]">Description</div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
              {data?.description ?? data?.title ?? "No source description provided."}
            </p>
          </section>

          <section className="mt-4 rounded-md border border-[var(--rr-border)] bg-[var(--rr-panel)] p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs uppercase text-[var(--rr-muted)]">
              <FileJson className="size-4" />
              Raw Event JSON
            </div>
            <pre className="mt-3 max-h-[420px] overflow-auto rounded-md border border-[var(--rr-border)] bg-[var(--rr-panel-2)] p-3 text-xs text-[var(--rr-muted)]">
              {JSON.stringify(data ?? {}, null, 2)}
            </pre>
          </section>
        </section>

        <aside className="rounded-md border border-[var(--rr-border)] bg-[var(--rr-panel)] p-4 shadow-sm">
          <div className="text-xs uppercase text-[var(--rr-muted)]">Event Timing</div>
          <div className="mt-3 grid gap-3 text-sm">
            <Metric label="First seen" value={relativeSeconds(data?.firstSeenAt)} />
            <Metric label="Last seen" value={relativeSeconds(data?.lastSeenAt)} />
            <Metric label="Starts" value={formatDate(data?.startTime)} />
            <Metric label="Ends" value={formatDate(data?.endTime)} />
          </div>

          <div className="mt-6 text-xs uppercase text-[var(--rr-muted)]">Location</div>
          <div className="mt-3 rounded-md border border-[var(--rr-border)] bg-[var(--rr-panel-2)] p-3 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 text-[var(--rr-blue)]" />
              <div className="min-w-0">
                <div>{data?.roadName ?? "Unknown road"}</div>
                <div className="mt-1 text-xs text-[var(--rr-muted)]">
                  {data?.latitude && data?.longitude
                    ? `${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}`
                    : "No coordinates from source"}
                </div>
                <div className="mt-1 text-xs text-[var(--rr-muted)]">
                  {data?.locationQuality ?? "unpositioned"} ·{" "}
                  {data?.vehicleUsable ? "vehicle usable" : "display/operator only"}
                </div>
                {data?.locationWarning ? (
                  <div className="mt-2 text-xs text-[var(--rr-amber)]">{data.locationWarning}</div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-6 text-xs uppercase text-[var(--rr-muted)]">Source</div>
          <div className="mt-3 grid gap-3 text-sm">
            <Metric label="External ID" value={data?.externalId ?? "none"} />
            <Metric label="Source ID" value={data?.sourceId ?? "unknown"} />
            <Metric label="Updated" value={relativeSeconds(data?.updatedAt)} />
          </div>

          <button
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-md border border-[var(--rr-border)] bg-white px-3 py-2 text-sm font-semibold transition hover:border-[var(--rr-blue)] hover:bg-[var(--rr-panel-2)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => data && navigator.clipboard?.writeText(JSON.stringify(data, null, 2))}
            disabled={!data}
          >
            <Clock className="size-4" />
            Copy event JSON
          </button>
        </aside>
      </div>
    </AppShell>
  );
}

function StateCard({
  label,
  value,
  accent = false
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-md border border-[var(--rr-border)] bg-[var(--rr-panel)] p-4 shadow-sm">
      <div className="text-[10px] uppercase text-[var(--rr-muted)]">{label}</div>
      <div className={accent ? "mt-1 text-lg font-bold text-[var(--rr-amber)]" : "mt-1 text-lg font-semibold"}>
        {value}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--rr-border)] pb-2">
      <span className="text-[var(--rr-muted)]">{label}</span>
      <span className="max-w-[220px] truncate text-right">{value}</span>
    </div>
  );
}

function formatDate(value?: string | Date | null) {
  if (!value) return "not declared";
  return new Date(value).toLocaleString();
}
