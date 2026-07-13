import { CodeBlock } from "@/components/docs/code-block";

export default function SourcesPage() {
  return (
    <>
      <h1>Sources and Freshness</h1>
      <p className="docs-lead">
        Verytis combines multiple source types. Every event and observation includes timestamps and provenance so you can evaluate data quality.
      </p>

      <h2>Source Types</h2>
      <table className="docs-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Description</th>
            <th>Examples</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>declared_state</code></td>
            <td>Official road status from public data sources</td>
            <td>511 WZDx, DataSF Temporary Street Closures, 511 Traffic Events</td>
          </tr>
          <tr>
            <td><code>observed_state</code></td>
            <td>Real-time signals from cameras and sensors</td>
            <td>Public camera feeds, traffic flow sensors</td>
          </tr>
        </tbody>
      </table>

      <h2>Timestamps</h2>
      <table className="docs-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>observed_at</code></td><td>When the observation was captured</td></tr>
          <tr><td><code>source_updated_at</code></td><td>When the source last updated this record</td></tr>
          <tr><td><code>ingested_at</code></td><td>When Verytis ingested the record</td></tr>
          <tr><td><code>freshness_seconds</code></td><td>Seconds since the source was last successfully polled</td></tr>
        </tbody>
      </table>

      <h2>Freshness and Staleness</h2>
      <p>Stale evidence receives lower weight in confidence calculations. A source is considered stale when:</p>
      <ul>
        <li>Camera observations are older than <code>120 seconds</code></li>
        <li>Traffic observations are older than <code>300 seconds</code></li>
        <li>Declared events have not been refreshed within their poll interval</li>
      </ul>

      <h2>Sources Endpoint</h2>
      <CodeBlock title="GET /v1/sources">{`{
  "data": [
    {
      "id": "sf511_wzdx",
      "name": "511 WZDx",
      "type": "declared_state",
      "status": "online",
      "last_success_at": "2026-07-13T07:00:00Z",
      "freshness_seconds": 34,
      "poll_interval_seconds": 60
    },
    {
      "id": "datasf_temporary_closures",
      "name": "DataSF Temporary Street Closures",
      "type": "declared_state",
      "status": "online",
      "last_success_at": "2026-07-13T06:55:00Z",
      "freshness_seconds": 334,
      "poll_interval_seconds": 300
    }
  ],
  "meta": {
    "request_id": "req_..."
  }
}`}</CodeBlock>
    </>
  );
}
