import { CodeBlock } from "@/components/docs/code-block";

export default function DiscrepanciesPage() {
  return (
    <>
      <h1>Discrepancies</h1>
      <p className="docs-lead">
        A discrepancy is created when observed road conditions no longer match declared road data. Each discrepancy is explainable, evidence-backed, and typed.
      </p>

      <h2>Discrepancy Types</h2>

      <h3><code>possible_unreported_closure</code></h3>
      <p>No active closure exists in configured declared-state feeds, but observed signals suggest the road may be blocked or obstructed.</p>
      <p><strong>Typical evidence:</strong> Visual obstruction detection, persistent low traffic flow, repeated observation of possible blockage.</p>
      <p><strong>Limitations:</strong> A declared-state source may not cover this road, or a closure record may exist in an unconfigured source.</p>

      <h3><code>declared_open_observed_blocked</code></h3>
      <p>A source explicitly declares the road open, but observations suggest it is blocked.</p>
      <p><strong>Typical evidence:</strong> Explicit open declaration from a feed, combined with visual or temporal signals showing blockage.</p>

      <h3><code>declared_closed_observed_normal</code></h3>
      <p>A source declares the road closed, but observations show normal traffic flow.</p>
      <p><strong>Typical evidence:</strong> Active closure record in a feed, but camera or flow signals show normal road activity.</p>

      <h3><code>unexpected_flow_interruption</code></h3>
      <p>Traffic flow suddenly dropped without a corresponding declared event.</p>
      <p><strong>Typical evidence:</strong> Temporal flow analysis showing a sharp decrease from baseline patterns.</p>

      <h3><code>source_conflict</code></h3>
      <p>Two or more declared-state sources report conflicting information about the same road.</p>
      <p><strong>Typical evidence:</strong> One source declares the road closed while another shows no active closure.</p>

      <h3><code>stale_declared_event</code></h3>
      <p>A declared event has not been updated within its expected refresh interval.</p>
      <p><strong>Typical evidence:</strong> A closure record with a stale timestamp beyond the source's normal update cadence.</p>

      <h3><code>unknown_state_anomaly</code></h3>
      <p>Neither declared nor observed state is clear, but available signals suggest an anomalous condition.</p>
      <p><strong>Typical evidence:</strong> Multiple weak or conflicting signals that individually are inconclusive but together warrant attention.</p>

      <h2>Response Format</h2>
      <CodeBlock title="GET /v1/discrepancies/:id">{`{
  "data": {
    "id": "disc_...",
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
    "explanation": [
      "No active closure was found in configured declared-state feeds within 100 meters.",
      "A possible road obstruction was observed.",
      "Road activity remained abnormally low across recent observations."
    ],
    "evidence": [
      {
        "type": "visual_observation",
        "source": "configured_public_camera",
        "confidence": 0.86,
        "observed_at": "..."
      },
      {
        "type": "temporal_signal",
        "signal": "persistent_flow_interruption",
        "confidence": 0.78,
        "observed_at": "..."
      }
    ],
    "sources": [
      { "name": "511 WZDx", "role": "declared_state" },
      { "name": "DataSF Temporary Street Closures", "role": "declared_state" }
    ]
  },
  "meta": {
    "request_id": "req_..."
  }
}`}</CodeBlock>

      <h2>Confidence</h2>
      <p>
        The <code>confidence</code> field represents a normalized evidence score. It is <strong>not</strong> a scientifically calibrated probability that an event is true.
      </p>
      <p>The score considers:</p>
      <ul>
        <li>Evidence strength and type</li>
        <li>Source freshness</li>
        <li>Repeated observations</li>
        <li>Independent signals</li>
        <li>Conflicting evidence (reduces confidence)</li>
      </ul>
      <div className="docs-callout">
        Do not treat the confidence score as mathematical certainty. It is an evidence-weighted score designed to help prioritize investigation.
      </div>

      <h2>Severity</h2>
      <p>Severity is an integer from 1 (low) to 5 (critical), reflecting the potential impact of the discrepancy.</p>

      <h2>Query Parameters</h2>
      <table className="docs-table">
        <thead>
          <tr>
            <th>Parameter</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>latitude</code></td><td>number</td><td>Center latitude for spatial search</td></tr>
          <tr><td><code>longitude</code></td><td>number</td><td>Center longitude for spatial search</td></tr>
          <tr><td><code>radius</code></td><td>number</td><td>Search radius in meters</td></tr>
          <tr><td><code>bbox</code></td><td>string</td><td>Bounding box: minLon,minLat,maxLon,maxLat</td></tr>
          <tr><td><code>status</code></td><td>string</td><td>Filter by status: active, monitoring, resolved, dismissed</td></tr>
          <tr><td><code>confidence_min</code></td><td>number</td><td>Minimum confidence threshold</td></tr>
          <tr><td><code>since</code></td><td>string</td><td>ISO 8601 timestamp lower bound</td></tr>
          <tr><td><code>until</code></td><td>string</td><td>ISO 8601 timestamp upper bound</td></tr>
          <tr><td><code>limit</code></td><td>integer</td><td>Maximum results (default 100, max 250)</td></tr>
        </tbody>
      </table>
    </>
  );
}
