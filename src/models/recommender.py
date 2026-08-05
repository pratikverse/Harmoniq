"""
Recommendation engine for TuneMatch.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.neighbors import NearestNeighbors

from src.config import KNN_ALGORITHM, KNN_METRIC
from src.models.features import (
    AUDIO_FEATURE_WEIGHTS,
    AUDIO_FEATURES,
    FEATURE_NORMALIZERS,
)
from src.models.features import safe_float as _safe_float
from src.models.genre import infer_genre_families

# Flat weight applied to intent_bonus_score in every profile below. Kept as
# a fallback for weights dicts (e.g. future UI sliders) that omit the key.
INTENT_BONUS_WEIGHT = 0.03

INTENT_WEIGHT_PROFILES = {
    "Balanced": {
        "latent_similarity": 0.40,
        "audio_similarity": 0.28,
        "genre_score": 0.20,
        "popularity_score": 0.05,
        "source_support_score": 0.07,
        "intent_bonus_score": INTENT_BONUS_WEIGHT,
    },
    "Same vibe": {
        "latent_similarity": 0.50,
        "audio_similarity": 0.30,
        "genre_score": 0.10,
        "popularity_score": 0.03,
        "source_support_score": 0.07,
        "intent_bonus_score": INTENT_BONUS_WEIGHT,
    },
    "Same genre": {
        "latent_similarity": 0.28,
        "audio_similarity": 0.20,
        "genre_score": 0.38,
        "popularity_score": 0.05,
        "source_support_score": 0.09,
        "intent_bonus_score": INTENT_BONUS_WEIGHT,
    },
    "Discovery": {
        "latent_similarity": 0.34,
        "audio_similarity": 0.24,
        "genre_score": 0.16,
        "popularity_score": 0.02,
        "source_support_score": 0.24,
        "intent_bonus_score": INTENT_BONUS_WEIGHT,
    },
    "More popular": {
        "latent_similarity": 0.28,
        "audio_similarity": 0.18,
        "genre_score": 0.16,
        "popularity_score": 0.28,
        "source_support_score": 0.10,
        "intent_bonus_score": INTENT_BONUS_WEIGHT,
    },
    "More energetic": {
        "latent_similarity": 0.32,
        "audio_similarity": 0.30,
        "genre_score": 0.14,
        "popularity_score": 0.04,
        "source_support_score": 0.20,
        "intent_bonus_score": INTENT_BONUS_WEIGHT,
    },
}

INTENT_AUDIO_FEATURE_ADJUSTMENTS = {
    "Balanced": {},
    "Same vibe": {"energy": 1.1, "valence": 1.1},
    "Same genre": {},
    "Discovery": {"acousticness": 0.9, "speechiness": 0.9},
    "More popular": {},
    "More energetic": {"energy": 1.4, "tempo": 1.3, "danceability": 1.2},
}


def build_knn_model(
    latent_features: np.ndarray,
    metric: str = KNN_METRIC,
    algorithm: str = KNN_ALGORITHM,
) -> NearestNeighbors:
    """
    Train the KNN recommender.
    """

    knn = NearestNeighbors(
        metric=metric,
        algorithm=algorithm,
    )
    knn.fit(latent_features)
    return knn


def get_weight_profile(intent: str) -> dict[str, float]:
    """
    Resolve the active hybrid weight profile.
    """

    return INTENT_WEIGHT_PROFILES.get(
        intent,
        INTENT_WEIGHT_PROFILES["Balanced"],
    ).copy()


def normalize_weights(weights: dict[str, float]) -> dict[str, float]:
    """
    Scale a weights dict so its values sum to 1.0, keeping scores
    comparable to the fixed intent presets. Used by the UI weight
    sliders (raw slider values rarely sum to 1.0 on their own).
    """

    total = sum(weights.values())
    if total <= 0:
        return get_weight_profile("Balanced")
    return {key: value / total for key, value in weights.items()}


def get_audio_feature_weights(intent: str) -> dict[str, float]:
    """
    Resolve the active audio-feature weights for an intent.
    """

    weights = AUDIO_FEATURE_WEIGHTS.copy()
    for feature, multiplier in INTENT_AUDIO_FEATURE_ADJUSTMENTS.get(
        intent,
        {},
    ).items():
        weights[feature] = weights.get(feature, 1.0) * multiplier
    return weights


def _normalize_feature_similarity(
    feature: str,
    selected_values: np.ndarray,
    candidate_values: np.ndarray,
) -> np.ndarray:
    """
    Vectorized 0-1 similarity for one audio feature.
    """

    differences = np.abs(
        selected_values - candidate_values
    )
    normalizer = FEATURE_NORMALIZERS.get(feature, 1.0)
    normalized_difference = np.minimum(
        differences / normalizer,
        1.0,
    )
    return 1.0 - normalized_difference


def compute_audio_similarity_scores(
    selected_song: pd.Series,
    candidates: pd.DataFrame,
    intent: str = "Balanced",
) -> np.ndarray:
    """
    Compare songs directly using weighted raw audio features.
    """

    feature_weights = get_audio_feature_weights(intent)
    weighted_similarity = np.zeros(len(candidates))
    total_weight = 0.0

    for feature in AUDIO_FEATURES:
        if feature not in candidates.columns or feature not in selected_song:
            continue

        selected_value = _safe_float(selected_song[feature])
        candidate_values = (
            candidates[feature]
            .fillna(selected_value)
            .to_numpy(dtype=float)
        )

        similarities = _normalize_feature_similarity(
            feature,
            np.full(len(candidates), selected_value, dtype=float),
            candidate_values,
        )

        weight = feature_weights.get(feature, 1.0)
        weighted_similarity += similarities * weight
        total_weight += weight

    if total_weight == 0:
        return np.zeros(len(candidates))

    return weighted_similarity / total_weight




def compute_genre_score(
    selected_song: pd.Series,
    candidate_song: pd.Series,
) -> float:
    """
    Reward exact genre matches and broader genre-family matches.
    """

    selected_genre = str(
        selected_song.get("track_genre", "")
    ).strip().casefold()
    candidate_genre = str(
        candidate_song.get("track_genre", "")
    ).strip().casefold()

    if not selected_genre or not candidate_genre:
        return 0.0

    if selected_genre == candidate_genre:
        return 1.0

    selected_families = infer_genre_families(selected_genre)
    candidate_families = infer_genre_families(candidate_genre)

    if (
        selected_families
        and candidate_families
        and selected_families & candidate_families
    ):
        return 0.75

    selected_tokens = {
        token
        for token in selected_genre.replace("-", " ").split()
        if token
    }
    candidate_tokens = {
        token
        for token in candidate_genre.replace("-", " ").split()
        if token
    }

    if selected_tokens & candidate_tokens:
        return 0.45

    return 0.0


def _cosine_similarity_to_seed(
    seed_vector: np.ndarray,
    candidate_vectors: np.ndarray,
) -> np.ndarray:
    """
    Vectorized cosine similarity between one seed vector and many candidates.
    """

    seed_norm = np.linalg.norm(seed_vector)
    candidate_norms = np.linalg.norm(candidate_vectors, axis=1)
    denominator = seed_norm * candidate_norms
    dot_products = candidate_vectors @ seed_vector
    similarity = np.divide(
        dot_products,
        denominator,
        out=np.zeros_like(dot_products, dtype=float),
        where=denominator > 0,
    )
    return np.clip(similarity, -1.0, 1.0)


def _build_latent_candidate_pool(
    dataframe: pd.DataFrame,
    latent_features: np.ndarray,
    knn: NearestNeighbors,
    track_index: int,
    n_neighbors: int,
) -> pd.DataFrame:
    query = latent_features[track_index].reshape(1, -1)
    _distances, indices = knn.kneighbors(
        query,
        n_neighbors=n_neighbors + 1,
    )

    indices = indices.flatten()
    # The seed itself may not be neighbor 0: with duplicate latent vectors
    # (docs/FINDINGS.md finding 2/3) a distance tie can place a different
    # track first, silently dropping a real neighbor if we always slice
    # off position 0. Exclude the seed by identity instead.
    indices = indices[indices != track_index][:n_neighbors]

    candidates = dataframe.iloc[indices].copy()
    candidates["source_latent"] = 1
    return candidates


def _top_k_by_column(
    dataframe: pd.DataFrame,
    column: str,
    k: int,
) -> pd.DataFrame:
    """
    Unordered top-k selection by `column`, O(n) via argpartition instead of
    a full O(n log n) sort_values -- correct here because every caller's
    result gets re-sorted by ranking_score in rank_candidates anyway, so
    order within this top-k slice is thrown away regardless.
    """

    if column not in dataframe.columns or len(dataframe) <= k:
        return dataframe

    values = dataframe[column].to_numpy(dtype=float)
    values = np.where(np.isnan(values), -np.inf, values)
    top_positions = np.argpartition(-values, k - 1)[:k]
    return dataframe.iloc[top_positions]


def _genre_match_mask(
    dataframe: pd.DataFrame,
    selected_genre: str,
) -> pd.Series:
    """
    Boolean mask of catalog rows that exactly match or share a genre family
    with `selected_genre`. Computed once per request and shared between the
    genre pool and the (now genre-scoped) popularity pool, so the two don't
    each run an independent full-catalog genre-family scan.

    infer_genre_families does several substring/token scans per call, so
    it's evaluated once per UNIQUE genre string (~114 on the real catalog)
    rather than once per row (68,660) -- a >500x reduction in calls to it
    per request (docs/FINDINGS.md finding 9).
    """

    selected_families = infer_genre_families(selected_genre)

    genre_column = dataframe["track_genre"]
    unique_genres = genre_column.unique()
    family_by_genre = {
        genre: infer_genre_families(genre) for genre in unique_genres
    }

    family_match = genre_column.map(
        lambda genre: bool(selected_families & family_by_genre[genre])
    )
    exact_match = genre_column == selected_genre
    return exact_match | family_match


def _build_genre_candidate_pool(
    dataframe: pd.DataFrame,
    match_mask: pd.Series,
    limit: int = 150,
) -> pd.DataFrame:
    genre_df = dataframe[match_mask].copy()

    if genre_df.empty:
        return genre_df

    genre_df["source_genre"] = 1
    return _top_k_by_column(genre_df, "popularity", limit)


def _build_popularity_candidate_pool(
    dataframe: pd.DataFrame,
    match_mask: pd.Series,
    limit: int = 120,
) -> pd.DataFrame:
    """
    Popular tracks *within the seed's genre families*, not a fixed global
    top-N. A global pool injects the same tracks into every request
    regardless of intent, triple-counting popularity (pool membership +
    source_support_score + popularity_score) and fighting "Discovery"'s
    stated purpose (docs/FINDINGS.md finding 8).
    """

    popularity_df = dataframe[match_mask].copy() if match_mask.any() else dataframe.copy()
    popularity_df["source_popularity"] = 1

    return _top_k_by_column(popularity_df, "popularity", limit)


def _build_audio_candidate_pool(
    dataframe: pd.DataFrame,
    selected_song: pd.Series,
    selected_index: int,
    intent: str,
    limit: int = 150,
) -> pd.DataFrame:
    audio_df = dataframe.copy()
    audio_df["audio_similarity"] = compute_audio_similarity_scores(
        selected_song,
        audio_df,
        intent=intent,
    )
    # `selected_index` is a POSITION (dataframe.iloc[selected_index] is the
    # seed), but the original code excluded it via label-based
    # drop(index=...), correct only by coincidence when the index happens
    # to be a plain RangeIndex. Exclude by position explicitly instead.
    position_mask = np.arange(len(dataframe)) != selected_index
    audio_df = audio_df.loc[position_mask]
    audio_df["source_audio"] = 1
    return _top_k_by_column(audio_df, "audio_similarity", limit)


def build_candidate_pool(
    track_index: int,
    dataframe: pd.DataFrame,
    latent_features: np.ndarray,
    knn: NearestNeighbors,
    intent: str = "Balanced",
    n_neighbors: int = 80,
) -> tuple[pd.Series, pd.DataFrame]:
    """
    Blend candidates from latent, genre, popularity, and audio sources.
    """

    selected_song = dataframe.iloc[track_index]
    match_mask = _genre_match_mask(
        dataframe,
        str(selected_song.get("track_genre", "")),
    )

    latent_df = _build_latent_candidate_pool(
        dataframe,
        latent_features,
        knn,
        track_index,
        n_neighbors=n_neighbors,
    )
    genre_df = _build_genre_candidate_pool(
        dataframe,
        match_mask,
    )
    popularity_df = _build_popularity_candidate_pool(
        dataframe,
        match_mask,
    )
    audio_df = _build_audio_candidate_pool(
        dataframe,
        selected_song,
        track_index,
        intent=intent,
    )

    candidate_pool = pd.concat(
        [
            latent_df,
            genre_df,
            popularity_df,
            audio_df,
        ],
        axis=0,
        sort=False,
    )

    candidate_pool["row_index"] = candidate_pool.index
    candidate_pool = candidate_pool[
        candidate_pool["row_index"] != track_index
    ]

    source_columns = [
        "source_latent",
        "source_genre",
        "source_popularity",
        "source_audio",
    ]
    for column in source_columns:
        if column not in candidate_pool.columns:
            candidate_pool[column] = 0

    candidate_pool["source_support_score"] = (
        candidate_pool[source_columns]
        .fillna(0)
        .sum(axis=1)
        / len(source_columns)
    )

    # Aggregate every catalog column dynamically (not a hardcoded list) so
    # metadata the ranker doesn't score on -- album_name, duration_ms, and
    # anything added later -- survives the groupby instead of being
    # silently dropped (docs/FINDINGS.md finding 1).
    metadata_columns = [
        column for column in dataframe.columns if column not in source_columns
    ]
    agg_spec: dict[str, str] = {column: "first" for column in metadata_columns}
    agg_spec["source_support_score"] = "max"
    for column in source_columns:
        agg_spec[column] = "max"

    grouped = (
        candidate_pool.groupby("row_index", sort=False)
        .agg(agg_spec)
        .reset_index(drop=False)
    )

    # Dense latent similarity for the WHOLE pool: every candidate has a
    # well-defined cosine similarity to the seed -- it is not "missing"
    # for genre-only/popularity-only candidates, it was just never
    # computed for them by the latent-KNN pool. This is what fixes the
    # NaN ranking_score defect (docs/FINDINGS.md finding 1).
    seed_vector = latent_features[track_index]
    candidate_vectors = latent_features[grouped["row_index"].to_numpy()]
    grouped["latent_similarity"] = _cosine_similarity_to_seed(
        seed_vector,
        candidate_vectors,
    )

    return selected_song, grouped


def rank_candidates(
    selected_song: pd.Series,
    candidates: pd.DataFrame,
    intent: str = "Balanced",
    weights: dict[str, float] | None = None,
) -> pd.DataFrame:
    """
    Rank recommendation candidates using a tuned hybrid score.
    """

    ranked = candidates.copy()
    weights = weights if weights is not None else get_weight_profile(intent)

    # latent_similarity is supplied densely by build_candidate_pool for
    # every row; this guard only protects direct/test callers that pass a
    # candidates frame without it.
    if "latent_similarity" not in ranked.columns:
        ranked["latent_similarity"] = 0.0
    ranked["latent_similarity"] = ranked["latent_similarity"].fillna(0.0)

    # Recomputed unconditionally for the WHOLE pool -- audio_similarity is
    # a deterministic function of audio features, which every candidate
    # has via the "first" aggregation in build_candidate_pool. There is
    # nothing to guard: the old `if "audio_similarity" not in columns`
    # check never fired because the column was always present (full of
    # NaN for non-audio-pool rows), which is exactly what caused every
    # non-audio-pool candidate to sort to the bottom
    # (docs/FINDINGS.md finding 1).
    ranked["audio_similarity"] = compute_audio_similarity_scores(
        selected_song,
        ranked,
        intent=intent,
    )

    ranked["genre_score"] = ranked.apply(
        lambda row: compute_genre_score(
            selected_song,
            row,
        ),
        axis=1,
    )

    if "popularity" in ranked.columns:
        ranked["popularity_score"] = (
            ranked["popularity"].fillna(0) / 100.0
        )
    else:
        ranked["popularity_score"] = 0.0

    if intent == "More energetic":
        if "energy" in ranked.columns:
            ranked["intent_bonus_score"] = ranked["energy"].fillna(0.0)
        else:
            ranked["intent_bonus_score"] = 0.0
    elif intent == "Discovery":
        ranked["intent_bonus_score"] = 1.0 - ranked[
            "popularity_score"
        ]
    else:
        ranked["intent_bonus_score"] = 0.0

    ranked["ranking_score"] = (
        weights["latent_similarity"] * ranked["latent_similarity"]
        + weights["audio_similarity"] * ranked["audio_similarity"]
        + weights["genre_score"] * ranked["genre_score"]
        + weights["popularity_score"] * ranked["popularity_score"]
        + weights["source_support_score"] * ranked["source_support_score"]
        + weights.get("intent_bonus_score", INTENT_BONUS_WEIGHT)
        * ranked["intent_bonus_score"]
    )

    if ranked["ranking_score"].isna().any():
        raise ValueError(
            "rank_candidates produced NaN ranking_score(s) -- "
            "a required score column is missing or malformed."
        )

    ranked = ranked.sort_values(
        ["ranking_score", "source_support_score"],
        ascending=False,
    )
    return ranked


def diversify_artists(
    recommendations: pd.DataFrame,
    max_per_artist: int = 2,
) -> pd.DataFrame:
    """
    Prevent one artist from dominating recommendations.
    """

    if recommendations.empty:
        return recommendations

    keep_positions: list[int] = []
    artist_counter: dict[str, int] = {}

    for position, (_, row) in enumerate(recommendations.iterrows()):
        artist = str(row.get("artists", ""))
        count = artist_counter.get(artist, 0)

        if count >= max_per_artist:
            continue

        artist_counter[artist] = count + 1
        keep_positions.append(position)

    return recommendations.iloc[keep_positions]


def recommend_tracks(
    track_index: int,
    dataframe: pd.DataFrame,
    latent_features: np.ndarray,
    knn: NearestNeighbors,
    n_neighbors: int = 80,
    n_recommendations: int = 10,
    intent: str = "Balanced",
    weights: dict[str, float] | None = None,
) -> pd.DataFrame:
    """
    Recommend tracks using multi-source hybrid scoring.

    `weights` overrides the intent profile's ranking weights (e.g. from
    UI sliders) without changing which candidate pools are built --
    intent still controls pool construction (audio-feature weighting,
    genre/popularity scoping).
    """

    if track_index >= len(dataframe):
        raise ValueError("Invalid track index.")

    selected_song, candidates = build_candidate_pool(
        track_index=track_index,
        dataframe=dataframe,
        latent_features=latent_features,
        knn=knn,
        intent=intent,
        n_neighbors=n_neighbors,
    )

    candidates = rank_candidates(
        selected_song,
        candidates,
        intent=intent,
        weights=weights,
    )

    candidates = candidates.drop_duplicates(
        subset=[
            "track_name",
            "artists",
        ]
    )
    candidates = diversify_artists(
        candidates,
        max_per_artist=2,
    )

    return candidates.head(n_recommendations)


def get_track_details(
    dataframe: pd.DataFrame,
    track_index: int,
) -> pd.Series:
    """
    Return metadata for one track.
    """

    return dataframe.iloc[track_index]
