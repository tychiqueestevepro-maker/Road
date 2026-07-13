import React from "react";
import { DeveloperHeader } from "@/components/marketing/developer-header";
import { DeveloperHero } from "@/components/marketing/developer-hero";
import { DocsShell } from "@/components/docs/docs-shell";
import { QuickstartTimeline } from "@/components/docs/quickstart-timeline";

export const metadata = {
  title: "Verytis for Developers",
  description: "Detect possible gaps between declared road data and observed road conditions through one standardized API.",
};

export default function DevelopersPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <DeveloperHeader />
      <main className="flex-1">
        <DeveloperHero />
        
        {/* Docs Preview on Homepage */}
        <DocsShell>
          <h1 className="mb-2 text-[38px] font-bold tracking-tight text-slate-900 md:text-[44px]">
            Quickstart
          </h1>
          <p className="mb-12 text-[16px] leading-relaxed text-slate-500">
            Make your first API request in less than 5 minutes.
          </p>
          <QuickstartTimeline />
        </DocsShell>

      </main>
    </div>
  );
}
