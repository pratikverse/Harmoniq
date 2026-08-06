import { useEffect, useMemo, useState } from "react";
import { getHeatmap, getPcaProjection, type PcaPoint } from "../api";

const PALETTE = [
  "oklch(0.85 0.03 90)",
  "oklch(0.68 0.17 195)",
  "oklch(0.72 0.16 150)",
  "oklch(0.78 0.16 85)",
  "oklch(0.68 0.2 340)",
  "oklch(0.7 0.15 60)",
  "oklch(0.6 0.18 280)",
  "oklch(0.75 0.14 20)",
];
const OTHER_COLOR = "oklch(0.4 0.01 85)";

function ScatterPlot({ points }: { points: PcaPoint[] }) {
  const { topGenres, colorFor, xDomain, yDomain } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of points) counts.set(p.genre, (counts.get(p.genre) ?? 0) + 1);
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const top = new Set(sorted.map(([genre]) => genre));
    const colorMap = new Map(sorted.map(([genre], i) => [genre, PALETTE[i]]));

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.pc1);
      maxX = Math.max(maxX, p.pc1);
      minY = Math.min(minY, p.pc2);
      maxY = Math.max(maxY, p.pc2);
    }

    return {
      topGenres: sorted.map(([genre]) => genre),
      colorFor: (genre: string) => (top.has(genre) ? colorMap.get(genre)! : OTHER_COLOR),
      xDomain: [minX, maxX] as const,
      yDomain: [minY, maxY] as const,
    };
  }, [points]);

  const width = 900;
  const height = 620;
  const pad = 24;

  const scaleX = (v: number) =>
    pad + ((v - xDomain[0]) / (xDomain[1] - xDomain[0] || 1)) * (width - pad * 2);
  const scaleY = (v: number) =>
    height - pad - ((v - yDomain[0]) / (yDomain[1] - yDomain[0] || 1)) * (height - pad * 2);

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full rounded-md border border-border bg-surface"
      >
        {points.map((p, i) => (
          <circle
            key={i}
            cx={scaleX(p.pc1)}
            cy={scaleY(p.pc2)}
            r={2.2}
            fill={colorFor(p.genre)}
            opacity={0.75}
          >
            <title>
              {p.track_name} — {p.artists} ({p.genre})
            </title>
          </circle>
        ))}
      </svg>
      <div className="mt-3 flex flex-wrap gap-3">
        {topGenres.map((genre) => (
          <span key={genre} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="size-2.5 rounded-full"
              style={{ background: PALETTE[topGenres.indexOf(genre)] }}
            />
            {genre}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2.5 rounded-full" style={{ background: OTHER_COLOR }} />
          other
        </span>
      </div>
    </div>
  );
}

function Heatmap({ features, matrix }: { features: string[]; matrix: number[][] }) {
  function colorFor(value: number) {
    // Diverging scale: negative -> chart-5 (magenta), positive -> primary (cream).
    const t = Math.min(Math.abs(value), 1);
    return value >= 0
      ? `oklch(0.85 0.03 90 / ${0.15 + t * 0.65})`
      : `oklch(0.68 0.2 340 / ${0.15 + t * 0.65})`;
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="inline-grid gap-px rounded-md border border-border bg-border"
        style={{ gridTemplateColumns: `8rem repeat(${features.length}, 4.5rem)` }}
      >
        <div className="bg-surface" />
        {features.map((f) => (
          <div key={f} className="bg-surface p-2 text-center text-[10px] text-muted-foreground">
            {f}
          </div>
        ))}
        {matrix.map((row, i) => (
          <>
            <div key={`label-${i}`} className="bg-surface p-2 text-xs text-muted-foreground">
              {features[i]}
            </div>
            {row.map((value, j) => (
              <div
                key={`${i}-${j}`}
                className="flex items-center justify-center p-2 text-[10px] num"
                style={{ background: colorFor(value) }}
                title={`${features[i]} × ${features[j]}: ${value.toFixed(2)}`}
              >
                {value.toFixed(2)}
              </div>
            ))}
          </>
        ))}
      </div>
    </div>
  );
}

export default function Visualize() {
  const [points, setPoints] = useState<PcaPoint[] | null>(null);
  const [heatmap, setHeatmap] = useState<{ features: string[]; matrix: number[][] } | null>(null);

  useEffect(() => {
    getPcaProjection().then((response) => setPoints(response.points));
    getHeatmap().then(setHeatmap);
  }, []);

  return (
    <section className="mx-auto max-w-7xl px-5 py-12">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Visualization</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        A 2D projection (first two principal components) of the retrieval embedding, stratified-
        sampled to ~8,000 tracks across the catalog's genres, plus the audio-feature correlation
        matrix the ranking weights are tuned against.
      </p>

      <div className="mt-8">
        <h2 className="font-display text-xl font-semibold">Latent space</h2>
        {points ? <ScatterPlot points={points} /> : (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        )}
      </div>

      <div className="mt-12">
        <h2 className="font-display text-xl font-semibold">Feature correlation</h2>
        {heatmap ? (
          <div className="mt-4">
            <Heatmap features={heatmap.features} matrix={heatmap.matrix} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        )}
      </div>
    </section>
  );
}
