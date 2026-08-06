import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { getStats } from "../api";

const STEPS = [
  { label: "Search", note: "fuzzy + typo-tolerant" },
  { label: "Latent KNN", note: "8-d cosine neighbors" },
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
      <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[140px]"
        aria-hidden="true"
      />

      <section className="relative mx-auto max-w-7xl px-5 py-20 sm:py-28">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary">
          Hybrid recommender · research build
        </p>
        <h1 className="mt-5 max-w-3xl font-display text-4xl font-bold leading-[1.05] sm:text-6xl">
          Genres can&apos;t describe a sound.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Filter a catalog by <span className="font-mono text-foreground">genre = pop</span> and
          you get thousands of tracks that share a label but nothing else. Harmoniq reframes the
          task from classification — <em>what genre is this?</em> — to retrieval —{" "}
          <em>what sounds like this?</em> — by blending a learned latent embedding with raw audio
          features, genre family matching, and popularity signals into one ranked, explainable
          result.
        </p>

        <div className="mt-8">
          <Link
            to="/recommendations"
            className="inline-flex items-center gap-2 rounded-sm bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Find recommendations
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="mt-16">
          <ol className="grid gap-2 sm:grid-cols-5">
            {STEPS.map((s, i) => (
              <li
                key={s.label}
                className="rise rounded-md border border-border bg-surface p-3"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <span className="num font-mono text-[10px] text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="mt-1 font-display text-sm font-semibold">{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.note}</p>
              </li>
            ))}
          </ol>
        </div>

        {statTiles.length > 0 && (
          <dl className="mt-8 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
            {statTiles.map((s) => (
              <div key={s.v} className="bg-surface p-5">
                <dt className="num font-display text-2xl font-bold text-primary">{s.k}</dt>
                <dd className="mt-1 text-xs text-muted-foreground">{s.v}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </div>
  );
}
