const STAGES = [
  {
    title: "Search",
    model: "RapidFuzz",
    body: "Typo-tolerant fuzzy matching over track title and artist. Search text is pre-processed once at load time, not re-normalized per keystroke, so a query runs entirely in RapidFuzz's C batch matcher instead of falling back to a Python callback per candidate.",
  },
  {
    title: "Latent KNN",
    model: "sklearn NearestNeighbors",
    body: "Brute-force cosine search over a 9-dimensional scaled audio-feature embedding (danceability, energy, loudness, speechiness, acousticness, instrumentalness, liveness, valence, tempo). There's no autoencoder here -- a 9-to-8 bottleneck bought no real compression, so retrieval runs directly on the scaled features.",
  },
  {
    title: "Hybrid rank",
    model: "Weighted blend",
    body: "Candidates are pooled from four sources -- latent-KNN, genre-family match, popularity, and raw audio similarity -- then scored with a weighted blend that varies by recommendation style: Balanced, Same vibe, Same genre, Discovery, More popular, More energetic.",
  },
  {
    title: "Explain",
    model: "Feature deltas",
    body: "Every recommendation carries a breakdown: which score components drove the ranking, whether the genre matched exactly or through a broader family, and which individual audio features were closest to the seed track, normalized so BPM and dB deltas are comparable to 0-1 features.",
  },
  {
    title: "Results",
    model: "Diversify",
    body: "Results are deduplicated by track/artist and capped at 2 tracks per artist before the top 10 are returned, so one popular artist can't dominate a single recommendation list.",
  },
];

const COMPONENTS = [
  ["Mood", "Six weighted heuristics (Workout/Study/Sleep/Party/Happy/Sad) over the same audio features, no separate model."],
  ["Genre Explorer", "Dataset genre labels mapped into five broad families via keyword + token matching."],
  ["Playlist", "Built and stored entirely client-side -- no account, no server-side session."],
  ["Visualization", "3D PCA projection of the retrieval embedding, stratified-sampled per genre for the browser."],
];

const LIMITS = [
  "Spotify deprecated the Audio Features, Audio Analysis, and Recommendations endpoints for new apps in Nov 2024 -- the catalog is a frozen snapshot and cannot be extended or refreshed.",
  "There's no \"paste a Spotify link, get recommendations\" path -- audio features for anything outside the catalog are unobtainable.",
  "Popularity scores reflect whenever the dataset was collected, not current listening trends.",
  "No user accounts, no learning from feedback -- every session starts from the same catalog and the same recommender.",
];

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-16">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">How it works</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        One pipeline, five stages. A search resolves to a track, retrieval finds nearest neighbors
        in audio-feature space, four candidate pools are blended into one ranked list, and every
        result comes with a human-readable reason it was picked.
      </p>

      <ol className="mt-12 space-y-px overflow-hidden rounded-md border border-border bg-border">
        {STAGES.map((s, i) => (
          <li key={s.title} className="bg-surface p-5">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
              <span className="num font-mono text-xs text-primary">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="truncate font-display text-base font-semibold">{s.title}</h2>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {s.model}
                  </span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-14">
        <h2 className="font-display text-xl font-semibold">The other pages</h2>
        <dl className="mt-4 divide-y divide-border rounded-md border border-border bg-surface">
          {COMPONENTS.map(([k, v]) => (
            <div key={k} className="grid gap-1 p-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
              <dt className="font-mono text-xs text-primary">{k}</dt>
              <dd className="text-sm text-muted-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-14">
        <h2 className="font-display text-xl font-semibold">Hard constraints</h2>
        <ul className="mt-4 space-y-2">
          {LIMITS.map((l) => (
            <li key={l} className="flex gap-3 text-sm text-muted-foreground">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              <span>{l}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
