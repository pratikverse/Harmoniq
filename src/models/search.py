"""
Search utilities for TuneMatch.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

import pandas as pd
from rapidfuzz import fuzz, process, utils


@dataclass(frozen=True)
class SearchChoice:
    """
    One searchable track entry, with RapidFuzz-processed text precomputed
    at build time so intelligent_search never re-normalizes 68k+ strings
    per keystroke (docs/FINDINGS.md finding 9 -- this used to cost ~47s
    per query on the real catalog, dominated by a Python-callback
    `processor=lambda` that defeated RapidFuzz's C-level batch matching).
    """

    index: int
    label: str
    track_name: str
    artists: str
    search_text: str
    processed_text: str
    processed_label: str


def _normalize_text(value: object) -> str:
    if value is None or pd.isna(value):
        return ""
    return str(value).strip()


def build_search_index(dataframe: pd.DataFrame) -> list[SearchChoice]:
    """
    Build normalized, pre-processed search records for the catalog.
    """

    choices: list[SearchChoice] = []

    for index, row in dataframe.reset_index(drop=True).iterrows():
        track_name = _normalize_text(row.get("track_name"))
        artists = _normalize_text(row.get("artists"))
        genre = _normalize_text(row.get("track_genre"))

        label = f"{track_name} - {artists}" if artists else track_name

        search_text = " | ".join(
            part
            for part in (
                track_name,
                artists,
                label,
                genre,
            )
            if part
        )

        choices.append(
            SearchChoice(
                index=index,
                label=label,
                track_name=track_name,
                artists=artists,
                search_text=search_text,
                processed_text=utils.default_process(search_text),
                processed_label=utils.default_process(label),
            )
        )

    return choices


def _dedupe_matches(
    matches: Sequence[tuple[SearchChoice, float]],
) -> list[dict]:
    """
    Remove duplicate matches by track index while preserving rank order.
    """

    deduped: list[dict] = []
    seen: set[int] = set()

    for choice, score in matches:
        if choice.index in seen:
            continue

        seen.add(choice.index)
        deduped.append(
            {
                "index": choice.index,
                "label": choice.label,
                "track_name": choice.track_name,
                "artists": choice.artists,
                "score": round(float(score), 2),
            }
        )

    return deduped


def intelligent_search(
    query: str,
    search_index: list[SearchChoice],
    limit: int = 10,
    score_cutoff: int = 45,
) -> list[dict]:
    """
    Search by partial song title, artist, or typo-tolerant fuzzy matching.
    """

    cleaned_query = query.strip()

    if not cleaned_query or not search_index:
        return []

    lowered_query = cleaned_query.casefold()
    direct_substring_matches = [
        (choice, 100.0)
        for choice in search_index
        if lowered_query in choice.search_text.casefold()
    ]

    processed_query = utils.default_process(cleaned_query)
    processed_texts = [choice.processed_text for choice in search_index]
    processed_labels = [choice.processed_label for choice in search_index]

    # processor=None: candidates are already-processed plain strings, so
    # RapidFuzz's C batch matcher runs directly with no Python callback
    # per candidate.
    fuzzy_hits = process.extract(
        processed_query,
        processed_texts,
        processor=None,
        scorer=fuzz.WRatio,
        limit=limit * 3,
        score_cutoff=score_cutoff,
    )
    startswith_hits = process.extract(
        processed_query,
        processed_labels,
        processor=None,
        scorer=fuzz.partial_ratio,
        limit=limit * 3,
        score_cutoff=score_cutoff,
    )

    combined_matches = (
        direct_substring_matches
        + [(search_index[i], score) for _, score, i in fuzzy_hits]
        + [(search_index[i], score) for _, score, i in startswith_hits]
    )

    return _dedupe_matches(combined_matches)[:limit]
