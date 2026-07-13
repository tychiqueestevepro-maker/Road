import { buildApiAccessEmailHtml } from "./templates/api-access.js";

export interface SendApiAccessEmailInput {
  to: string;
  apiKey: string;
  companyName: string;
  from: string;
  replyTo?: string;
  resendApiKey?: string;
}

export interface SendApiAccessEmailResult {
  messageId?: string;
  preview?: boolean;
}

/**
 * Send the API access email via Resend.
 *
 * In development (no RESEND_API_KEY), prints a terminal preview with the full
 * API key. This is safe because dev keys only work against a local database.
 */
export async function sendApiAccessEmail(
  input: SendApiAccessEmailInput
): Promise<SendApiAccessEmailResult> {
  const { to, apiKey, companyName, from, replyTo, resendApiKey } = input;

  const html = buildApiAccessEmailHtml({ apiKey, companyName });
  const subject = "Your Verytis API key";

  // Development fallback: print to terminal
  if (!resendApiKey) {
    const isDev = process.env.NODE_ENV === "development" || !process.env.NODE_ENV;
    if (isDev) {
      console.log("");
      console.log("═".repeat(60));
      console.log("  DEVELOPMENT EMAIL PREVIEW");
      console.log("═".repeat(60));
      console.log(`  To:       ${to}`);
      console.log(`  Subject:  ${subject}`);
      console.log(`  Company:  ${companyName}`);
      console.log("─".repeat(60));
      console.log(`  API Key:  ${apiKey}`);
      console.log("─".repeat(60));
      console.log(`  Quickstart: /docs/quickstart`);
      console.log("═".repeat(60));
      console.log("");
      return { preview: true };
    }
    throw new Error("RESEND_API_KEY is required in production to send emails");
  }

  // Production: send via Resend
  const { Resend } = await import("resend");
  const resend = new Resend(resendApiKey);

  const result = await resend.emails.send({
    from,
    to,
    replyTo,
    subject,
    html
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }

  return { messageId: result.data?.id };
}
