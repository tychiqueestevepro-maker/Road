import { CodeBlock } from "@/components/docs/code-block";

export default function AuthenticationPage() {
  return (
    <>
      <h1>Authentication</h1>
      <p className="docs-lead">
        Verytis uses Bearer API keys for authentication. Include your key in the Authorization header of every request.
      </p>

      <h2>Authorization Header</h2>
      <CodeBlock title="HTTP Header">{`Authorization: Bearer vt_live_...`}</CodeBlock>

      <h2>Example Request</h2>
      <CodeBlock title="cURL">{`curl "https://api.verytis.com/v1/discrepancies" \\
  -H "Authorization: Bearer vt_live_xxxxxxxxxxxxxxxxx"`}</CodeBlock>

      <h2>Key Format</h2>
      <p>Verytis API keys follow this format:</p>
      <table className="docs-table">
        <thead>
          <tr>
            <th>Environment</th>
            <th>Format</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Live</td>
            <td><code>vt_live_&lt;secret&gt;</code></td>
          </tr>
          <tr>
            <td>Test</td>
            <td><code>vt_test_&lt;secret&gt;</code></td>
          </tr>
        </tbody>
      </table>

      <h2>Server-Side Usage Only</h2>
      <div className="docs-callout docs-callout-warning">
        <strong>API keys are server-side secrets.</strong> Never expose them in client-side code.
      </div>
      <p>Do not include Verytis API keys in:</p>
      <ul>
        <li>Browser JavaScript</li>
        <li>Mobile application bundles</li>
        <li>Public GitHub repositories</li>
        <li>Frontend environment variables</li>
      </ul>
      <p>
        Specifically, do not prefix Verytis secrets with <code>NEXT_PUBLIC_</code>, <code>VITE_</code>, or any client-exposed environment variable prefix.
      </p>

      <h2>Error Responses</h2>
      <p>Authentication errors return HTTP 401:</p>
      <CodeBlock title="JSON">{`{
  "error": {
    "code": "INVALID_API_KEY",
    "message": "The provided API key is invalid.",
    "request_id": "req_..."
  }
}`}</CodeBlock>

      <table className="docs-table">
        <thead>
          <tr>
            <th>Error Code</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>INVALID_API_KEY</code></td>
            <td>The key is missing, malformed, or not recognized</td>
          </tr>
          <tr>
            <td><code>API_KEY_REVOKED</code></td>
            <td>The key has been revoked</td>
          </tr>
          <tr>
            <td><code>API_KEY_EXPIRED</code></td>
            <td>The key has expired</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}
