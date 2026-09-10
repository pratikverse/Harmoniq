# Harmoniq — Hybrid Music Recommender

A recommendation system over a frozen ~89,500-track Spotify catalog. Two parts:

1. **Recommendation engine** (`src/`) — fuzzy track search, then cosine
   nearest-neighbour retrieval over a 9-dimensional scaled-audio-feature
   embedding, then a **hybrid re-rank** blending four candidate pools
   (latent-KNN, genre-family, genre-scoped popularity, raw-audio-similarity)
   under one of six **recommendation styles**, capped at 2 tracks per artist,
   with a per-feature **explanation** for every result. Also: 6-mood heuristic
   scoring, a 5-family genre explorer, and a PCA projection of the embedding.
2. **Serving + UI** — a thin **FastAPI** layer (`src/api/`) over the engine and
   a **React + TypeScript + Vite + Tailwind** frontend (`frontend/`), including
   a playlist builder that does **real Spotify playlist creation** via OAuth
   PKCE. Both deploy to **Render's free tier** from one `render.yaml` Blueprint.

## ⚠️ The catalog is frozen and cannot be extended

Spotify **deprecated the Audio Features, Audio Analysis, and Recommendations
endpoints for new API applications on 2024-11-27** and closed the
extended-access route. So:

- **The catalog is a fixed snapshot.** It cannot be refreshed or grown, and
  `popularity` scores are frozen at collection time.
- **There is no "paste a Spotify link, get recommendations" path** — audio
  features for any track outside the snapshot are unobtainable.
- What still works: the public embed player (`open.spotify.com/embed/track/<id>`),
  `spotify:track:<id>` deep links, and playlist read/write via the Web API
  (Authorization Code + PKCE) — not part of the Nov 2024 deprecation.

The model artifacts (`models/catalog.parquet`, `embedding.npy`, `scaler.pkl`,
`manifest.json`, ~11 MB) are committed to the repo and are the entire runtime
state — there is no database and no object storage.

## Layout

```
src/config.py                 paths, dataset name, seed
src/models/catalog.py         dataset -> dedupe -> validity filters -> winsorize -> skew transforms
src/models/embedding.py       the 9-dim scaled-feature retrieval embedding (no autoencoder — see Method notes)
src/models/features.py        shared audio-feature constants + normalizers + safe_float
src/models/search.py          RapidFuzz fuzzy search over pre-processed title/artist strings
src/models/recommender.py     4 candidate pools + hybrid ranking + per-artist diversification
src/models/genre.py           genre-family inference (keywords + token synonyms), genre explorer
src/models/mood.py            6-mood heuristic scoring + human-readable reasons
src/models/explain.py         per-recommendation explanation (normalized feature closeness)
src/models/visualization.py   PCA projection + feature-correlation heatmap (plotly lazy-imported)
src/models/artifacts.py       save/load the inference artifact bundle
src/api/main.py               FastAPI app — thin HTTP layer over src/models/*, single-load artifact cache
src/api/serializers.py        pandas / numpy -> JSON-safe conversion
frontend/src/pages/           Overview, Recommendations, Mood, Genre, Playlist, Visualize, HowItWorks
frontend/src/lib/             playlist state (localStorage), Spotify OAuth (PKCE + state)
frontend/src/api.ts           typed fetch wrapper over the FastAPI backend
render.yaml                   Render Blueprint: Python API service + static frontend site
requirements.txt              API runtime deps (pinned); requirements-dev.txt adds the Streamlit/notebook stack
```

## Quick start

```bash
# Backend (FastAPI) — from repo root
conda create -n harmoniq python=3.11 && conda activate harmoniq
pip install -r requirements.txt
uvicorn src.api.main:app --port 8000        # docs at http://127.0.0.1:8000/docs
```

```bash
# Frontend (React / Vite) — from frontend/
npm install
npm run dev -- --port 5175                  # http://localhost:5175
```

No download step: the backend loads the committed `models/` artifacts at boot.
`frontend/.env.development` already points the frontend at `localhost:8000`;
`frontend/.env.example` shows the two vars a production build needs
(`VITE_API_BASE_URL`, `VITE_SPOTIFY_CLIENT_ID`).

```bash
curl -X POST localhost:8000/api/recommend -H 'Content-Type: application/json' \
     -d '{"track_index": 100, "intent": "Balanced"}'
```

Endpoints: `GET /api/search`, `/api/browse`, `/api/stats`, `/api/intents`,
`/api/moods`, `/api/mood/{mood}`, `/api/genres`, `/api/genre/{genre}`,
`/api/visualization/{pca,heatmap}`, `POST /api/recommend`, `GET /api/health`.

## Deploying (Render free tier)

One `render.yaml` Blueprint, two services:

