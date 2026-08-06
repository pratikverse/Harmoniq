import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { checkHealth } from "../api";

export type ApiStatus = "connecting" | "waking" | "ready" | "offline";

const READY_POLL_MS = 30_000;
const WAKING_POLL_MS = 3_000;
/**
 * Generous, because a health check competes for the free tier's single CPU with
 * whatever else is running -- a recommendation request can starve it for
 * several seconds without anything being wrong.
 */
const HEALTH_TIMEOUT_MS = 12_000;
/**
 * How many checks in a row must miss before a backend that was live is treated
 * as not live. One miss is far more likely to be CPU contention than an outage,
 * and demoting on it makes the status flicker during normal heavy requests.
 */
const MISSES_BEFORE_DEMOTION = 2;
/**
 * The backend runs on Render's free tier, which suspends the container after
 * ~15 minutes idle. A cold boot plus the artifact load measures around 60s, so
 * silence well past that -- not the first failed check -- is what counts as an
 * outage.
 */
const COLD_START_GRACE_MS = 150_000;

interface ApiStatusValue {
  status: ApiStatus;
  /** Seconds spent in the current not-ready stretch; 0 once the API answers. */
  waitingSeconds: number;
}

const ApiStatusContext = createContext<ApiStatusValue>({
  status: "connecting",
  waitingSeconds: 0,
});

export function useApiStatus() {
  return useContext(ApiStatusContext);
}

export function ApiStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ApiStatus>("connecting");
  const [waitingSeconds, setWaitingSeconds] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let waitingSince: number | null = null; // null while healthy
    let misses = 0;
    let everReady = false;

    async function poll() {
      // Awaited before rescheduling, so a slow cold-start check can never
      // overlap the next one -- nor resolve late and clobber a fresher result,
      // which is how the badge used to flip back to "offline" after going live.
      const health = await checkHealth(HEALTH_TIMEOUT_MS);
      if (cancelled) return;

      if (health === "ready") {
        misses = 0;
        waitingSince = null;
        everReady = true;
        setStatus("ready");
        setWaitingSeconds(0);
        timer = setTimeout(poll, READY_POLL_MS);
        return;
      }

      misses += 1;
      if (waitingSince === null) waitingSince = Date.now();

      // Hold a known-good state through an isolated miss. Otherwise a single
      // heavy request starving the health check briefly renders the whole
      // "waking up" banner, which is both wrong and a visible layout shift.
      if (everReady && misses < MISSES_BEFORE_DEMOTION) {
        timer = setTimeout(poll, WAKING_POLL_MS);
        return;
      }

      const waited = Date.now() - waitingSince;
      setWaitingSeconds(Math.round(waited / 1000));
      setStatus(health === "warming" || waited < COLD_START_GRACE_MS ? "waking" : "offline");
      timer = setTimeout(poll, WAKING_POLL_MS);
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <ApiStatusContext.Provider value={{ status, waitingSeconds }}>
      {children}
    </ApiStatusContext.Provider>
  );
}
