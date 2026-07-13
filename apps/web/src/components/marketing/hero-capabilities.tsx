import React from "react";

export function HeroCapabilities() {
  return (
    <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3 border-t border-slate-100 pt-8">
      <div>
        <div className="mb-3 flex h-8 w-8 items-center justify-center rounded bg-slate-50 text-blue-600">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
        </div>
        <h3 className="mb-1 text-[14px] font-semibold text-slate-900">Verify road state</h3>
        <p className="text-[13px] leading-relaxed text-slate-500">Compare declared road information with observed signals in real time.</p>
      </div>

      <div>
        <div className="mb-3 flex h-8 w-8 items-center justify-center rounded bg-slate-50 text-blue-600">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
        </div>
        <h3 className="mb-1 text-[14px] font-semibold text-slate-900">Detect information gaps</h3>
        <p className="text-[13px] leading-relaxed text-slate-500">Surface possible unreported closures and road-state conflicts.</p>
      </div>

      <div>
        <div className="mb-3 flex h-8 w-8 items-center justify-center rounded bg-slate-50 text-blue-600">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        </div>
        <h3 className="mb-1 text-[14px] font-semibold text-slate-900">Consume standardized events</h3>
        <p className="text-[13px] leading-relaxed text-slate-500">Access structured road intelligence through a simple API.</p>
      </div>
    </div>
  );
}
