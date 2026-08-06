import { useEffect, useMemo, useRef, useState } from "react";
import {
  browseTracks,
  getIntents,
  recommend,
  searchTracks,
  type IntentProfile,
  type RecommendResponse,
  type SearchMatch,
  type TrackSummary,
} from "../api";
import RecommendationCard from "../components/RecommendationCard";
import SpotifyEmbed from "../components/SpotifyEmbed";

export default function Recommendations() {
  const [intents, setIntents] = useState<IntentProfile[]>([]);
  const [selectedIntent, setSelectedIntent] = useState("Balanced");

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [browseOptions, setBrowseOptions] = useState<TrackSummary[]>([]);
  const [selectedTrackIndex, setSelectedTrackIndex] = useState<number | null>(null);

  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    getIntents()
      .then((response) => setIntents(response.intents))
      .catch(() => {});
    browseTracks(500).then((response) => {
      setBrowseOptions(response.tracks);
      if (response.tracks.length > 0) {
        setSelectedTrackIndex(response.tracks[0].index);
      }
    });
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    searchAbortRef.current?.abort();

    if (!trimmed) {
      setSearchMatches([]);
      setSearching(false);
      return;
    }

    const handle = setTimeout(() => {
      const controller = new AbortController();
      searchAbortRef.current = controller;
      setSearching(true);
      searchTracks(trimmed, 12, controller.signal)
        .then((response) => {
          setSearchMatches(response.matches);
          if (response.matches.length > 0) {
            setSelectedTrackIndex(response.matches[0].index);
          }
        })
        .catch((err) => {
          if (err.name !== "AbortError") setError("Search failed.");
        })
        .finally(() => {
          if (searchAbortRef.current === controller) setSearching(false);
        });
    }, 300);

    return () => clearTimeout(handle);
  }, [query]);

  const browseLabel = useMemo(() => {
    const track = browseOptions.find((option) => option.index === selectedTrackIndex);
    return track ? `${track.track_name} - ${track.artists}` : "";
  }, [browseOptions, selectedTrackIndex]);

  async function handleGetRecommendations() {
    if (selectedTrackIndex == null) return;
    setLoading(true);
    setError(null);
    try {
      const response = await recommend(selectedTrackIndex, selectedIntent);
      setResult(response);
    } catch {
      setError("Could not fetch recommendations. Is the API running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-12">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Music Recommendations</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Search by title or artist, choose a recommendation style, and inspect the hybrid score
        breakdown behind each suggestion.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="mt-6 max-w-xl space-y-4">
        <input
          className="w-full rounded-sm border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus:border-ring"
          type="text"
          placeholder="Try: blinding lights, weeknd, shape of you, calm down..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Recommendation style</label>
          <select
            className="w-full rounded-sm border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus:border-ring"
            value={selectedIntent}
            onChange={(event) => setSelectedIntent(event.target.value)}
          >
            {(intents.length > 0 ? intents.map((intent) => intent.name) : ["Balanced"]).map(
              (name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ),
            )}
          </select>
        </div>

        {query.trim() ? (
          searching ? (
            <p className="text-sm text-muted-foreground">Searching…</p>
          ) : searchMatches.length > 0 ? (
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Autocomplete suggestions
              </label>
              <select
                className="w-full rounded-sm border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus:border-ring"
                value={selectedTrackIndex ?? ""}
                onChange={(event) => setSelectedTrackIndex(Number(event.target.value))}
              >
                {searchMatches.map((match) => (
                  <option key={match.index} value={match.index}>
                    {match.label} | match {match.score.toFixed(0)}%
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No close matches found. Try a different search.
            </p>
          )
        ) : (
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Browse songs</label>
            <select
              className="w-full rounded-sm border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus:border-ring"
              value={selectedTrackIndex ?? ""}
              onChange={(event) => setSelectedTrackIndex(Number(event.target.value))}
            >
              {browseOptions.map((option) => (
                <option key={option.index} value={option.index}>
                  {option.track_name} - {option.artists}
                </option>
              ))}
            </select>
            {browseLabel && (
              <p className="mt-1 text-xs text-muted-foreground">Selected: {browseLabel}</p>
            )}
          </div>
        )}

        <button
          className="w-full rounded-sm bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={selectedTrackIndex == null || loading}
          onClick={handleGetRecommendations}
        >
          {loading ? "Finding recommendations…" : "Get Recommendations"}
        </button>
      </div>

      {result && (
        <>
          <div className="mt-12">
            <h2 className="font-display text-xl font-semibold">Currently Playing</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-[2fr_3fr]">
              <SpotifyEmbed trackId={result.selected_track.track_id} />
              <div className="rounded-md border border-border bg-surface p-4">
                <h3 className="font-display text-base font-semibold">
                  {result.selected_track.track_name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Artist: {result.selected_track.artists}
                </p>
                <p className="text-sm text-muted-foreground">
                  Genre: {result.selected_track.track_genre}
                </p>
                <span className="mt-2 inline-block rounded-sm border border-border bg-accent px-2 py-0.5 text-xs">
                  Popularity {result.selected_track.popularity}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-12">
            <h2 className="font-display text-xl font-semibold">Recommended Songs</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {result.recommendations.map((recommendation) => (
                <RecommendationCard key={recommendation.index} recommendation={recommendation} />
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
