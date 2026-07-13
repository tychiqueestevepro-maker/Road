import { CodeBlock } from "@/components/docs/code-block";

export default function EventsPage() {
  return (
    <>
      <h1>Events</h1>
      <p className="docs-lead">
        Events are normalized road records from configured declared-state sources. Every event includes source provenance.
      </p>

      <h2>List Events</h2>
      <CodeBlock title="cURL">{`curl "https://api.verytis.dev/v1/events?latitude=37.8&longitude=-122.45&radius=5000" \\
  -H "Authorization: Bearer $VERYTIS_API_KEY"`}</CodeBlock>

      <h2>Query Parameters</h2>
      <table className="docs-table">
        <thead>
          <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>source</code></td><td>string</td><td>Filter by source slug</td></tr>
          <tr><td><code>event_type</code></td><td>string</td><td>Filter by event type</td></tr>
          <tr><td><code>latitude</code></td><td>number</td><td>Center latitude</td></tr>
          <tr><td><code>longitude</code></td><td>number</td><td>Center longitude</td></tr>
          <tr><td><code>radius</code></td><td>number</td><td>Radius in meters</td></tr>
          <tr><td><code>since</code></td><td>string</td><td>ISO 8601 lower bound</td></tr>
          <tr><td><code>until</code></td><td>string</td><td>ISO 8601 upper bound</td></tr>
          <tr><td><code>limit</code></td><td>integer</td><td>Max results (default 250, max 500)</td></tr>
        </tbody>
      </table>

      <h2>Event Types</h2>
      <table className="docs-table">
        <thead>
          <tr><th>Type</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>closure</code></td><td>Full road closure</td></tr>
          <tr><td><code>lane_closure</code></td><td>One or more lanes closed</td></tr>
          <tr><td><code>construction</code></td><td>Construction activity</td></tr>
          <tr><td><code>collision</code></td><td>Collision reported</td></tr>
          <tr><td><code>hazard</code></td><td>Road hazard</td></tr>
          <tr><td><code>congestion</code></td><td>Congestion event</td></tr>
          <tr><td><code>detour</code></td><td>Detour in effect</td></tr>
          <tr><td><code>special_event</code></td><td>Special event affecting road</td></tr>
        </tbody>
      </table>

      <h2>Single Event</h2>
      <CodeBlock title="GET /v1/events/:id">{`{
  "data": {
    "id": "...",
    "event_type": "closure",
    "title": "Road Closure - Halleck Street",
    "road_name": "Halleck Street",
    "declared_status": "closed",
    "location": {
      "latitude": 37.801,
      "longitude": -122.456
    },
    "start_time": "2026-07-13T06:00:00Z",
    "end_time": null,
    "source": {
      "id": "sf511_wzdx",
      "name": "511 WZDx",
      "type": "declared_state"
    },
    "freshness_seconds": 45
  },
  "meta": {
    "request_id": "req_..."
  }
}`}</CodeBlock>
    </>
  );
}
