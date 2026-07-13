export default function ApiReferencePage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  return (
    <>
      <h1>API Reference</h1>
      <p className="docs-lead">
        Complete API reference generated from the Verytis OpenAPI specification.
      </p>

      <h2>OpenAPI Specification</h2>
      <p>
        The OpenAPI JSON document is available at:
      </p>
      <p>
        <code>{apiUrl}/openapi.json</code>
      </p>

      <h2>Interactive Reference</h2>
      <p>
        The full interactive API reference with request/response schemas is available at:
      </p>
      <p>
        <a href={`${apiUrl}/docs`} target="_blank" rel="noopener noreferrer" className="dev-btn-secondary" style={{ display: "inline-flex" }}>
          Open API Reference
        </a>
      </p>

      <h2 id="discrepancies">Discrepancies</h2>
      <table className="docs-table">
        <thead>
          <tr><th>Method</th><th>Path</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>GET</code></td><td><code>/v1/discrepancies</code></td><td>List active or historical discrepancies</td></tr>
          <tr><td><code>GET</code></td><td><code>/v1/discrepancies/:id</code></td><td>Get full discrepancy detail with evidence</td></tr>
        </tbody>
      </table>

      <h2 id="road-state">Road State</h2>
      <table className="docs-table">
        <thead>
          <tr><th>Method</th><th>Path</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>GET</code></td><td><code>/v1/road-state</code></td><td>Inferred road state near a coordinate</td></tr>
        </tbody>
      </table>

      <h2 id="events">Events</h2>
      <table className="docs-table">
        <thead>
          <tr><th>Method</th><th>Path</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>GET</code></td><td><code>/v1/events</code></td><td>List normalized road events</td></tr>
          <tr><td><code>GET</code></td><td><code>/v1/events/:id</code></td><td>Get single event with source provenance</td></tr>
        </tbody>
      </table>

      <h2 id="evidence">Evidence</h2>
      <table className="docs-table">
        <thead>
          <tr><th>Method</th><th>Path</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>GET</code></td><td><code>/v1/evidence/:id</code></td><td>Get structured evidence metadata</td></tr>
        </tbody>
      </table>

      <h2 id="sources">Sources</h2>
      <table className="docs-table">
        <thead>
          <tr><th>Method</th><th>Path</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>GET</code></td><td><code>/v1/sources</code></td><td>Source health and freshness</td></tr>
        </tbody>
      </table>

      <h2>Authentication</h2>
      <p>All endpoints require a Bearer API key in the Authorization header:</p>
      <p><code>Authorization: Bearer vt_live_...</code></p>

      <h2>Base URL</h2>
      <p><code>https://api.verytis.com/v1</code></p>
    </>
  );
}
