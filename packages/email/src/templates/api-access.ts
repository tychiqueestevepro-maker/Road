/**
 * Build the HTML email for API key delivery.
 * Clean, minimal, infrastructure-style design.
 */
export function buildApiAccessEmailHtml(opts: {
  apiKey: string;
  companyName: string;
  baseUrl?: string;
  quickstartUrl?: string;
}): string {
  const {
    apiKey,
    companyName,
    baseUrl = "https://api.verytis.dev/v1",
    quickstartUrl = "https://verytis.dev/docs/quickstart"
  } = opts;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Your Verytis API Key</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;color:#e5e5e5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding-bottom:32px;">
              <span style="font-size:14px;font-weight:600;letter-spacing:0.5px;color:#a3a3a3;">VERYTIS</span>
            </td>
          </tr>
          <!-- Title -->
          <tr>
            <td style="padding-bottom:8px;">
              <h1 style="margin:0;font-size:22px;font-weight:600;color:#fafafa;">Your API access is ready.</h1>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:32px;">
              <p style="margin:0;font-size:14px;color:#a3a3a3;">Access granted for ${escapeHtml(companyName)}.</p>
            </td>
          </tr>
          <!-- API Key -->
          <tr>
            <td style="padding-bottom:24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#171717;border:1px solid #262626;border-radius:8px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:1px;color:#737373;text-transform:uppercase;">API Key</p>
                    <code style="font-size:14px;font-family:'SF Mono',SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;color:#22d3ee;word-break:break-all;">${escapeHtml(apiKey)}</code>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Base URL -->
          <tr>
            <td style="padding-bottom:24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#171717;border:1px solid #262626;border-radius:8px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:1px;color:#737373;text-transform:uppercase;">Base URL</p>
                    <code style="font-size:14px;font-family:'SF Mono',SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;color:#fafafa;">${escapeHtml(baseUrl)}</code>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- First Request -->
          <tr>
            <td style="padding-bottom:24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#171717;border:1px solid #262626;border-radius:8px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:1px;color:#737373;text-transform:uppercase;">First Request</p>
                    <code style="font-size:12px;font-family:'SF Mono',SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;color:#d4d4d4;word-break:break-all;white-space:pre-wrap;">curl "${escapeHtml(baseUrl)}/discrepancies?latitude=37.8&amp;longitude=-122.45&amp;radius=5000" \\
  -H "Authorization: Bearer ${escapeHtml(apiKey)}"</code>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td style="padding-bottom:32px;">
              <a href="${escapeHtml(quickstartUrl)}" style="display:inline-block;padding:12px 24px;background:#22d3ee;color:#0a0a0a;font-size:14px;font-weight:600;text-decoration:none;border-radius:6px;">Open Quickstart</a>
            </td>
          </tr>
          <!-- Security Note -->
          <tr>
            <td style="padding-bottom:32px;border-top:1px solid #262626;padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#737373;">Keep this key private. Do not expose it in client-side code or public repositories.</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #262626;padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#525252;">Verytis</p>
              <p style="margin:4px 0 0;font-size:12px;color:#525252;">Real-time road verification infrastructure.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