| Service | Type | Build | Serves |
|---|---|---|---|
| `harmoniq` | Python web service | `pip install -r requirements.txt` → `uvicorn src.api.main:app` | the API; health check `/api/health` |
| `harmoniq-web` | Static site | `npm ci && npm run build` in `frontend/`, publish `dist/` | the React app; SPA rewrite to `/index.html` |

Native Python — no Dockerfile, because nothing here needs a system package.
`VITE_API_BASE_URL` / `VITE_SPOTIFY_CLIENT_ID` are baked into `render.yaml`
(both public). After the first deploy: set the API's **`CORS_ORIGINS`** env var
(marked `sync: false`) to the frontend URL, and add
`https://<frontend-url>/callback` to the Spotify app's **Redirect URIs**.

**Free-tier behaviour**: the API sleeps after ~15 min idle; the first request
then pays a ~60 s cold start (boot + artifact load). `lib/apiStatus.tsx` is
built around this — it shows "waking up", not "offline", during the grace
window. `frontend/vercel.json` is left in place as an optional Vercel
alternative; the Render deploy ignores it.

## Method notes

**No learned embedding.** Retrieval runs directly on the 9 scaled audio
features. An earlier `9→64→32→8` autoencoder was retired: with only 9 real
features the bottleneck bought no dimensionality reduction, its ReLU confined
every vector to the non-negative orthant (compressing all pairwise cosine
similarities toward 1), and a plain scaled space keeps every dimension directly
attributable to an audio feature — which is what the explanation UI needs
anyway. Genre is deliberately kept *out* of the embedding and handled in
ranking instead, where its multi-label reality can be treated properly rather
than forced into an arbitrary alphabetical `LabelEncoder` distance.

**Four candidate pools, then one blended score.** `latent-KNN` (cosine
neighbours in embedding space), `genre-family` (exact + broad-family matches,
popularity-ordered), `popularity` (top tracks *within the seed's genre
families*, not a global top-N — a global pool triple-counts popularity and
fights the "Discovery" style), and `raw-audio-similarity` (weighted per-feature
closeness). Pools are unioned; `source_support_score` records how many pools
independently surfaced each track. The final `ranking_score` is a weighted sum
of `latent_similarity`, `audio_similarity`, `genre_score`, `popularity_score`,
`source_support_score`, and an `intent_bonus_score`, with the weights chosen per
recommendation style (Balanced, Same vibe, Same genre, Discovery, More popular,
More energetic).

**Dense similarities for the whole pool.** Every candidate — even a
genre-only or popularity-only one — gets a real cosine `latent_similarity` to
the seed and a real `audio_similarity`, computed after the union rather than
left `NaN` for tracks a given pool didn't score. (Leaving them `NaN` had sorted
every non-latent candidate to the bottom.)

**Search is pre-processed once.** `build_search_index` stores each track's
RapidFuzz-normalized string at load time, so `intelligent_search` runs the
C-level batch matcher with `processor=None` instead of re-normalizing ~68k
strings per keystroke. It blends exact-substring, `WRatio`, and
`partial_ratio` hits.

**Explanations use normalized deltas.** Feature closeness is thresholded on the
difference divided by that feature's natural range (`FEATURE_NORMALIZERS`), so
tempo (BPM) and loudness (dB) can actually register as "close" — a raw-delta
threshold made that structurally impossible. Reported differences stay in each
feature's natural units.

**Retrieval indices round-trip.** `POST /api/recommend` returns each
recommendation's real catalog index (the frame is re-indexed internally after a
groupby, so the position in the ranked frame is *not* the catalog index) — so a
client can request follow-on recommendations for any result. User-supplied
`limit` / `playlist_size` params are clamped.

**Spotify OAuth is PKCE with `state`.** No client secret; the browser exchanges
the code directly with Spotify. A `state` parameter is generated, stored, and
verified on callback (CSRF), and the callback is guarded against React
StrictMode's double invocation.

## Limitations

- **No evaluation harness.** The catalog is unlabelled and frozen, so there is
  no held-out purchase/next-play signal to score against. Recommendation
  quality is assessed by inspection, not a metric. The weights in
  `INTENT_WEIGHT_PROFILES` are hand-tuned, not learned.
- **Retrieval is in-memory sklearn**, not an ANN index or a vector DB — fine at
  89k rows on one box, not a design for a larger or growing catalog.
- **Single-process, single-instance.** The API loads the whole catalog into RAM
  and answers synchronously; the PCA projection is computed once per process
  and cached. It does not scale horizontally and is not meant to.
- **Multi-label genre is approximated** by keyword + token matching over the
  dataset's single `track_genre` label, not a real taxonomy.
- **`popularity` is a frozen snapshot value** and is treated as a static score,
  not a live signal.
- **Free-tier cold starts** (~60 s) are visible on the first request after idle;
  the Visualize page's first load is slower still (PCA over 89k rows +
  serializing 8k points).
