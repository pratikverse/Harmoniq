"""
Save/load the inference artifact bundle: catalog, embedding, scaler, and
a manifest. No autoencoder, encoder, LabelEncoder, or pickled KNN index
-- see src/models/embedding.py and docs/IMPROVEMENT_PLAN.md Phase 4 for
why the autoencoder was retired, and src/config.py for why the KNN index
is rebuilt at load time instead of pickled.
"""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from src.config import (
    CATALOG_PATH,
    EMBEDDING_PATH,
    MANIFEST_PATH,
    SCALER_PATH,
)

SCHEMA_VERSION = 2


def _ensure_artifact_exists(path: Path) -> Path:
    """
    Raise a clear error when a required artifact is missing.
    """
    if not path.exists():
        raise FileNotFoundError(
            f"Required artifact not found: {path}. "
            "Make sure the trained files in the models/ directory are committed and deployed."
        )
    return path


def save_bundle(
    dataframe: pd.DataFrame,
    latent_features: np.ndarray,
    scaler,
    manifest: dict,
) -> None:
    """
    Save every artifact required for inference.
    """

    dataframe.to_parquet(CATALOG_PATH)
    np.save(EMBEDDING_PATH, latent_features)
    joblib.dump(scaler, SCALER_PATH)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2))


def load_dataframe() -> pd.DataFrame:
    """
    Load the deduplicated catalog.
    """
    return pd.read_parquet(_ensure_artifact_exists(CATALOG_PATH))


def load_latent_features() -> np.ndarray:
    """
    Load the scaled-feature embedding.
    """
    return np.load(_ensure_artifact_exists(EMBEDDING_PATH))


def load_scaler():
    """
    Load the fitted StandardScaler.
    """
    return joblib.load(_ensure_artifact_exists(SCALER_PATH))


def load_manifest() -> dict:
    return json.loads(_ensure_artifact_exists(MANIFEST_PATH).read_text())


def load_knn(latent_features: np.ndarray | None = None):
    """
    Build the KNN index from the embedding. sklearn's brute-force
    NearestNeighbors.fit is O(1) -- it just stores a reference to the
    matrix -- so rebuilding at load time costs nothing and avoids
    pickling a sklearn object across version upgrades.
    """
    from src.models.recommender import build_knn_model

    if latent_features is None:
        latent_features = load_latent_features()
    return build_knn_model(latent_features)


def load_artifacts() -> dict:
    """
    Load every artifact needed by the application.
    """

    dataframe = load_dataframe()
    latent_features = load_latent_features()

    return {
        "dataframe": dataframe,
        "latent_features": latent_features,
        "knn": load_knn(latent_features),
        "scaler": load_scaler(),
        "manifest": load_manifest(),
    }
