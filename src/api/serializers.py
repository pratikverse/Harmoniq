"""
Convert pandas/numpy values coming out of the recommender into plain
JSON-safe Python types before FastAPI serializes them.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd


def to_native(value: Any) -> Any:
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, dict):
        return {key: to_native(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_native(item) for item in value]
    if pd.isna(value) if np.isscalar(value) else False:
        return None
    return value


def track_summary(row: pd.Series, index: int) -> dict:
    return {
        "index": index,
        "track_id": to_native(row.get("track_id")),
        "track_name": to_native(row.get("track_name")),
        "artists": to_native(row.get("artists")),
        "track_genre": to_native(row.get("track_genre")),
        "popularity": to_native(row.get("popularity")),
        "duration_ms": to_native(row.get("duration_ms")),
    }
