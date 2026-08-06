import { getValidAccessToken } from "./spotifyAuth";

async function spotifyFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getValidAccessToken();
  if (!token) throw new Error("Not connected to Spotify.");

  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Spotify API error ${response.status}: ${body}`);
  }

  return response;
}

export async function getCurrentUser(): Promise<{ id: string; display_name: string | null }> {
  const response = await spotifyFetch("/me");
  return response.json();
}

export async function createPlaylist(
  userId: string,
  name: string,
  isPublic: boolean,
): Promise<{ id: string; external_urls: { spotify: string } }> {
  const response = await spotifyFetch(`/users/${userId}/playlists`, {
    method: "POST",
    body: JSON.stringify({
      name,
      public: isPublic,
      description: "Created with Harmoniq.",
    }),
  });
  return response.json();
}

export async function addTracksToPlaylist(playlistId: string, trackUris: string[]): Promise<void> {
  // Spotify caps this endpoint at 100 URIs per request.
  for (let i = 0; i < trackUris.length; i += 100) {
    const batch = trackUris.slice(i, i + 100);
    await spotifyFetch(`/playlists/${playlistId}/tracks`, {
      method: "POST",
      body: JSON.stringify({ uris: batch }),
    });
  }
}
