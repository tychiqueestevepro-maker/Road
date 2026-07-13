import { CodeBlock } from "@/components/docs/code-block";

export default function ErrorsPage() {
  return (
    <>
      <h1>Errors</h1>
      <p className="docs-lead">
        Verytis uses standard HTTP status codes and returns structured error responses with a consistent format.
      </p>

      <h2>Error Response Format</h2>
      <CodeBlock title="JSON">{`{
  "error": {
    "code": "INVALID_API_KEY",
    "message": "The provided API key is invalid.",
    "details": {},
    "request_id": "req_..."
  }
}`}</CodeBlock>

      <h2>Error Codes</h2>
      <table className="docs-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>HTTP Status</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>INVALID_REQUEST</code></td><td>400</td><td>The request body or query parameters are invalid</td></tr>
          <tr><td><code>INVALID_COORDINATES</code></td><td>400</td><td>The provided coordinates are out of range</td></tr>
          <tr><td><code>INVALID_RADIUS</code></td><td>400</td><td>The provided radius is out of range</td></tr>
          <tr><td><code>INVALID_API_KEY</code></td><td>401</td><td>The API key is missing, malformed, or not recognized</td></tr>
          <tr><td><code>API_KEY_REVOKED</code></td><td>401</td><td>The API key has been revoked</td></tr>
          <tr><td><code>API_KEY_EXPIRED</code></td><td>401</td><td>The API key has expired</td></tr>
          <tr><td><code>RESOURCE_NOT_FOUND</code></td><td>404</td><td>The requested resource does not exist</td></tr>
          <tr><td><code>RATE_LIMIT_EXCEEDED</code></td><td>429</td><td>Too many requests</td></tr>
          <tr><td><code>SOURCE_UNAVAILABLE</code></td><td>503</td><td>A required data source is temporarily unavailable</td></tr>
          <tr><td><code>INTERNAL_ERROR</code></td><td>500</td><td>An unexpected server error occurred</td></tr>
        </tbody>
      </table>

      <h2>Rate Limiting</h2>
      <p>The API enforces rate limits per API key:</p>
      <ul>
        <li><strong>600 requests per minute</strong> per API key</li>
      </ul>
      <p>When the rate limit is exceeded, the API returns HTTP 429 with rate limit headers:</p>
      <table className="docs-table">
        <thead>
          <tr><th>Header</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>X-RateLimit-Limit</code></td><td>Maximum requests per window</td></tr>
          <tr><td><code>X-RateLimit-Remaining</code></td><td>Remaining requests in current window</td></tr>
          <tr><td><code>X-RateLimit-Reset</code></td><td>Seconds until the window resets</td></tr>
        </tbody>
      </table>

      <h2>Request IDs</h2>
      <p>
        Every API response includes a <code>request_id</code> in the <code>meta</code> object (success) or <code>error</code> object (failure). Include this ID when reporting issues.
      </p>
    </>
  );
}
