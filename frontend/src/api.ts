const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

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

async function getJSON<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getStats() {
  return getJSON<{ songs: number; artists: number; genres: number }>("/api/stats");
}

export function getIntents() {
  return getJSON<{ intents: IntentProfile[] }>("/api/intents");
}

export function searchTracks(query: string, limit = 12) {
  return getJSON<{ matches: SearchMatch[] }>(
    `/api/search?q=${encodeURIComponent(query)}&limit=${limit}`,
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
