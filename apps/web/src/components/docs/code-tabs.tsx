"use client";

import React, { useState } from "react";
import { CodeBlock } from "./code-block";

interface Tab {
  id: string;
  label: string;
  language: string;
  code: string;
}

interface CodeTabsProps {
  tabs: Tab[];
}

export function CodeTabs({ tabs }: CodeTabsProps) {
  const [activeId, setActiveId] = useState(tabs[0]?.id);
  const activeTab = tabs.find(t => t.id === activeId) || tabs[0];
  if (!activeTab) return null;

  return (
    <div className="mb-8">
      <div className="mb-4 flex gap-6 border-b border-slate-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveId(tab.id)}
            className={`pb-3 text-[14px] font-medium transition-colors relative ${
              activeId === tab.id 
                ? "text-blue-600" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
            {activeId === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
        ))}
      </div>
      <CodeBlock code={activeTab.code} language={activeTab.language} />
    </div>
  );
}
