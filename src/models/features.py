"""
Shared audio-feature constants and helpers used by both the ranking engine
(src/models/recommender.py) and the explanation UI (src/models/explain.py).

Consolidates what used to be three divergent _safe_float copies, and the
normalizers needed to fix docs/FINDINGS.md finding 7 (feature-closeness
thresholds compared against raw BPM/dB deltas instead of normalized ones).
"""

from __future__ import annotations

from typing import Any

import pandas as pd

AUDIO_FEATURES = [
    "danceability",
    "energy",
    "loudness",
    "speechiness",
    "acousticness",
    "instrumentalness",
    "liveness",
    "valence",
    "tempo",
]

AUDIO_FEATURE_WEIGHTS = {
    "danceability": 1.10,
    "energy": 1.25,
    "loudness": 0.60,
    "speechiness": 0.70,
    "acousticness": 1.00,
    "instrumentalness": 0.70,
    "liveness": 0.65,
    "valence": 1.15,
    "tempo": 1.05,
}

# Features aren't all on the same scale (tempo is BPM, loudness is dB, the
# rest are already 0-1). Any comparison of two tracks' feature values must
# divide by these before thresholding or weighting the difference.
FEATURE_NORMALIZERS = {
    "tempo": 120.0,
    "loudness": 30.0,
}

FEATURE_LABELS = {
    "danceability": "Danceability",
    "energy": "Energy",
    "tempo": "Tempo",
    "valence": "Mood",
    "acousticness": "Acousticness",
    "instrumentalness": "Instrumental feel",
    "speechiness": "Vocal style",
    "liveness": "Live feel",
    "loudness": "Loudness",
}

EXPLAINABLE_FEATURES = [
    "danceability",
    "energy",
    "tempo",
    "valence",
    "acousticness",
    "instrumentalness",
    "speechiness",
    "liveness",
    "loudness",
]


def safe_float(value: Any, default: float = 0.0) -> float:
    """Coerce a possibly-NaN/None/non-numeric value to a plain float."""

    try:
        if pd.isna(value):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default
