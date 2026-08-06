"""
Global configuration for Harmoniq.
"""

from pathlib import Path

# =============================================================================
# Project Directories
# =============================================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent

MODELS_DIR = PROJECT_ROOT / "models"

# =============================================================================
# Dataset
# =============================================================================

DATASET_NAME = "maharshipandya/spotify-tracks-dataset"

SEED = 42

# =============================================================================
# KNN
# =============================================================================

KNN_METRIC = "cosine"

KNN_ALGORITHM = "brute"

# =============================================================================
# Artifact Paths
#
# Phase 4 (docs/IMPROVEMENT_PLAN.md) replaced the autoencoder + KNN pickle
# + LabelEncoder with: a deduplicated parquet catalog, a scaled-feature
# embedding (no autoencoder -- see docs/FINDINGS.md finding 12), and a
# scaler. The KNN index itself is rebuilt from the embedding at load time
# (sklearn's brute-force NearestNeighbors.fit is O(1); it just stores a
# reference to the matrix) instead of being pickled, which removes a
# sklearn-version-fragile artifact for no benefit -- it held nothing but
# the same matrix already in embedding.npy.
# =============================================================================

CATALOG_PATH = MODELS_DIR / "catalog.parquet"

EMBEDDING_PATH = MODELS_DIR / "embedding.npy"

SCALER_PATH = MODELS_DIR / "scaler.pkl"

MANIFEST_PATH = MODELS_DIR / "manifest.json"
