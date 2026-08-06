const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

// Vite inlines VITE_* at build time, so a missing VITE_API_BASE_URL bakes the
// localhost fallback into the deployed bundle -- every visitor then calls a
// server on their own machine and the app looks permanently offline. Nothing
// throws, so this is worth stating loudly rather than leaving to inspection.
if (typeof window !== "undefined") {
  const servedLocally = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const pointsAtLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(API_BASE_URL);
  if (pointsAtLocalhost && !servedLocally) {
    console.error(
      `[Harmoniq] VITE_API_BASE_URL was not set at build time, so the API base URL is "${API_BASE_URL}". ` +
        "This build cannot reach the backend from any machine but your own. " +
        "Set VITE_API_BASE_URL (frontend/.env.production or the Vercel Production environment) and rebuild.",
    );
  }
}

export interface TrackSummary {
  index: number;
  track_id: string | null;
  track_name: string;
  artists: string;
  track_genre: string;
  popularity: number;
  duration_ms: number | null;
}

export interface SearchMatch {
  index: number;
  label: string;
  track_name: string;
  artists: string;
  score: number;
}

export interface IntentProfile {
  name: string;
  weights: Record<string, number>;
}

export interface FeatureMatch {
  feature: string;
  label: string;
  difference: number;
  closeness: number;
  selected_value: number;
  recommended_value: number;
}

export interface Explanation {
  latent_similarity_percent: number;
  audio_similarity_percent: number;
  genre_score_percent: number;
  ranking_score_percent: number;
  popularity_score_percent: number;
  source_support_percent: number;
  popularity: number | string;
  summary: string;
  top_reasons: string[];
  feature_matches: FeatureMatch[];
  source_latent: boolean;
  source_audio: boolean;
  source_genre: boolean;
  source_popularity: boolean;
  same_genre: boolean;
  same_genre_family: boolean;
  same_artist: boolean;
}

export interface Recommendation extends TrackSummary {
  ranking_score: number;
  explanation: Explanation;
}

export interface RecommendResponse {
  selected_track: TrackSummary;
  recommendations: Recommendation[];
}

export interface MoodTrack extends TrackSummary {
  mood: string;
  mood_score: number;
  mood_match_score: number;
  reasons: string[];
}

export interface PcaPoint {
  pc1: number;
  pc2: number;
  pc3: number;
  genre: string;
  track_name: string;
  artists: string;
}

async function getJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { signal });
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

/** "ready" = serving requests, "warming" = booted but still loading artifacts, "down" = no answer. */
export type HealthStatus = "ready" | "warming" | "down";

export async function checkHealth(timeoutMs = 8000): Promise<HealthStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!response.ok) return "down";
    // A backend predating the `ready` flag omits it -- treat that as ready.
    const body = (await response.json().catch(() => null)) as { ready?: boolean } | null;
    return body?.ready === false ? "warming" : "ready";
  } catch {
    return "down";
  }
}

export function getStats() {
  return getJSON<{ songs: number; artists: number; genres: number }>("/api/stats");
}

export function getIntents() {
  return getJSON<{ intents: IntentProfile[] }>("/api/intents");
}

export function searchTracks(query: string, limit = 12, signal?: AbortSignal) {
  return getJSON<{ matches: SearchMatch[] }>(
    `/api/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    signal,
  );
}

export function browseTracks(limit = 500) {
  return getJSON<{ tracks: TrackSummary[] }>(`/api/browse?limit=${limit}`);
}

export async function recommend(
  trackIndex: number,
  intent: string,
  weights?: Record<string, number>,
): Promise<RecommendResponse> {
  const response = await fetch(`${API_BASE_URL}/api/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ track_index: trackIndex, intent, weights }),
  });
  if (!response.ok) {
    throw new Error(`recommend failed: ${response.status}`);
  }
  return response.json() as Promise<RecommendResponse>;
}

export function getMoods() {
  return getJSON<{ moods: string[] }>("/api/moods");
}

export function getMoodTracks(mood: string, limit = 12) {
  return getJSON<{ mood: string; tracks: MoodTrack[] }>(
    `/api/mood/${encodeURIComponent(mood)}?limit=${limit}`,
  );
}

export function getGenres() {
  return getJSON<{ genres: string[] }>("/api/genres");
}

export function getGenreExplorer(
  genre: string,
  limit = 12,
  playlistSize = 20,
  shuffle = false,
) {
  return getJSON<{ genre: string; recommendations: TrackSummary[]; playlist: TrackSummary[] }>(
    `/api/genre/${encodeURIComponent(genre)}?limit=${limit}&playlist_size=${playlistSize}&shuffle=${shuffle}`,
  );
}

export function getPcaProjection() {
  return getJSON<{ points: PcaPoint[] }>("/api/visualization/pca");
}

export function getHeatmap() {
  return getJSON<{ features: string[]; matrix: number[][] }>("/api/visualization/heatmap");
}
