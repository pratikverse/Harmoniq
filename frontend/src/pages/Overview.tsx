import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { getStats } from "../api";
import { Reveal } from "../lib/reveal";

const STEPS = [
  { label: "Search", note: "fuzzy + typo-tolerant" },
  { label: "Latent KNN", note: "cosine neighbors" },
  { label: "Hybrid rank", note: "audio + genre + popularity" },
  { label: "Explain", note: "per-feature reasoning" },
  { label: "Results", note: "diversified playlist" },
];

export default function Overview() {
  const [stats, setStats] = useState<{ songs: number; artists: number; genres: number } | null>(
    null,
  );

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  const statTiles = stats
    ? [
        { k: stats.songs.toLocaleString(), v: "tracks in the catalog" },
        { k: stats.artists.toLocaleString(), v: "distinct artists" },
        { k: stats.genres.toLocaleString(), v: "dataset genre labels" },
      ]
    : [];

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60rem 40rem at 50% -10%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 60%)",
        }}
      />

      <section className="relative mx-auto max-w-5xl px-6 pt-20 pb-20 sm:pt-28 sm:pb-28">
        <Reveal delay={0}>
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            Hybrid recommender · research build
          </p>
        </Reveal>

        <Reveal delay={80}>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
            Genres can&apos;t describe a sound.
          </h1>
        </Reveal>

        <Reveal delay={160}>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Filter a catalog by <span className="font-mono text-foreground">genre = pop</span> and
            you get thousands of tracks that share a label but nothing else. Harmoniq reframes the
            task from classification — <em>what genre is this?</em> — to retrieval —{" "}
            <em>what sounds like this?</em> — by blending a learned latent embedding with raw
            audio features, genre family matching, and popularity signals into one ranked,
            explainable result.
          </p>
        </Reveal>

        <Reveal delay={240}>
          <div className="mt-9">
            <Link
              to="/recommendations"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Find recommendations
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </Reveal>

        <div className="mt-16">
          <ol className="grid gap-3 sm:grid-cols-5">
            {STEPS.map((s, i) => (
              <Reveal key={s.label} as="li" delay={i * 70}>
                <div className="h-full rounded-2xl border border-border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md">
                  <span className="num font-mono text-[10px] text-primary">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="mt-1 font-display text-sm font-semibold text-foreground">
                    {s.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.note}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>

        {statTiles.length > 0 && (
          <Reveal delay={0} className="mt-8">
            <dl className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
              {statTiles.map((s) => (
                <div key={s.v} className="bg-card p-6">
                  <dt className="num font-display text-2xl font-bold text-primary">{s.k}</dt>
                  <dd className="mt-1 text-xs text-muted-foreground">{s.v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        )}
      </section>
    </div>
  );
}
