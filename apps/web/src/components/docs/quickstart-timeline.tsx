import React from "react";
import { Button } from "../ui/button";
import { CodeTabs } from "./code-tabs";
import { CodeBlock } from "./code-block";
import Link from "next/link";

export function QuickstartTimeline() {
  return (
    <div className="relative mx-auto max-w-[640px] pl-8">
      {/* Vertical line connecting steps */}
      <div className="absolute left-[11px] top-4 bottom-0 w-px bg-slate-200"></div>

      {/* STEP 1 */}
      <div className="relative mb-12">
        <div className="absolute -left-8 top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-blue-600 bg-white text-[11px] font-bold text-blue-600 z-10">
          1
        </div>
        <h3 className="mb-2 text-lg font-semibold text-slate-900">Get your API key</h3>
        <p className="mb-4 text-[15px] leading-relaxed text-slate-600">
          Enter your company and work email to receive your API key.
        </p>
        <Link href="/access" tabIndex={-1}>
          <Button className="h-10 px-5 text-[13px]">GET API ACCESS</Button>
        </Link>
      </div>

      {/* STEP 2 */}
      <div className="relative mb-12">
        <div className="absolute -left-8 top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-blue-600 bg-white text-[11px] font-bold text-blue-600 z-10">
          2
        </div>
        <h3 className="mb-2 text-lg font-semibold text-slate-900">Set your API key</h3>
        <p className="mb-4 text-[15px] leading-relaxed text-slate-600">
          Export your API key as an environment variable.
        </p>
        <CodeBlock 
          code='export VERYTIS_API_KEY="vt_live_your_key_here"'
          language="bash"
        />
      </div>

      {/* STEP 3 */}
      <div className="relative mb-12">
        <div className="absolute -left-8 top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-blue-600 bg-white text-[11px] font-bold text-blue-600 z-10">
          3
        </div>
        <h3 className="mb-2 text-lg font-semibold text-slate-900">Request active discrepancies</h3>
        <p className="mb-4 text-[15px] leading-relaxed text-slate-600">
          Use the discrepancies endpoint to retrieve active road-state events near a location.
        </p>
        <CodeTabs 
          tabs={[
            {
              id: "curl",
              label: "cURL",
              language: "bash",
              code: `curl "https://verytis.com/api/v1/discrepancies?latitude=37.8&longitude=-122.45&radius=5000&status=active" \\
  -H "Authorization: Bearer $VERYTIS_API_KEY"`
            },
            {
              id: "typescript",
              label: "TypeScript",
              language: "typescript",
              code: `const res = await fetch("https://verytis.com/api/v1/discrepancies?latitude=37.8&longitude=-122.45&radius=5000&status=active", {
  headers: {
    "Authorization": \`Bearer \${process.env.VERYTIS_API_KEY}\`
  }
});
const data = await res.json();`
            },
            {
              id: "python",
              label: "Python",
              language: "python",
              code: `import os
import requests

headers = {
    "Authorization": f"Bearer {os.environ.get('VERYTIS_API_KEY')}"
}
url = "https://verytis.com/api/v1/discrepancies?latitude=37.8&longitude=-122.45&radius=5000&status=active"

response = requests.get(url, headers=headers)
data = response.json()`
            }
          ]}
        />
      </div>

      {/* STEP 4 */}
      <div className="relative mb-12">
        <div className="absolute -left-8 top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-blue-600 bg-white text-[11px] font-bold text-blue-600 z-10">
          4
        </div>
        <h3 className="mb-2 text-lg font-semibold text-slate-900">Inspect the response</h3>
        <p className="mb-4 text-[15px] leading-relaxed text-slate-600">
          Review the response structure and key fields.
        </p>
        <CodeBlock 
          language="json"
          code={`{
  "data": [
    {
      "id": "disc_4829",
      "type": "possible_unreported_closure",
      "status": "active",
      "road_name": "Halleck Street",
      "latitude": 37.801,
      "longitude": -122.456,
      "declared_state": "unknown",
      "observed_state": "possibly_blocked",
      "confidence": 0.91,
      "summary": "Possible road-state information gap detected"
    }
  ]
}`}
        />
      </div>

      {/* STEP 5 */}
      <div className="relative mb-8">
        <div className="absolute -left-8 top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-blue-600 bg-white text-[11px] font-bold text-blue-600 z-10">
          5
        </div>
        <h3 className="mb-2 text-lg font-semibold text-slate-900">Retrieve full evidence</h3>
        <p className="mb-0 text-[15px] leading-relaxed text-slate-600">
          Get detailed evidence for any discrepancy.
        </p>
      </div>
    </div>
  );
}
