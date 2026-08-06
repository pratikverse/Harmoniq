"""
FastAPI backend for the Harmoniq Recommendations page.

Wraps the existing recommender/search/explain modules -- no ranking or
retrieval logic lives here, this is a thin HTTP layer over
src/models/*.py so the React frontend (and any future client) can call
the same recommendation engine the Streamlit app used.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
import sys

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.api.serializers import to_native, track_summary
from src.models.artifacts import load_artifacts
from src.models.explain import explain_recommendation
from src.models.recommender import (
    INTENT_WEIGHT_PROFILES,
    get_track_details,
    get_weight_profile,
    normalize_weights,
    recommend_tracks,
)
from src.models.search import build_search_index, intelligent_search

app = FastAPI(title="Harmoniq API")

app.add_middleware(
    CORSMiddleware,
    # Tightened via ALLOWED_ORIGINS once the Vercel domain is known; wide
    # open for now since every response here is public catalog data.
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@lru_cache(maxsize=1)
def get_resources() -> dict:
    return load_artifacts()


@lru_cache(maxsize=1)
def get_search_index():
    return build_search_index(get_resources()["dataframe"])


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
