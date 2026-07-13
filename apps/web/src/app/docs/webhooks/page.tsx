import { CodeBlock } from "@/components/docs/code-block";

export default function WebhooksPage() {
  return (
    <>
      <h1>Webhooks</h1>
      <div className="docs-callout docs-callout-info">
        <strong>Beta.</strong> Webhook support is under development. This page documents the planned architecture.
      </div>

      <p className="docs-lead">
        Receive real-time notifications when discrepancies are created, updated, or resolved.
      </p>

      <h2>Planned Events</h2>
      <table className="docs-table">
        <thead>
          <tr><th>Event</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>discrepancy.created</code></td><td>A new discrepancy has been detected</td></tr>
          <tr><td><code>discrepancy.updated</code></td><td>A discrepancy's status, confidence, or evidence has changed</td></tr>
          <tr><td><code>discrepancy.resolved</code></td><td>A discrepancy has been resolved</td></tr>
        </tbody>
      </table>

      <h2>Payload Format</h2>
      <CodeBlock title="JSON">{`{
  "id": "evt_...",
  "type": "discrepancy.created",
  "created_at": "2026-07-13T07:00:00Z",
  "data": {
    "discrepancy": {
      "id": "disc_...",
      "type": "possible_unreported_closure",
      "status": "active",
      "location": {
        "road_name": "Halleck Street",
        "latitude": 37.801,
        "longitude": -122.456
      },
      "confidence": 0.91,
      "summary": "Possible road-state information gap detected"
    }
  }
}`}</CodeBlock>

      <h2>Signature Verification</h2>
      <p>Webhook payloads will be signed using HMAC-SHA-256. The signature will be included in the <code>Road-Reality-Signature</code> header.</p>
      <CodeBlock title="Verification (planned)">{`const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}`}</CodeBlock>

      <h2>Status</h2>
      <p>
        Webhook registration and delivery are not yet available in the public API. This page will be updated when the feature launches.
      </p>
    </>
  );
}
