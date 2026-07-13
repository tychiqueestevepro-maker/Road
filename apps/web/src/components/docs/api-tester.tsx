"use client";

import React, { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export function ApiTester() {
  const [apiKey, setApiKey] = useState("");
  const [hasTested, setHasTested] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleTest = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setHasTested(true);
    }, 600);
  };

  return (
    <div className="hidden w-[320px] flex-shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-[#FBFCFE] lg:flex">
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
        <h3 className="text-sm font-semibold text-slate-900">Try the API</h3>
        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-blue-600">
          Beta
        </span>
      </div>

      <div className="p-5">
        <div className="mb-6 space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">API Key</label>
            <div className="flex gap-2">
              <Input 
                type="password" 
                placeholder="vt_live_..." 
                className="h-9 w-full text-xs" 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">Stored only in your browser session.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Endpoint</label>
            <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
              <option>GET /v1/discrepancies</option>
              <option>GET /v1/events</option>
              <option>GET /v1/cameras</option>
            </select>
          </div>

          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-600">Latitude</span>
              <span className="font-mono text-[11px] text-slate-900">37.8</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-600">Longitude</span>
              <span className="font-mono text-[11px] text-slate-900">-122.45</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-600">Radius</span>
              <span className="font-mono text-[11px] text-slate-900">5000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-600">Status</span>
              <span className="font-mono text-[11px] text-slate-900">active</span>
            </div>
          </div>

          <Button 
            className="w-full shadow-sm" 
            onClick={handleTest}
            disabled={isLoading}
          >
            {isLoading ? "SENDING..." : "SEND REQUEST"}
          </Button>
        </div>

        {hasTested && (
          <div className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900">Response</span>
              <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700">
                200 OK
              </span>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <pre className="overflow-x-auto text-[11px] text-slate-800">
                <code className="block whitespace-pre">
{`{
  "data": [
    {
      "id": "disc_4829",
      "type": "possible_unreported_closure",
      "status": "active",
      "road_name": "Halleck Street",
      "latitude": 37.801,
      "longitude": -122.456,
      "confidence": 0.91
    }
  ]
}`}
                </code>
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
