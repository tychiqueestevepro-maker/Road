"use client";

import React, { useEffect, useState } from "react";
import type { RoadEvent } from "@/lib/api";

export function DiscrepancyMapCard({ event }: { event?: RoadEvent }) {
  const [timeAgo, setTimeAgo] = useState("Just now");

  useEffect(() => {
    if (!event) return;
    const updateTime = () => {
      const timeMs = event.lastSeenAt ?? event.updatedAt ?? event.createdAt ?? event.firstSeenAt;
      if (!timeMs) return;
      const diffMs = Date.now() - new Date(timeMs).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) {
        setTimeAgo("Just now");
      } else {
        setTimeAgo(`Detected ${diffMins} min ago`);
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 300000); // Check every 5 minutes
    return () => clearInterval(interval);
  }, [event]);

  // Fallback values if no event is passed
  const title = event ? (event.roadName || event.title || "Unknown Road") : "Halleck Street";
  const label = event ? (event.eventType ? event.eventType.replace(/_/g, ' ') : "Live Event") : "Possible Unreported Closure";
  const displayTime = event ? timeAgo : "Detected 2 min ago";

  return (
    <div className="absolute top-6 right-6 z-10 w-[260px] rounded-[10px] border border-slate-200 bg-white p-4 shadow-lg">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate" title={label}>
          {label}
        </span>
      </div>
      
      <div className="mb-4 text-[15px] font-semibold text-slate-900 truncate" title={title}>
        {title}
      </div>
      
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
        </span>
        <span className="text-[11px] font-medium text-slate-600">
          {displayTime}
        </span>
      </div>
    </div>
  );
}
