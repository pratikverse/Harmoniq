"""
The retrieval embedding TuneMatch's KNN operates over.

Replaces the 9->64->32->8 autoencoder (docs/IMPROVEMENT_PLAN.md Phase 4,
docs/FINDINGS.md finding 12): with only 9 real audio features, the
bottleneck bought no real dimensionality reduction, and its ReLU
activation confined every embedding to the non-negative orthant,
compressing all pairwise cosine similarities toward 1. A plain scaled-
feature space is smaller to ship (no TensorFlow), reproducible without
GPU-dependent training, and every dimension stays directly attributable
to an audio feature -- which is also what the explanation UI (finding 7)
already compares against.

Genre is deliberately excluded: it participates in ranking through
compute_genre_score/_genre_match_mask (see src/models/recommender.py),
which handle its multi-label reality (docs/FINDINGS.md finding 2)
properly. Feeding it into the embedding as a LabelEncoder integer, as
the old pipeline did, imposed an arbitrary alphabetical distance between
unrelated genres.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

from src.models.features import AUDIO_FEATURES


def fit_embedding(catalog: pd.DataFrame) -> tuple[np.ndarray, StandardScaler]:
    scaler = StandardScaler()
    matrix = scaler.fit_transform(catalog[AUDIO_FEATURES].to_numpy(dtype=float))
    return matrix.astype(np.float32), scaler


def encode(scaler: StandardScaler, catalog: pd.DataFrame) -> np.ndarray:
    matrix = scaler.transform(catalog[AUDIO_FEATURES].to_numpy(dtype=float))
    return matrix.astype(np.float32)
