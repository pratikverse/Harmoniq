"""
FastAPI backend for the Harmoniq Recommendations page.

Wraps the existing recommender/search/explain modules -- no ranking or
retrieval logic lives here, this is a thin HTTP layer over
src/models/*.py so the React frontend (and any future client) can call
the same recommendation engine the Streamlit app used.
"""

from __future__ import annotations

import random
import sys
from functools import lru_cache
from pathlib import Path

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.api.serializers import to_native, track_summary
from src.models.artifacts import load_artifacts
from src.models.explain import explain_recommendation
from src.models.features import AUDIO_FEATURES
from src.models.genre import (
    GENRE_EXPLORER_OPTIONS,
    generate_genre_playlist,
    recommend_by_genre,
)
from src.models.mood import MOOD_ORDER, assign_moods, explain_mood_fit, recommend_by_mood
from src.models.recommender import (
    INTENT_WEIGHT_PROFILES,
    get_track_details,
    get_weight_profile,
    normalize_weights,
    recommend_tracks,
)
from src.models.search import build_search_index, intelligent_search
from src.models.visualization import calculate_correlation, calculate_pca

app = FastAPI(title="Harmoniq API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://harmoniq-ruddy.vercel.app",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@lru_cache(maxsize=1)
def get_resources() -> dict:
    return load_artifacts()


@lru_cache(maxsize=1)
def get_search_index():
    return build_search_index(get_resources()["dataframe"])


@lru_cache(maxsize=1)
def get_mood_catalog():
    return assign_moods(get_resources()["dataframe"])


@lru_cache(maxsize=1)
def get_pca_projection():
    resources = get_resources()
    df = resources["dataframe"]
    projection = calculate_pca(resources["latent_features"])

    sample_per_genre = 200
    max_points = 8000
    rng = np.random.default_rng(42)

    indices = np.arange(len(df))
    if len(df) > max_points:
        sampled = []
        for _, group in df.groupby("track_genre").indices.items():
            group_indices = np.asarray(group)
            if len(group_indices) > sample_per_genre:
                group_indices = rng.choice(group_indices, sample_per_genre, replace=False)
            sampled.append(group_indices)
        indices = np.concatenate(sampled)
        if len(indices) > max_points:
            indices = rng.choice(indices, max_points, replace=False)

    return projection, indices


class RecommendRequest(BaseModel):
    track_index: int
    intent: str = "Balanced"
    weights: dict[str, float] | None = None


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/stats")
def stats() -> dict:
    df = get_resources()["dataframe"]
    return {
        "songs": int(len(df)),
        "artists": int(df["artists"].nunique()),
        "genres": int(df["track_genre"].nunique()),
    }


@app.get("/api/intents")
def intents() -> dict:
    return {
        "intents": [
            {"name": name, "weights": to_native(weights)}
            for name, weights in INTENT_WEIGHT_PROFILES.items()
        ]
    }


@app.get("/api/search")
def search(q: str, limit: int = 12) -> dict:
    matches = intelligent_search(q, get_search_index(), limit=limit)
    return {"matches": matches}


@app.get("/api/browse")
def browse(limit: int = 500) -> dict:
    df = get_resources()["dataframe"]
    if "popularity" in df.columns:
        browse_df = df.sort_values("popularity", ascending=False).head(limit)
    else:
        browse_df = df.head(limit)

    return {
        "tracks": [
            track_summary(row, index) for index, row in browse_df.iterrows()
        ]
    }


@app.post("/api/recommend")
def recommend(request: RecommendRequest) -> dict:
    resources = get_resources()
    df = resources["dataframe"]

    if request.track_index < 0 or request.track_index >= len(df):
        raise HTTPException(status_code=404, detail="Unknown track_index.")

    weights = (
        normalize_weights(request.weights)
        if request.weights
        else get_weight_profile(request.intent)
    )

    selected_track = get_track_details(df, request.track_index)
    recommendations = recommend_tracks(
        track_index=request.track_index,
        dataframe=df,
        latent_features=resources["latent_features"],
        knn=resources["knn"],
        intent=request.intent,
        weights=weights,
    )

    recommendation_payloads = []
    for offset, row in recommendations.iterrows():
        explanation = explain_recommendation(selected_track, row)
        recommendation_payloads.append(
            {
                **track_summary(row, int(offset)),
                "ranking_score": to_native(row["ranking_score"]),
                "explanation": to_native(explanation),
            }
        )

    return {
        "selected_track": track_summary(selected_track, request.track_index),
        "recommendations": recommendation_payloads,
    }


@app.get("/api/moods")
def moods() -> dict:
    return {"moods": MOOD_ORDER}


@app.get("/api/mood/{mood}")
def mood_recommendations(mood: str, limit: int = 12) -> dict:
    if mood not in MOOD_ORDER:
        raise HTTPException(status_code=404, detail="Unknown mood.")

    catalog = get_mood_catalog()
    results = recommend_by_mood(catalog, mood, n_recommendations=limit)

    payloads = []
    for offset, row in results.iterrows():
        payloads.append(
            {
                **track_summary(row, int(offset)),
                "mood": to_native(row["mood"]),
                "mood_score": to_native(row[f"{mood.lower()}_score"]),
                "mood_match_score": to_native(row["mood_match_score"]),
                "reasons": explain_mood_fit(row, mood),
            }
        )

    return {"mood": mood, "tracks": payloads}


@app.get("/api/genres")
def genres() -> dict:
    return {"genres": GENRE_EXPLORER_OPTIONS}


@app.get("/api/genre/{genre}")
def genre_explorer(
    genre: str,
    limit: int = 12,
    playlist_size: int = 20,
    shuffle: bool = False,
) -> dict:
    if genre not in GENRE_EXPLORER_OPTIONS:
        raise HTTPException(status_code=404, detail="Unknown genre.")

    df = get_resources()["dataframe"]
    random_state = random.randint(0, 2**31 - 1) if shuffle else None

    recommendations = recommend_by_genre(
        df, genre, n_recommendations=limit, shuffle=shuffle, random_state=random_state
    )
    playlist = generate_genre_playlist(
        df, genre, playlist_size=playlist_size, shuffle=shuffle, random_state=random_state
    )

    return {
        "genre": genre,
        "recommendations": [
            track_summary(row, int(offset)) for offset, row in recommendations.iterrows()
        ],
        "playlist": [
            track_summary(row, int(offset)) for offset, row in playlist.iterrows()
        ],
    }


@app.get("/api/visualization/pca")
def visualization_pca() -> dict:
    df = get_resources()["dataframe"]
    projection, indices = get_pca_projection()

    points = [
        {
            "pc1": float(projection[i, 0]),
            "pc2": float(projection[i, 1]),
            "pc3": float(projection[i, 2]),
            "genre": to_native(df.iloc[i]["track_genre"]),
            "track_name": to_native(df.iloc[i]["track_name"]),
            "artists": to_native(df.iloc[i]["artists"]),
        }
        for i in indices
    ]

    return {"points": points}


@app.get("/api/visualization/heatmap")
def visualization_heatmap() -> dict:
    df = get_resources()["dataframe"]
    correlation = calculate_correlation(df, AUDIO_FEATURES)

    return {
        "features": list(correlation.columns),
        "matrix": to_native(correlation.values.tolist()),
    }
