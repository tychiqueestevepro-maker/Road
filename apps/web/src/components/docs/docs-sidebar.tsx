import React from "react";
import Link from "next/link";

export function DocsSidebar() {
  return (
    <aside className="hidden w-[240px] flex-shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-[#FBFCFE] p-5 lg:flex">
      <div className="mb-6 relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input 
          type="text" 
          placeholder="Search documentation..." 
          className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-[13px] text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <nav className="flex flex-col gap-6">
        <div>
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Get Started</h4>
          <ul className="flex flex-col gap-0.5">
            <li><Link href="/docs" className="block rounded border-l-2 border-transparent px-3 py-1.5 text-[14px] text-slate-600 hover:bg-slate-100 hover:text-slate-900">Introduction</Link></li>
            <li><Link href="/docs/quickstart" className="block rounded border-l-2 border-transparent px-3 py-1.5 text-[14px] text-slate-600 hover:bg-slate-100 hover:text-slate-900">Quickstart</Link></li>
            <li><Link href="/docs/authentication" className="block rounded border-l-2 border-transparent px-3 py-1.5 text-[14px] text-slate-600 hover:bg-slate-100 hover:text-slate-900">Authentication</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Core Concepts</h4>
          <ul className="flex flex-col gap-0.5">
            <li><Link href="/docs/road-state" className="block rounded border-l-2 border-transparent px-3 py-1.5 text-[14px] text-slate-600 hover:bg-slate-100 hover:text-slate-900">Road State</Link></li>
            <li><Link href="/docs/discrepancies" className="block rounded border-l-2 border-transparent px-3 py-1.5 text-[14px] text-slate-600 hover:bg-slate-100 hover:text-slate-900">Discrepancies</Link></li>
            <li><Link href="/docs/evidence" className="block rounded border-l-2 border-transparent px-3 py-1.5 text-[14px] text-slate-600 hover:bg-slate-100 hover:text-slate-900">Evidence</Link></li>
            <li><Link href="/docs/sources" className="block rounded border-l-2 border-transparent px-3 py-1.5 text-[14px] text-slate-600 hover:bg-slate-100 hover:text-slate-900">Sources</Link></li>
            <li><Link href="/docs/events" className="block rounded border-l-2 border-transparent px-3 py-1.5 text-[14px] text-slate-600 hover:bg-slate-100 hover:text-slate-900">Events</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Reference</h4>
          <ul className="flex flex-col gap-0.5">
            <li><Link href="/docs/api-reference" className="block rounded border-l-2 border-transparent px-3 py-1.5 text-[14px] text-slate-600 hover:bg-slate-100 hover:text-slate-900">API Reference</Link></li>
            <li><Link href="/docs/errors" className="block rounded border-l-2 border-transparent px-3 py-1.5 text-[14px] text-slate-600 hover:bg-slate-100 hover:text-slate-900">Errors</Link></li>
            <li><Link href="/docs/webhooks" className="block rounded border-l-2 border-transparent px-3 py-1.5 text-[14px] text-slate-600 hover:bg-slate-100 hover:text-slate-900">Webhooks</Link></li>
          </ul>
        </div>
      </nav>
    </aside>
  );
}
