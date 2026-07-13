import { buildApiApp } from "@road-reality/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApiApp = Awaited<ReturnType<typeof buildApiApp>>;

let apiAppPromise: Promise<ApiApp> | undefined;

function getApiApp() {
  apiAppPromise ??= buildApiApp().then(async (apiApp) => {
    await apiApp.app.ready();
    return apiApp;
  });
  return apiAppPromise;
}

async function handle(request: Request) {
  const { app } = await getApiApp();
  const url = new URL(request.url);
  if (url.pathname === "/api/v1/live" && request.method === "GET") {
    return streamLiveState(app, request);
  }

  const payload = ["GET", "HEAD"].includes(request.method)
    ? undefined
    : Buffer.from(await request.arrayBuffer());
  const response = await app.inject({
    method: request.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD",
    url: toFastifyUrl(url),
    headers: Object.fromEntries(request.headers.entries()),
    payload
  });

  const headers = new Headers();
  for (const [key, value] of Object.entries(response.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, String(item));
    } else if (typeof value !== "undefined") {
      headers.set(key, String(value));
    }
  }

  const body = response.rawPayload.buffer.slice(
    response.rawPayload.byteOffset,
    response.rawPayload.byteOffset + response.rawPayload.byteLength
  ) as ArrayBuffer;

  return new Response(body, {
    status: response.statusCode,
    headers
  });
}

function streamLiveState(app: ApiApp["app"], request: Request) {
  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        try {
          const response = await app.inject({
            method: "GET",
            url: "/api/v1/live/state",
            headers: Object.fromEntries(request.headers.entries())
          });
          controller.enqueue(encoder.encode(`event: road-state\n`));
          controller.enqueue(encoder.encode(`data: ${response.payload}\n\n`));
        } catch (error) {
          controller.enqueue(encoder.encode(`event: error\n`));
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                message: error instanceof Error ? error.message : String(error)
              })}\n\n`
            )
          );
        }
      };

      controller.enqueue(encoder.encode(": connected\n\n"));
      await send();
      interval = setInterval(send, 3000);
      request.signal.addEventListener("abort", () => {
        if (interval) clearInterval(interval);
        try {
          controller.close();
        } catch {
          // Connection is already closed.
        }
      });
    },
    cancel() {
      if (interval) clearInterval(interval);
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}

function toFastifyUrl(url: URL) {
  const pathname =
    url.pathname === "/api/health"
      ? "/health"
      : url.pathname === "/api/metrics"
        ? "/metrics"
        : url.pathname === "/api/openapi.json"
          ? "/openapi.json"
          : url.pathname;
  return `${pathname}${url.search}`;
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
