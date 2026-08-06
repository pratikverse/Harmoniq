import { useEffect, useMemo, useState } from "react";
import {
  browseTracks,
  getIntents,
  getStats,
  recommend,
  searchTracks,
  type IntentProfile,
  type RecommendResponse,
  type SearchMatch,
  type TrackSummary,
} from "./api";
import "./App.css";

function SpotifyEmbed({ trackId }: { trackId: string | null }) {
  if (!trackId) return null;
  return (
    <iframe
      className="tm-embed"
      style={{ borderRadius: 12 }}
      src={`https://open.spotify.com/embed/track/${trackId}`}
      width="100%"
      height="152"
      frameBorder={0}
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
    />
  );
}

function RecommendationCard({
  recommendation,
}: {
  recommendation: RecommendResponse["recommendations"][number];
}) {
  const [showDetails, setShowDetails] = useState(false);
  const explanation = recommendation.explanation;
  const activeSources = [
    explanation.source_latent && "latent",
    explanation.source_audio && "audio",
    explanation.source_genre && "genre",
    explanation.source_popularity && "popularity",
  ].filter(Boolean);

  return (
    <div className="tm-card">
      <div className="tm-card-title">{recommendation.track_name}</div>
      <div className="tm-card-meta">{recommendation.artists}</div>
      <div className="tm-card-meta">Genre: {recommendation.track_genre}</div>
      <div className="tm-card-badge">Popularity {recommendation.popularity}</div>

      <div className="tm-progress">
        <div
          className="tm-progress-fill"
          style={{ width: `${Math.min(Math.max(recommendation.ranking_score, 0), 1) * 100}%` }}
        />
      </div>
      <div className="tm-section-copy" style={{ marginTop: "0.4rem" }}>
        {explanation.ranking_score_percent.toFixed(2)}% ranking score | popularity{" "}
        {recommendation.popularity}
      </div>

      <p className="tm-body">Why this song was chosen</p>
      <p className="tm-body">{explanation.summary}</p>
      <p className="tm-body">
        Hybrid breakdown: latent {explanation.latent_similarity_percent.toFixed(2)}% | audio{" "}
        {explanation.audio_similarity_percent.toFixed(2)}% | genre{" "}
        {explanation.genre_score_percent.toFixed(2)}% | popularity{" "}
        {explanation.popularity_score_percent.toFixed(2)}% | source support{" "}
        {explanation.source_support_percent.toFixed(2)}%.
      </p>

      {explanation.same_genre ? (
        <p className="tm-body">Genre alignment: exact genre match.</p>
      ) : explanation.same_genre_family ? (
        <p className="tm-body">Genre alignment: matched through a broader genre family.</p>
      ) : null}

      {activeSources.length > 0 && (
        <p className="tm-body">Retrieval sources: {activeSources.join(", ")}.</p>
      )}

      {explanation.top_reasons.length > 0 && (
        <div className="tm-body">
          Main reasons:
          <ul>
            {explanation.top_reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      <button className="tm-link-button" onClick={() => setShowDetails((value) => !value)}>
        {showDetails ? "Hide score details" : "Show score details"}
      </button>
      {showDetails && (
        <div className="tm-score-details">
          {[
            ["Latent similarity", explanation.latent_similarity_percent],
            ["Audio similarity", explanation.audio_similarity_percent],
            ["Genre score", explanation.genre_score_percent],
            ["Popularity score", explanation.popularity_score_percent],
            ["Source support", explanation.source_support_percent],
          ].map(([label, value]) => (
            <div key={label as string} className="tm-score-row">
              <span>{label}</span>
              <div className="tm-score-bar">
                <div className="tm-score-bar-fill" style={{ width: `${value}%` }} />
              </div>
              <span>{(value as number).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}

      {explanation.feature_matches.length > 0 && (
        <div className="tm-body">
          Feature-level similarity:
          <ul>
            {explanation.feature_matches.slice(0, 5).map((match) => (
              <li key={match.feature}>
                {match.label}: {(match.closeness * 100).toFixed(1)}% close (difference{" "}
                {match.difference.toFixed(3)})
              </li>
            ))}
          </ul>
        </div>
      )}

      <SpotifyEmbed trackId={recommendation.track_id} />
    </div>
  );
}

export default function App() {
  const [stats, setStats] = useState<{ songs: number; artists: number; genres: number } | null>(
    null,
  );
  const [intents, setIntents] = useState<IntentProfile[]>([]);
  const [selectedIntent, setSelectedIntent] = useState("Balanced");
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [browseOptions, setBrowseOptions] = useState<TrackSummary[]>([]);
  const [selectedTrackIndex, setSelectedTrackIndex] = useState<number | null>(null);

  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStats().then(setStats).catch(() => setError("Could not reach the Harmoniq API."));
    getIntents().then((response) => setIntents(response.intents)).catch(() => {});
    browseTracks(500).then((response) => {
      setBrowseOptions(response.tracks);
      if (response.tracks.length > 0) {
        setSelectedTrackIndex(response.tracks[0].index);
      }
    });
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchMatches([]);
      return;
    }
    const handle = setTimeout(() => {
      searchTracks(trimmed, 12)
        .then((response) => {
          setSearchMatches(response.matches);
          if (response.matches.length > 0) {
            setSelectedTrackIndex(response.matches[0].index);
          }
        })
        .catch(() => setError("Search failed."));
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
    <div className="tm-app">
      <header className="tm-nav">
        <span className="tm-nav-active">Recommendations</span>
      </header>

      <div className="tm-hero">
        <div className="tm-kicker">Hybrid Recommender &middot; Research Build</div>
        <h1 className="tm-title">Genres can&apos;t describe a sound.</h1>
        <div className="tm-subtitle">
          Filter a catalog by <code>genre = pop</code> and you get thousands of tracks that share a
          label but nothing else. Harmoniq reframes the task from classification &mdash;{" "}
          <em>what genre is this?</em> &mdash; to retrieval &mdash; <em>what sounds like this?</em>{" "}
          &mdash; by blending a learned latent embedding with raw audio features, genre family
          matching, and popularity signals into one ranked, explainable result.
        </div>
      </div>

      <div className="tm-expander">
        <button className="tm-expander-toggle" onClick={() => setHowItWorksOpen((v) => !v)}>
          {howItWorksOpen ? "⌄" : "›"} How it works
        </button>
        {howItWorksOpen && (
          <div className="tm-step-strip">
            {[
              ["01", "Search", "fuzzy + typo-tolerant"],
              ["02", "Latent KNN", "8-d cosine neighbors"],
              ["03", "Hybrid rank", "audio + genre + popularity"],
              ["04", "Explain", "per-feature reasoning"],
              ["05", "Results", "diversified playlist"],
            ].map(([number, title, meta]) => (
              <div className="tm-step" key={number}>
                <div className="tm-step-number">{number}</div>
                <div className="tm-step-title">{title}</div>
                <div className="tm-step-meta">{meta}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {stats && (
        <div className="tm-metrics">
          <div className="tm-metric">
            <div className="tm-metric-label">Songs</div>
            <div className="tm-metric-value">{stats.songs.toLocaleString()}</div>
          </div>
          <div className="tm-metric">
            <div className="tm-metric-label">Artists</div>
            <div className="tm-metric-value">{stats.artists.toLocaleString()}</div>
          </div>
          <div className="tm-metric">
            <div className="tm-metric-label">Genres</div>
            <div className="tm-metric-value">{stats.genres.toLocaleString()}</div>
          </div>
        </div>
      )}

      <hr className="tm-divider" />

      <section id="music-recommendations">
        <h2 className="tm-section-title">Music Recommendations</h2>
        <p className="tm-section-copy">
          Search by title or artist, choose a recommendation style, and inspect the hybrid score
          breakdown behind each suggestion.
        </p>

        {error && <div className="tm-error">{error}</div>}

        <input
          className="tm-input"
          type="text"
          placeholder="Try: blinding lights, weeknd, shape of you, calm down..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <label className="tm-label">Recommendation style</label>
        <select
          className="tm-select"
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

        {query.trim() ? (
          searchMatches.length > 0 ? (
            <>
              <p className="tm-section-copy">Autocomplete suggestions</p>
              <select
                className="tm-select"
                value={selectedTrackIndex ?? ""}
                onChange={(event) => setSelectedTrackIndex(Number(event.target.value))}
              >
                {searchMatches.map((match) => (
                  <option key={match.index} value={match.index}>
                    {match.label} | match {match.score.toFixed(0)}%
                  </option>
                ))}
              </select>
            </>
          ) : (
            <p className="tm-section-copy">No close matches found. Try a different search.</p>
          )
        ) : (
          <>
            <label className="tm-label">Browse songs</label>
            <select
              className="tm-select"
              value={selectedTrackIndex ?? ""}
              onChange={(event) => setSelectedTrackIndex(Number(event.target.value))}
            >
              {browseOptions.map((option) => (
                <option key={option.index} value={option.index}>
                  {option.track_name} - {option.artists}
                </option>
              ))}
            </select>
            {browseLabel && <p className="tm-section-copy">Selected: {browseLabel}</p>}
          </>
        )}

        <button
          className="tm-button"
          disabled={selectedTrackIndex == null || loading}
          onClick={handleGetRecommendations}
        >
          {loading ? "Finding recommendations…" : "Get Recommendations"}
        </button>

        {result && (
          <>
            <hr className="tm-divider" />
            <h3 className="tm-section-title">Currently Playing</h3>
            <div className="tm-now-playing">
              <SpotifyEmbed trackId={result.selected_track.track_id} />
              <div className="tm-card">
                <div className="tm-card-title">{result.selected_track.track_name}</div>
                <div className="tm-card-meta">Artist: {result.selected_track.artists}</div>
                <div className="tm-card-meta">Genre: {result.selected_track.track_genre}</div>
                <div className="tm-card-badge">Popularity {result.selected_track.popularity}</div>
              </div>
            </div>

            <hr className="tm-divider" />
            <h3 className="tm-section-title">Recommended Songs</h3>
            <div className="tm-results-grid">
              {result.recommendations.map((recommendation) => (
                <RecommendationCard key={recommendation.index} recommendation={recommendation} />
              ))}
            </div>
          </>
        )}
      </section>

      <hr className="tm-divider" />
      <p className="tm-footer">
        Harmoniq | Hybrid music recommendation, mood discovery, genre exploration, and explainable
        AI in one polished web experience.
      </p>
    </div>
  );
}
