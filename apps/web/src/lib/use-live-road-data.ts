"use client";

import { useEffect, useRef, useState } from "react";
import { apiUrl, getLiveSnapshot, livePayloadSchema, type LivePayload } from "./api";

export type LiveConnectionState = "connecting" | "connected" | "reconnecting" | "offline";

export function useLiveRoadData() {
  const [data, setData] = useState<LivePayload | undefined>();
  const [status, setStatus] = useState<LiveConnectionState>("connecting");
  const [error, setError] = useState<string | undefined>();
  const hasDataRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    let fallbackInterval: ReturnType<typeof setInterval> | undefined;

    const refreshSnapshot = () =>
      getLiveSnapshot()
        .then((snapshot) => {
          if (!mounted) return;
          hasDataRef.current = true;
          setData(snapshot);
          setStatus("connected");
          setError(undefined);
        })
        .catch((snapshotError) => {
          if (!mounted) return;
          setError(snapshotError instanceof Error ? snapshotError.message : String(snapshotError));
          if (!hasDataRef.current) setStatus("offline");
        });

    const source = new EventSource(apiUrl("/api/v1/live"));
    const startFallbackPolling = () => {
      if (fallbackInterval) return;
      fallbackInterval = setInterval(() => {
        void refreshSnapshot();
      }, 3000);
    };
    const stopFallbackPolling = () => {
      if (!fallbackInterval) return;
      clearInterval(fallbackInterval);
      fallbackInterval = undefined;
    };

    void refreshSnapshot();

    source.onopen = () => {
      if (!mounted) return;
      stopFallbackPolling();
      setStatus("connected");
      setError(undefined);
    };
    source.addEventListener("road-state", (event) => {
      if (!mounted) return;
      const parsed = livePayloadSchema.safeParse(JSON.parse(event.data));
      if (parsed.success) {
        hasDataRef.current = true;
        setData(parsed.data);
        setStatus("connected");
        setError(undefined);
      } else {
        setError("Live payload validation failed");
      }
    });
    source.onerror = () => {
      if (!mounted) return;
      setStatus(hasDataRef.current ? "reconnecting" : "offline");
      startFallbackPolling();
    };

    return () => {
      mounted = false;
      stopFallbackPolling();
      source.close();
    };
  }, []);

  return { data, status, error };
}
