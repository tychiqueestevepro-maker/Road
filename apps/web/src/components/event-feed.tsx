"use client";

import Link from "next/link";
import { Camera, RadioTower } from "lucide-react";
import type { Observation, RoadEvent } from "@/lib/api";
import { relativeSeconds, upperSnake } from "@/lib/format";

type FeedEntry =
  | {
      id: string;
      time: string;
      kind: "event";
      title: string;
      detail: string;
      item: RoadEvent;
    }
  | {
      id: string;
      time: string;
      kind: "observation";
      title: string;
      detail: string;
      item: Observation;
    };

export function EventFeed({
  events,
  observations
}: {
  events: RoadEvent[];
  observations: Observation[];
}) {
  const feed: FeedEntry[] = [
    ...events.slice(0, 12).map((item) => ({
      id: `e-${item.id}`,
      time: String(item.lastSeenAt ?? ""),
      kind: "event" as const,
      title: item.title ?? "Traffic event updated",
      detail: `${item.roadName ?? "Official source"} - ${upperSnake(item.declaredStatus)}`,
      item
    })),
    ...observations.slice(0, 12).map((item) => ({
      id: `o-${item.id}`,
      time: String(item.observedAt),
      kind: "observation" as const,
      title: "Live camera observation",
      detail: `${upperSnake(item.observedState)} - ${item.roadName ?? "Camera source"}`,
      item
    }))
  ].sort((left, right) => new Date(right.time).valueOf() - new Date(left.time).valueOf());

  return (
    <aside className="overflow-y-auto border-l border-[var(--rr-border)] bg-[var(--rr-panel)]">
      <div className="sticky top-0 z-10 border-b border-[var(--rr-border)] bg-[var(--rr-panel)] p-4">
        <div className="text-xs uppercase text-[var(--rr-muted)]">Live Feed</div>
      </div>
      <div className="divide-y divide-[var(--rr-border)]">
        {feed.length === 0 ? (
          <div className="p-4 text-sm text-[var(--rr-muted)]">No live records returned yet.</div>
        ) : (
          feed.map((entry) => <FeedRow key={entry.id} entry={entry} />)
        )}
      </div>
    </aside>
  );
}

function FeedRow({ entry }: { entry: FeedEntry }) {
  const content = (
    <>
      <Icon kind={entry.kind} />
      <span className="min-w-0">
        <span className="block text-xs text-[var(--rr-muted)]">{relativeSeconds(entry.time)}</span>
        <span className="block truncate text-sm font-semibold">{entry.title}</span>
        <span className="block truncate text-xs text-[var(--rr-muted)]">{entry.detail}</span>
      </span>
    </>
  );

  if (entry.kind === "event") {
    return (
      <Link
        href={`/events/${entry.item.id}`}
        className="flex w-full gap-3 p-4 text-left transition hover:bg-[var(--rr-panel-2)]"
      >
        {content}
      </Link>
    );
  }

  return <div className="flex w-full gap-3 p-4 text-left">{content}</div>;
}

function Icon({ kind }: { kind: "event" | "observation" }) {
  const className = kind === "event" ? "text-[var(--rr-blue)]" : "text-[var(--rr-green)]";
  const IconComponent = kind === "event" ? RadioTower : Camera;
  return (
    <span className={`mt-1 grid size-8 shrink-0 place-items-center rounded-md border border-[var(--rr-border)] bg-[var(--rr-panel-2)] ${className}`}>
      <IconComponent className="size-4" />
    </span>
  );
}
