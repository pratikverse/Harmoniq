# Harmoniq

A hybrid music recommendation system over a ~89,500-track Spotify catalog: search or browse for a
track, get ranked recommendations blending audio-feature similarity, genre-family matching, and
popularity — each with a per-feature explanation of why it was picked. Also includes mood-based
discovery, a genre explorer, a playlist builder with real Spotify export, and a latent-space
visualization.

Two deployables:

- **`src/api/`** — a FastAPI backend wrapping the recommendation engine.
- **`frontend/`** — a React + TypeScript + Vite + Tailwind frontend.

Both deploy to Render's free tier from a single `render.yaml` Blueprint (see
[Deployment](#deployment)).

## Hard constraint: the catalog is frozen

Spotify deprecated the Audio Features, Audio Analysis, and Recommendations endpoints for new
API applications on 2024-11-27, and closed the extended-access application route since. This
means:

- **The catalog cannot be refreshed or extended.** It's a fixed snapshot of an API that no
  longer exists for new applications.
- **Audio features for any track outside the catalog are unobtainable.** There is no
  "paste a Spotify link, get recommendations for it" path.
- `popularity` scores are frozen at whatever they were when the dataset was collected.

What's still fully available: the public embed player (`open.spotify.com/embed/track/<id>`),
`spotify:track:<id>` deep links, and real playlist creation via the Spotify Web API (Authorization
Code with PKCE) — playlist read/write endpoints were not part of the Nov 2024 deprecation.

## How recommendations work

1. **Search** — typo-tolerant fuzzy matching over track title/artist (RapidFuzz).
2. **Retrieval** — cosine-nearest-neighbor search over a 9-dimensional scaled-audio-feature
   embedding (danceability, energy, loudness, speechiness, acousticness, instrumentalness,
   liveness, valence, tempo). There is no autoencoder or other learned embedding — a 9-to-8
   bottleneck bought no real compression, so retrieval runs directly on the scaled features.
3. **Hybrid ranking** — candidates from four pools (latent-KNN, genre-family, popularity,
   raw-audio-similarity) are scored and blended: `latent_similarity`, `audio_similarity`,
   `genre_score`, `popularity_score`, `source_support_score` (how many pools agreed), each
   weighted per recommendation style (Balanced, Same vibe, Same genre, Discovery, More popular,
   More energetic).
4. **Diversification** — results are capped at 2 tracks per artist.
5. **Explanation** — each card shows the score breakdown and which audio features were closest.

## Running locally

Two processes:

```bash
# Backend (FastAPI) -- from repo root
conda create -n harmoniq python=3.13
conda activate harmoniq

pip install -r requirements.txt
uvicorn src.api.main:app --port 8000
```

```bash
# Frontend (React/Vite) -- from frontend/
npm install
npm run dev -- --port 5175
```

Requires the artifacts already committed under `models/` (`catalog.parquet`, `embedding.npy`,
`scaler.pkl`, `manifest.json`) — no separate download step needed to run the backend.
`frontend/.env.development` points the frontend at the local backend by default; copy
`frontend/.env.example` for the shape of what production needs (`VITE_API_BASE_URL`,
`VITE_SPOTIFY_CLIENT_ID`).

## Project layout

```
src/
  config.py              paths, dataset name, seed
  models/
    catalog.py            dataset download -> dedupe -> validity filters -> winsorize
    embedding.py           the scaled-feature retrieval embedding
    features.py            shared audio-feature constants
    recommender.py          candidate pools, hybrid ranking, diversification
    search.py               fuzzy search
    genre.py, mood.py       genre-family matching, mood scoring
    explain.py               per-recommendation explanation
    visualization.py         PCA projection, feature-correlation heatmap
    artifacts.py              save/load the inference artifact bundle
  api/
    main.py                   FastAPI app -- thin HTTP layer over src/models/*
    serializers.py             pandas/numpy -> JSON-safe conversion
frontend/
  src/
    pages/                     Overview, Recommendations, Mood, Genre, Playlist, Visualize, HowItWorks
    components/                 shared UI (cards, embeds, header, Spotify connect)
    lib/                        playlist state (localStorage), Spotify OAuth (PKCE)
    api.ts                      typed fetch wrapper over the FastAPI backend
render.yaml                 Render Blueprint (API + static frontend)
```

## Deployment

Everything runs on **Render's free tier**, defined by one `render.yaml`
Blueprint with two services:

| Service | Type | Build | Serves |
|---|---|---|---|
| `harmoniq` | Python web service | `pip install -r requirements.txt` → `uvicorn src.api.main:app` | the API; health check at `/api/health` |
| `harmoniq-web` | Static site | `npm ci && npm run build` in `frontend/`, publish `dist/` | the React app, with an SPA rewrite to `/index.html` |

The API is a native Python service — no Dockerfile, because nothing here
needs a system package. There is no database or object storage: the model
artifacts in `models/` (~11 MB, committed) are the entire state, loaded into
memory at boot.

**First deploy**

1. In the Render dashboard: **New → Blueprint**, point it at this repo. Render
   reads `render.yaml` and creates both services.
2. The frontend's `VITE_API_BASE_URL` is pulled from the API service
   automatically (`api.ts` upgrades a bare host to `https://`).
   `VITE_SPOTIFY_CLIENT_ID` is baked into `render.yaml` (a public identifier).
3. After the first build, note the real URLs, then:
   - set the API service's **`CORS_ORIGINS`** env var to the frontend URL
     (the one env var marked `sync: false`), which triggers a redeploy;
   - add `https://<frontend-url>/callback` to the Spotify app's **Redirect
     URIs** (below).

**Free-tier behaviour**: the API container sleeps after ~15 min idle; the
first request then pays a ~60 s cold start (process boot + artifact load).
The frontend's status banner (`lib/apiStatus.tsx`) is built around this — it
shows "waking up" rather than "offline" during the grace window.

**Spotify app**: register at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard),
add `https://<frontend-url>/callback` (and `http://localhost:5175/callback` for
local dev) under **Redirect URIs**. Apps start in Development Mode, capped at 5
explicitly-allowlisted Spotify accounts (Settings → User Management) — there is
currently no self-serve path to broader access.

**Local build parity**: `frontend/.env.production` holds fallback values for a
local `npm run build`; Render's injected env vars override them.

> `frontend/vercel.json` is left in place for anyone who prefers to host the
> frontend on Vercel instead — it carries the same SPA rewrite. It is unused by
> the Render deploy.
