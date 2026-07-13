import { CodeBlock } from "@/components/docs/code-block";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const EXAMPLE_RESPONSE = `{
  "data": [
    {
      "id": "disc_4829",
      "type": "possible_unreported_closure",
      "status": "active",
      "location": {
        "road_name": "Halleck Street",
        "latitude": 37.801,
        "longitude": -122.456
      },
      "declared_state": "unknown",
      "observed_state": "possibly_blocked",
      "confidence": 0.91,
      "severity": 4,
      "summary": "Possible road-state information gap detected",
      "first_detected_at": "2026-07-13T07:00:00Z",
      "last_detected_at": "2026-07-13T07:02:00Z"
    }
  ],
  "pagination": {
    "next_cursor": null
  },
  "meta": {
    "request_id": "req_1a2b3c4d"
  }
}`;

export default function DocsHomePage() {
  return (
    <>
      <h1 className="mb-2 text-[38px] font-bold tracking-tight text-slate-900 md:text-[44px]">Verytis API</h1>
      <p className="mb-8 text-[16px] leading-relaxed text-slate-500">
        Access standardized road-state intelligence and detect possible gaps between declared road data and observed road conditions.
      </p>

      <div className="mb-12 flex gap-4">
        <Link href="/access" tabIndex={-1}>
          <Button className="h-10 px-5 text-[13px]">GET API ACCESS</Button>
        </Link>
        <Link href="/docs/quickstart" tabIndex={-1}>
          <Button variant="secondary" className="h-10 px-5 text-[13px]">QUICKSTART</Button>
        </Link>
      </div>

      <h2 className="mb-4 mt-8 text-[24px] font-semibold text-slate-900 border-t border-slate-100 pt-8">First Request</h2>
      <div className="mb-8">
        <CodeBlock 
          language="curl" 
          code={`curl "https://api.verytis.dev/v1/discrepancies?latitude=37.8&longitude=-122.45&radius=5000" \\
  -H "Authorization: Bearer $VERYTIS_API_KEY"`}
        />
      </div>

      <h2 className="mb-4 text-[24px] font-semibold text-slate-900 border-t border-slate-100 pt-8">Response</h2>
      <div className="mb-8">
        <CodeBlock language="json" code={EXAMPLE_RESPONSE} />
      </div>

      <h2 className="mb-4 text-[24px] font-semibold text-slate-900 border-t border-slate-100 pt-8">What is Verytis?</h2>
      <p className="mb-4 text-[15px] leading-relaxed text-slate-600">
        Verytis combines public road data and observed road signals to surface possible road-state information gaps through a standardized API.
      </p>
      <p className="mb-8 text-[15px] leading-relaxed text-slate-600">
        When the physical road no longer matches its declared digital state, Verytis creates a <strong>discrepancy</strong> — a structured, explainable event that your systems can consume.
      </p>

      <h2 className="mb-4 text-[24px] font-semibold text-slate-900 border-t border-slate-100 pt-8">Core Endpoints</h2>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-[13px] text-slate-600">
          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-4 py-3">Endpoint</th>
              <th className="border-b border-slate-200 px-4 py-3">Purpose</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="px-4 py-3 font-mono text-[12px] text-blue-600">GET /v1/discrepancies</td>
              <td className="px-4 py-3">Retrieve active or historical road-state discrepancies</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-[12px] text-blue-600">GET /v1/road-state</td>
              <td className="px-4 py-3">Inferred current road state near a coordinate</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-[12px] text-blue-600">GET /v1/events</td>
              <td className="px-4 py-3">Normalized road events from configured sources</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-[12px] text-blue-600">GET /v1/evidence/:id</td>
              <td className="px-4 py-3">Structured discrepancy evidence</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-[12px] text-blue-600">GET /v1/sources</td>
              <td className="px-4 py-3">Source health and freshness</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
