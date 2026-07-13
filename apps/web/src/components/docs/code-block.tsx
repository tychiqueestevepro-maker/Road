"use client";

import React, { useState } from "react";

interface CodeBlockProps {
  code?: string;
  language?: string;
  title?: string;
  children?: React.ReactNode;
}

export function CodeBlock({ code, language, title, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  // Extract text from children if code prop isn't provided (for backwards compatibility)
  let content = code || "";
  if (!content && typeof children === "string") {
    content = children;
  } else if (!content && children) {
    // Basic extraction if it's not a pure string
    content = String(children);
  }

  // Use language or title as a fallback
  const langLabel = language || title || "Code";

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-[#F8FAFC] my-4">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {langLabel}
        </span>
        <button
          onClick={handleCopy}
          className="rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900"
        >
          {copied ? "COPIED!" : "COPY"}
        </button>
      </div>
      <div className="p-4 overflow-x-auto">
        <pre className="text-[13px] text-[#0F172A] font-mono leading-relaxed">
          <code>{content}</code>
        </pre>
      </div>
    </div>
  );
}
