# TuneMatch

A hybrid music recommendation system over a ~89,500-track Spotify catalog, deployed as an
interactive Streamlit app: search or browse for a track, get ranked recommendations blending
audio-feature similarity, genre-family matching, and popularity — each with a per-feature
explanation of why it was picked. Also includes mood-based discovery, a genre explorer, a
playlist builder, and a 3D latent-space visualization.

## Hard constraint: the catalog is frozen

Spotify deprecated the Audio Features, Audio Analysis, and Recommendations endpoints for new
API applications on 2024-11-27, and closed the extended-access application route since. This
means:

- **The catalog cannot be refreshed or extended.** It's a fixed snapshot of an API that no
  longer exists for new applications. `python -m src.training.train` re-downloads and
  re-processes the same frozen [HuggingFace dataset](https://huggingface.co/datasets/maharshipandya/spotify-tracks-dataset);
  it does not and cannot pull new tracks.
- **Audio features for any track outside the catalog are unobtainable.** There is no
  "paste a Spotify link, get recommendations for it" path.
- `popularity` scores are frozen at whatever they were when the dataset was collected.

What's still achievable without any API credentials — and what this app uses — is the public
embed player (`open.spotify.com/embed/track/<id>`) and `spotify:track:<id>` deep links.

## How recommendations work

1. **Search** — typo-tolerant fuzzy matching over track title/artist (RapidFuzz).
2. **Retrieval** — cosine-nearest-neighbor search over a 9-dimensional scaled-audio-feature
   embedding (danceability, energy, loudness, speechiness, acousticness, instrumentalness,
   liveness, valence, tempo). There is no autoencoder or other learned embedding — see
   [`docs/FINDINGS.md`](docs/FINDINGS.md) for why that was retired.
3. **Hybrid ranking** — candidates from four pools (latent-KNN, genre-family, popularity,
   raw-audio-similarity) are scored and blended: `latent_similarity`, `audio_similarity`,
   `genre_score`, `popularity_score`, `source_support_score` (how many pools agreed), each
   weighted per "recommendation style" (Balanced, Same vibe, Same genre, Discovery, More
   popular, More energetic) or by hand via the "Advanced: tune the mix" sliders.
4. **Diversification** — results are capped at 2 tracks per artist.
5. **Explanation** — each card shows the score breakdown and which audio features were closest.

## Running locally

```bash
pip install -r requirements.txt
streamlit run src/ui/app.py
```

Requires the artifacts already committed under `models/` (`catalog.parquet`, `embedding.npy`,
`scaler.pkl`, `manifest.json`) — no separate download step needed to run the app.

## Rebuilding the catalog and embedding

```bash
pip install -r requirements-train.txt   # adds `datasets`, for the HuggingFace download
python -m src.training.train
```

This re-downloads the raw dataset, deduplicates by `track_id` (the raw data relists the same
recording under multiple genre labels), applies validity filters (not a statistical outlier
filter — see finding 4 in `docs/FINDINGS.md` for why that distinction matters), winsorizes and
log-transforms the skewed features, fits a `StandardScaler`, and overwrites `models/`.

## Evaluation

```bash
python -m src.evaluation.run --run-id my-run --out reports/
python -m src.evaluation.run --compare reports/baseline.json reports/my-run.json
```

There's no user-interaction data, so there's no precision@k/recall@k/NDCG — see
`src/evaluation/metrics.py`'s module docstring for what's measured instead (genre consistency,
novelty, diversity, personalization, self-recommendation rate, latency) and why those metrics
are sanity checks, not proof of recommendation quality, on their own.

`reports/` holds one committed report per landmark change (`baseline.json` is the pre-any-fix
state) so results are diffable across the project's history.

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
    visualization.py         3D latent-space plot, feature-correlation heatmap
    artifacts.py              save/load the inference artifact bundle
  evaluation/               metrics + harness + CLI (see above)
  training/train.py          rebuild entrypoint
  ui/
    app.py                    entry point: theme, shared metrics row, navigation
    pages/                     one module per page (recommend, mood, genre, playlist, visualize)
    state.py, resources.py, components.py, theme.py
tests/
  unit/                      pure-function tests, synthetic catalog fixture
  evaluation/                 quality-gate tests against the real artifacts
  ui/                         Streamlit AppTest smokes
docs/
  IMPROVEMENT_PLAN.md          the phased plan this codebase was built from
  FINDINGS.md                  the audit backing it
```

## Testing

```bash
pip install -e .[dev]
pytest                          # full suite, needs the real models/ artifacts
pytest -m "not needs_artifacts"  # skips artifact-dependent tests (what CI runs)
```
