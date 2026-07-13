"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { HlsPlayer } from "@/components/hls-player";
import { AppShell } from "@/components/shell";
import { apiGet, cameraSchema } from "@/lib/api";
import { relativeSeconds } from "@/lib/format";

export default function CameraDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, error } = useQuery({
    queryKey: ["camera", params.id],
    queryFn: () => apiGet(`/api/v1/cameras/${params.id}`, cameraSchema.extend({ snapshots: z.array(z.record(z.unknown())) }))
  });

  return (
    <AppShell>
      <div className="grid min-h-screen gap-4 px-4 pt-20 lg:grid-cols-[1fr_360px]">
        {error ? <div className="text-sm text-[var(--rr-red)]">Camera unavailable.</div> : null}
        <section>
          <div className="mb-4">
            <div className="text-xs uppercase text-[var(--rr-muted)]">Camera Detail</div>
            <h1 className="text-2xl font-semibold">{data?.name ?? "Loading camera"}</h1>
          </div>
          <div className="overflow-hidden rounded-md border border-[var(--rr-border)] bg-[var(--rr-panel-2)] shadow-sm">
            {data?.streamUrl ? (
              <HlsPlayer src={data.streamUrl} poster={data.snapshotUrl} />
            ) : data?.snapshotUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.snapshotUrl} alt="" className="max-h-[70vh] w-full object-cover" />
            ) : (
              <div className="grid aspect-video place-items-center text-[var(--rr-muted)]">No live feed</div>
            )}
          </div>
        </section>
        <aside className="rounded-md border border-[var(--rr-border)] bg-[var(--rr-panel)] p-4 shadow-sm">
          <div className="text-xs uppercase text-[var(--rr-muted)]">Temporal Metrics</div>
          <div className="mt-3 grid gap-3 text-sm">
            <Metric label="Road" value={data?.roadName ?? "unknown"} />
            <Metric label="Status" value={data?.active ? "active" : "inactive"} />
            <Metric label="Live stream" value={data?.streamUrl ? "available" : "snapshot only"} />
            <Metric label="Last success" value={relativeSeconds(data?.lastSuccessAt)} />
            <Metric label="Captures" value={String(data?.snapshots?.length ?? 0)} />
          </div>
          {typeof data?.metadata?.camera_page_url === "string" ? (
            <a
              href={data.metadata.camera_page_url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex rounded-md border border-[var(--rr-border)] bg-white px-3 py-2 text-sm font-medium text-[var(--rr-text)] transition hover:border-[var(--rr-blue)] hover:bg-[var(--rr-panel-2)]"
            >
              Caltrans camera page
            </a>
          ) : null}
          <div className="mt-6 text-xs uppercase text-[var(--rr-muted)]">Live Captures</div>
          <div className="mt-3 space-y-2">
            {(data?.snapshots ?? []).slice(0, 8).map((snapshot) => (
              <div key={String(snapshot.id)} className="rounded-md border border-[var(--rr-border)] bg-[var(--rr-panel-2)] p-3 text-xs">
                <div>{relativeSeconds(snapshot.fetchedAt as string | undefined)}</div>
                <div className="mt-1 truncate text-[var(--rr-muted)]">{String(snapshot.analysisStatus ?? "unknown")}</div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--rr-border)] pb-2">
      <span className="text-[var(--rr-muted)]">{label}</span>
      <span>{value}</span>
    </div>
  );
}
