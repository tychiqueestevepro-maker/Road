import { CodeBlock } from "@/components/docs/code-block";

export default function EvidencePage() {
  return (
    <>
      <h1>Evidence</h1>
      <p className="docs-lead">
        Every discrepancy is backed by structured evidence. Each evidence item identifies the signal type, source, confidence, and observation time.
      </p>

      <h2>Evidence Types</h2>
      <table className="docs-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>visual_observation</code></td><td>Image-based analysis from a configured public camera</td></tr>
          <tr><td><code>temporal_signal</code></td><td>Pattern derived from multiple observations over time</td></tr>
          <tr><td><code>declared_state_absence</code></td><td>No matching record found in configured declared-state feeds</td></tr>
          <tr><td><code>declared_state_conflict</code></td><td>Conflicting records across declared-state sources</td></tr>
          <tr><td><code>flow_analysis</code></td><td>Traffic flow deviation from expected patterns</td></tr>
        </tbody>
      </table>

      <h2>Evidence Endpoint</h2>
      <CodeBlock title="GET /v1/evidence/:id">{`{
  "data": {
    "id": "evidence_...",
    "type": "visual_observation",
    "signal": "possible_obstruction",
    "confidence": 0.86,
    "observed_at": "2026-07-13T07:01:00Z",
    "source": {
      "type": "public_camera",
      "name": "Halleck St Camera"
    }
  },
  "meta": {
    "request_id": "req_..."
  }
}`}</CodeBlock>

      <h2>Privacy</h2>
      <p>
        For visual evidence, the API returns metadata only. Raw imagery is not exposed through the public API unless explicitly configured as publicly redistributable.
      </p>

      <h2>Confidence Scoring</h2>
      <p>
        The <code>confidence</code> field on each evidence item represents the strength of that individual signal. The discrepancy-level confidence is a weighted aggregate of all supporting evidence.
      </p>
      <p>Factors that affect individual evidence confidence:</p>
      <ul>
        <li><strong>Freshness</strong> — stale evidence receives lower weight</li>
        <li><strong>Source reliability</strong> — established sources receive higher weight</li>
        <li><strong>Signal clarity</strong> — unambiguous signals score higher</li>
        <li><strong>Repetition</strong> — repeated observations increase confidence</li>
      </ul>
    </>
  );
}
