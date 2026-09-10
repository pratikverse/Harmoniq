import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { AudioWaveform, Menu, X } from "lucide-react";
import { useApiStatus } from "../lib/apiStatus";

const NAV_ITEMS = [
  { to: "/", label: "Overview", end: true },
  { to: "/recommendations", label: "Recommendations" },
  { to: "/mood", label: "Mood" },
  { to: "/genre", label: "Genre Explorer" },
  { to: "/playlist", label: "Playlist" },
  { to: "/visualize", label: "Visualization" },
  { to: "/how-it-works", label: "How it works" },
];

const STATUS_LABEL = {
  connecting: "connecting…",
  waking: "waking up…",
  ready: "live api",
  offline: "offline",
} as const;

const STATUS_DOT = {
  connecting: "bg-muted-foreground",
  waking: "bg-chart-3 animate-pulse",
  ready: "bg-chart-2",
  offline: "bg-destructive",
} as const;

export default function Header() {
  const { status } = useApiStatus();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const statusLabel = STATUS_LABEL[status];
  const statusDot = STATUS_DOT[status];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? "border-b border-border bg-background/85 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav
        className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3.5"
        aria-label="Primary"
      >
        <NavLink to="/" className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <AudioWaveform className="size-4" />
          </span>
          <span className="truncate font-display text-base font-semibold tracking-tight text-foreground">
            Harmoniq
          </span>
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:inline-flex">
            <span className={`size-1.5 rounded-full ${statusDot}`} aria-hidden="true" />
            {statusLabel}
          </span>
        </NavLink>

        <ul className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center justify-center rounded-md p-2 text-foreground md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open ? (
        <div className="border-t border-border bg-background md:hidden">
          <ul className="mx-auto max-w-7xl px-5 py-3">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `block rounded-md px-3 py-3 text-base font-medium transition-colors ${
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
            <li className="flex items-center gap-1.5 px-3 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <span className={`size-1.5 rounded-full ${statusDot}`} aria-hidden="true" />
              {statusLabel}
            </li>
          </ul>
        </div>
      ) : null}
    </header>
  );
}
