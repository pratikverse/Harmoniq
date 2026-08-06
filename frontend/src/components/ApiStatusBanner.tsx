import { Loader2, PlugZap } from "lucide-react";
import { useApiStatus } from "../lib/apiStatus";

export default function ApiStatusBanner() {
  const { status, waitingSeconds } = useApiStatus();

  if (status === "ready") return null;

  if (status === "offline") {
    return (
      <div className="border-b border-destructive/40 bg-destructive/10">
        <div className="mx-auto flex max-w-7xl items-start gap-2.5 px-5 py-2.5 text-sm">
          <PlugZap className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">The API isn't responding.</span> It has
            been unreachable for {waitingSeconds}s, which is longer than a normal cold start.
            Recommendations, mood, and genre pages won't load until it's back.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border bg-secondary/60">
      <div className="mx-auto flex max-w-7xl items-start gap-2.5 px-5 py-2.5 text-sm">
        <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Waking up the server…</span> The backend
          sleeps when idle on the free tier and takes up to a minute to come back. This page will
          start working on its own — no need to reload.
          {waitingSeconds > 0 && <span className="ml-1 font-mono text-xs">({waitingSeconds}s)</span>}
        </p>
      </div>
    </div>
  );
}
