import { serve } from "inngest/next";
import { functions } from "@/inngest/functions";
import { inngest } from "@/inngest/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
  streaming: true
});
