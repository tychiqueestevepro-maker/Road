"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/shell";
import { getCameras } from "@/lib/api";
import { relativeSeconds } from "@/lib/format";

export default function CamerasPage() {
  const { data, error } = useQuery({ queryKey: ["cameras"], queryFn: getCameras });

  return (
    <AppShell>
      <div className="px-4 pt-20">
        <div className="mb-4">
          <div className="text-xs uppercase text-[var(--rr-muted)]">Camera Provider</div>
          <h1 className="text-2xl font-semibold">Registered Road Views</h1>
        </div>
        {error ? <div className="mb-4 text-sm text-[var(--rr-red)]">Backend unavailable.</div> : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).map((camera) => (
            <Link key={camera.id} href={`/cameras/${camera.id}`} className="rounded-md border border-[var(--rr-border)] bg-[var(--rr-panel)] p-4 shadow-sm transition hover:border-[var(--rr-blue)] hover:shadow-md">
              <div className="aspect-video overflow-hidden rounded-md border border-[var(--rr-border)] bg-[var(--rr-panel-2)]">
                {camera.snapshotUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={camera.snapshotUrl} alt="" className="h-full w-full object-cover" />
                ) : camera.streamUrl ? (
                  <div className="grid h-full place-items-center text-sm text-[var(--rr-green)]">Live stream</div>
                ) : (
                  <div className="grid h-full place-items-center text-sm text-[var(--rr-muted)]">No live feed</div>
                )}
              </div>
              <div className="mt-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{camera.name}</h2>
                  <div className="text-xs text-[var(--rr-muted)]">{camera.roadName ?? "Unknown road"}</div>
                </div>
                <div className={camera.active ? "text-xs text-[var(--rr-green)]" : "text-xs text-[var(--rr-muted)]"}>
                  {camera.streamUrl ? "LIVE" : camera.active ? "ONLINE" : "OFFLINE"}
                </div>
              </div>
              <div className="mt-3 text-xs text-[var(--rr-muted)]">Last analyzed {relativeSeconds(camera.lastSuccessAt)}</div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
