import React from "react";
import { DocsSidebar } from "./docs-sidebar";
import { ApiTester } from "./api-tester";
import Link from "next/link";

export function DocsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col bg-white">
      <div className="mx-auto w-full max-w-[1440px] px-6 py-8 md:px-16">
        {/* Large bordered shell */}
        <div className="flex h-[800px] w-full overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm">
          
          <DocsSidebar />

          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Top Internal Header */}
            <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
              <div className="flex items-center gap-4 text-[13px] text-slate-500">
                <Link href="/docs" className="font-medium text-slate-500 hover:text-slate-900">Docs</Link>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-slate-600">API Status</span>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                </div>
                <Link href="/changelog" className="text-[13px] font-medium text-slate-600 hover:text-slate-900">
                  Changelog
                </Link>
                <Link href="/support" className="text-[13px] font-medium text-slate-600 hover:text-slate-900">
                  Support
                </Link>
              </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto p-8 lg:p-12">
              <div className="mx-auto max-w-[800px] docs-content-area">
                {children}
              </div>
            </main>
          </div>

          <ApiTester />
        </div>
      </div>
    </div>
  );
}
