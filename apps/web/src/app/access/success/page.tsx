import React from "react";
import Link from "next/link";
import { DeveloperHeader } from "@/components/marketing/developer-header";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Check your inbox | Verytis",
};

export default function SuccessPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <DeveloperHeader />
      <main className="flex flex-1 flex-col items-center justify-center p-6 pb-24 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 mb-6 border border-blue-100">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        
        <h1 className="mb-3 text-[32px] font-bold tracking-tight text-slate-900">
          Check your inbox
        </h1>
        
        <p className="mb-2 text-[16px] leading-relaxed text-slate-600 max-w-[420px]">
          Your Verytis API key has been sent by email.
        </p>
        
        <p className="mb-8 text-[14px] leading-relaxed text-slate-500 max-w-[420px]">
          Once you have your key, the Quickstart takes less than five minutes.
        </p>
        
        <Link href="/developers" tabIndex={-1}>
          <Button className="h-11 px-8 text-[14px]">OPEN QUICKSTART</Button>
        </Link>
      </main>
    </div>
  );
}
