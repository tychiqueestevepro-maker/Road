import { CodeBlock } from "@/components/docs/code-block";

export default function RoadStatePage() {
  return (
    <>
      <h1>Road State</h1>
      <p className="docs-lead">
        Verytis models road conditions using two independent state dimensions: declared state and observed state.
      </p>

      <h2>Declared States</h2>
      <p>Declared state comes from official or configured data sources — work zone feeds, temporary closure databases, traffic event APIs.</p>
      <table className="docs-table">
        <thead>
          <tr>
            <th>State</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>open</code></td><td>Source explicitly declares the road open</td></tr>
          <tr><td><code>partially_closed</code></td><td>One or more lanes closed</td></tr>
          <tr><td><code>closed</code></td><td>Full road closure declared</td></tr>
          <tr><td><code>restricted</code></td><td>Road access is restricted</td></tr>
          <tr><td><code>planned</code></td><td>A closure or restriction is planned but not yet active</td></tr>
          <tr><td><code>unknown</code></td><td>No matching declared-state record was found</td></tr>
        </tbody>
      </table>

      <h2>Observed States</h2>
      <p>Observed state comes from real-time signals — camera analysis, traffic flow patterns, temporal observations.</p>
      <table className="docs-table">
        <thead>
          <tr>
            <th>State</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>normal</code></td><td>Normal road activity observed</td></tr>
          <tr><td><code>blocked</code></td><td>Road appears fully blocked</td></tr>
          <tr><td><code>possibly_blocked</code></td><td>Possible blockage detected</td></tr>
          <tr><td><code>low_flow</code></td><td>Abnormally low traffic flow</td></tr>
          <tr><td><code>congested</code></td><td>Heavy congestion observed</td></tr>
          <tr><td><code>obstruction</code></td><td>Physical obstruction detected</td></tr>
          <tr><td><code>vehicles_stopped</code></td><td>Vehicles appear stopped</td></tr>
          <tr><td><code>unknown</code></td><td>No recent observation available</td></tr>
        </tbody>
      </table>

      <div className="docs-callout docs-callout-warning">
        <strong>UNKNOWN does not mean OPEN.</strong>
      </div>
      <p>
        If Verytis does not find an active closure in a configured declared-state source, the road is <strong>not</strong> automatically considered open. The declared state remains <code>unknown</code>.
      </p>
      <p>
        This distinction is fundamental. It allows the system to surface possible information gaps when observed signals suggest abnormal road conditions but no declared closure exists in configured feeds.
      </p>

      <h2>Road State Endpoint</h2>
      <CodeBlock title="cURL">{`curl "https://verytis.com/api/v1/road-state?latitude=37.801&longitude=-122.456&radius=100" \\
  -H "Authorization: Bearer $VERYTIS_API_KEY"`}</CodeBlock>

      <CodeBlock title="JSON">{`{
  "data": {
    "query": {
      "latitude": 37.801,
      "longitude": -122.456,
      "radius_meters": 100
    },
    "location": {
      "latitude": 37.801,
      "longitude": -122.456,
      "road_name": "Halleck Street"
    },
    "road_state": {
      "declared_state": "unknown",
      "observed_state": "possibly_blocked",
      "inferred_state": "possible_information_gap",
      "confidence": 0.91,
      "severity": 4,
      "action": "slow_verify",
      "reason": "A possible road-state information gap is active nearby.",
      "vehicle_usable": true
    },
    "freshness": {
      "updated_at": "2026-07-13T12:15:00.000Z",
      "ttl_seconds": 300,
      "source_freshness_seconds": 12
    },
    "display_lifecycle": {
      "live_map_ttl_seconds": 300,
      "removal_meaning": "not_fresh_enough_for_live_map_not_confirmed_resolved"
    },
    "location_quality": "official_coordinates",
    "events": [],
    "active_discrepancies": ["disc_..."],
    "updated_at": "..."
  },
  "meta": {
    "request_id": "req_..."
  }
}`}</CodeBlock>
    </>
  );
}
