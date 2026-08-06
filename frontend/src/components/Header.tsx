import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { AudioWaveform } from "lucide-react";
import { checkHealth } from "../api";

const NAV_ITEMS = [
  { to: "/", label: "Overview", end: true },
  { to: "/recommendations", label: "Recommendations" },
  { to: "/mood", label: "Mood" },
  { to: "/genre", label: "Genre Explorer" },
  { to: "/playlist", label: "Playlist" },
  { to: "/visualize", label: "Visualization" },
  { to: "/how-it-works", label: "How it works" },
];

export default function Header() {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    function poll() {
      checkHealth()
        .then((ok) => !cancelled && setOnline(ok))
        .catch(() => !cancelled && setOnline(false));
    }

    poll();
    const interval = setInterval(poll, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const statusLabel = online === null ? "connecting…" : online ? "live api" : "offline";
  const statusDot = online === null ? "bg-muted-foreground" : online ? "bg-chart-3" : "bg-destructive";

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3">
        <NavLink to="/" className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-sm border border-border bg-primary/15 text-primary">
            <AudioWaveform className="size-4" />
          </span>
          <span className="truncate font-display text-base font-semibold tracking-tight">
            Harmoniq
          </span>
          <span className="hidden shrink-0 items-center gap-1.5 rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:inline-flex">
            <span className={`size-1.5 rounded-full ${statusDot}`} aria-hidden="true" />
            {statusLabel}
          </span>
        </NavLink>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-sm px-2.5 py-1.5 transition-colors ${
                  isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
