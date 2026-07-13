import React from "react";
import Link from "next/link";
import { Button } from "../ui/button";
import { StatusDot } from "../ui/status-dot";
import { VerytisLogo } from "../logo";

export function DeveloperHeader() {
  return (
    <header className="sticky top-0 z-50 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-6">
      {/* LEFT: Logo */}
      <div className="flex items-center gap-2">
        <VerytisLogo className="h-8 w-8 text-blue-600" />
        <Link href="/" className="text-sm font-semibold tracking-tight text-slate-900">
          Verytis
        </Link>
      </div>

      {/* CENTER: Navigation */}
      <nav className="hidden md:flex items-center gap-6">
        <Link href="/developers" className="text-sm font-medium text-blue-600 relative">
          Developers
          <span className="absolute -bottom-[22px] left-0 right-0 h-0.5 bg-blue-600" />
        </Link>
        <Link href="/docs" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
          Documentation
        </Link>
        <Link href="/docs/api-reference" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
          API Reference
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/status" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
            Status
          </Link>
          <StatusDot status="online" />
        </div>
      </nav>

      {/* RIGHT: Get API Access */}
      <div className="flex items-center">
        <Link href="/access" tabIndex={-1}>
          <Button variant="primary" className="h-9 font-medium text-xs px-4 rounded-[7px] shadow-none">
            GET API ACCESS
          </Button>
        </Link>
      </div>
    </header>
  );
}
