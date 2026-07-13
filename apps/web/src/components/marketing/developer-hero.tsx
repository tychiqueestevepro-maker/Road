"use client";

import React from "react";
import Link from "next/link";
import { Button } from "../ui/button";
import { HeroCapabilities } from "./hero-capabilities";
import { RoadMapPreview } from "./road-map-preview";
import { DiscrepancyMapCard } from "./discrepancy-map-card";
import { useLiveRoadData } from "@/lib/use-live-road-data";

export function DeveloperHero() {
  const { data, status } = useLiveRoadData();

  return (
    <section className="relative overflow-hidden bg-white px-6 py-12 md:px-16 lg:py-20">
      <div className="mx-auto max-w-[1440px]">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between lg:gap-16">
          
          {/* LEFT COLUMN */}
          <div className="mb-12 w-full lg:mb-0 lg:w-[45%]">
            <div className="mb-4 inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-blue-600">
              REAL-TIME ROAD INTELLIGENCE API
            </div>
            
            <h1 className="mb-6 text-[40px] font-bold leading-[1.05] tracking-tight text-slate-900 md:text-[56px] lg:max-w-xl">
              Road intelligence<br />your systems can trust.
            </h1>
            
            <p className="mb-8 max-w-[520px] text-[16px] leading-relaxed text-slate-500 md:text-[18px]">
              Detect possible gaps between declared road data and observed road conditions through one standardized API.
            </p>
            
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/access" tabIndex={-1}>
                <Button className="h-11 px-6 text-[14px]">GET API ACCESS</Button>
              </Link>
              <Link href="/docs" tabIndex={-1}>
                <Button variant="secondary" className="h-11 px-6 text-[14px]">VIEW DOCUMENTATION</Button>
              </Link>
            </div>
            
            <HeroCapabilities />
          </div>
          
          {/* RIGHT COLUMN */}
          <div className="relative w-full lg:w-[55%]">
            <div className="relative h-[400px] w-full overflow-hidden rounded-[14px] md:h-[500px]">
              <RoadMapPreview 
                mode="developer-hero" 
                showCameras 
                showDiscrepancies 
                showTraffic 
                interactive 
                events={data?.events ?? []}
                cameras={data?.cameras ?? []}
                observations={data?.observations ?? []}
                liveUpdatedAt={data?.streamed_at}
                connectionStatus={status}
              />
              <DiscrepancyMapCard event={data?.events?.[0]} />
            </div>
          </div>
          
        </div>
      </div>
    </section>
  );
}
