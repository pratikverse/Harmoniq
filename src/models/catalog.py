"""
Catalog construction: raw dataset -> dedupe -> validity filters ->
winsorize -> skew transforms.

Replaces load_and_preprocess_data's IQR-cascade approach
(docs/FINDINGS.md finding 4), which discarded ~40% of the catalog --
disproportionately quiet, slow, and instrumental tracks -- because each
feature's quantiles were computed on the frame already shrunk by every
prior feature's filter. `study` and `sleep`, the two genres the Mood
tab's "Study"/"Sleep" categories depend on, were left with 11 and 36
surviving tracks respectively out of 1,000.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from datasets import load_dataset

from src.config import DATASET_NAME
from src.models.features import AUDIO_FEATURES

# speechiness, instrumentalness, liveness, acousticness are all
# zero-inflated and heavily right-skewed; StandardScaler on the raw
# values would let a handful of extreme outliers dominate distance.
SKEWED_FEATURES = [
    "speechiness",
    "instrumentalness",
    "liveness",
    "acousticness",
]

WINSOR_LOWER_QUANTILE = 0.01
WINSOR_UPPER_QUANTILE = 0.99

_NON_AGGREGATED_COLUMNS = {"track_genre", "popularity", "track_id", "Unnamed: 0"}


def load_raw_dataset(dataset_name: str = DATASET_NAME) -> pd.DataFrame:
    dataset = load_dataset(dataset_name)
    return pd.DataFrame(dataset["train"])


def _aggregate_duplicate_tracks(raw: pd.DataFrame) -> pd.DataFrame:
    """
    ~114,000 -> ~51,700 rows: the raw dataset relists the same track_id
    under multiple genre labels with byte-identical audio features
    (docs/FINDINGS.md finding 2). Aggregate to one row per track_id,
    keeping every genre label it was ever listed under.
    """

    grouped = raw.groupby("track_id", sort=False)

    genres = grouped["track_genre"].agg(lambda values: tuple(dict.fromkeys(values)))
    popularity = grouped["popularity"].max()

    first_columns = [
        column for column in raw.columns if column not in _NON_AGGREGATED_COLUMNS
    ]
    catalog = grouped[first_columns].first()

    catalog = catalog.join(genres.rename("genres")).join(popularity)
    catalog = catalog.reset_index()
    catalog["track_genre"] = catalog["genres"].apply(lambda values: values[0])
    return catalog


def _apply_validity_filters(catalog: pd.DataFrame) -> pd.DataFrame:
    """
    Hard, defensible validity checks only -- not a statistical outlier
    filter. This is what makes the catalog keep quiet/slow/instrumental
    genres instead of treating them as noise.
    """

    mask = (
        (catalog["duration_ms"].fillna(0) > 30_000)
        & (catalog["tempo"].fillna(0) > 0)
        & catalog["loudness"].between(-60, 5)
    )
    for feature in AUDIO_FEATURES:
        if feature in ("loudness", "tempo"):
            continue
        mask &= catalog[feature].between(0, 1)

    return catalog[mask].reset_index(drop=True)


def _winsorize(catalog: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    catalog = catalog.copy()
    for column in columns:
        lower = catalog[column].quantile(WINSOR_LOWER_QUANTILE)
        upper = catalog[column].quantile(WINSOR_UPPER_QUANTILE)
        catalog[column] = catalog[column].clip(lower, upper)
    return catalog


def _apply_skew_transforms(catalog: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    catalog = catalog.copy()
    for column in columns:
        catalog[column] = np.log1p(catalog[column].clip(lower=0))
    return catalog


def build_catalog(dataset_name: str = DATASET_NAME) -> pd.DataFrame:
    raw = load_raw_dataset(dataset_name)
    catalog = _aggregate_duplicate_tracks(raw)
    catalog = catalog.dropna(subset=AUDIO_FEATURES).reset_index(drop=True)
    catalog = _apply_validity_filters(catalog)
    catalog = _winsorize(catalog, AUDIO_FEATURES)
    catalog = _apply_skew_transforms(catalog, SKEWED_FEATURES)
    return catalog.reset_index(drop=True)
