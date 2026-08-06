# Harmoniq

A hybrid music recommendation system over a ~89,500-track Spotify catalog: search or browse for a
track, get ranked recommendations blending audio-feature similarity, genre-family matching, and
popularity — each with a per-feature explanation of why it was picked. Also includes mood-based
discovery, a genre explorer, a playlist builder with real Spotify export, and a latent-space
visualization.

Two deployables:

- **`src/api/`** — a FastAPI backend wrapping the recommendation engine, deployed on Render.
- **`frontend/`** — a React + TypeScript + Vite + Tailwind frontend, deployed on Vercel.

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
render.yaml                 Render deploy config (backend)
```

## Deployment

- **Backend (Render)**: `render.yaml` builds with `pip install -r requirements.txt` and runs
  `uvicorn src.api.main:app`.
- **Frontend (Vercel)**: root directory `frontend/`, framework auto-detected (Vite). Set
  `VITE_API_BASE_URL` to the Render backend URL and `VITE_SPOTIFY_CLIENT_ID` for Spotify playlist
  export. `frontend/vercel.json` adds the SPA rewrite rule client-side routing needs.
- **Spotify app**: register at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard),
  add each deployment's `/callback` URL (e.g. `https://your-app.vercel.app/callback`) under
  Redirect URIs. Apps start in Development Mode, capped at 5 explicitly-allowlisted Spotify
  accounts (Settings → User Management) — there's currently no self-serve path to broader access.
