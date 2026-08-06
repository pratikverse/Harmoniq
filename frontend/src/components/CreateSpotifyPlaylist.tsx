import { useState } from "react";
import { ExternalLink, Music } from "lucide-react";
import type { TrackSummary } from "../api";
import { useSpotifyAuth } from "../lib/SpotifyAuthContext";
import { addTracksToPlaylist, createPlaylist, getCurrentUser } from "../lib/spotifyApi";

export default function CreateSpotifyPlaylist({ tracks }: { tracks: TrackSummary[] }) {
  const { connected, configured, connect, disconnect } = useSpotifyAuth();
  const [name, setName] = useState("My Harmoniq Playlist");
  const [status, setStatus] = useState<"idle" | "creating" | "done" | "error">("idle");
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!configured) {
    return (
      <p className="rounded-md border border-border bg-surface p-4 text-sm text-muted-foreground">
        Spotify playlist export isn't configured for this deployment (no client ID set).
      </p>
    );
  }

  if (!connected) {
    return (
      <div>
        <button
          onClick={connect}
          className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Music className="size-4" />
          Connect Spotify
        </button>
        <p className="mt-2 max-w-md text-xs text-muted-foreground">
          This app is in Spotify's development mode, so only accounts the developer has
          explicitly allowlisted can connect. If you get a Spotify error after logging in, that's
          why -- use the CSV, M3U8, or Spotify URI export below instead, which work for everyone.
        </p>
      </div>
    );
  }

  const trackUris = tracks.filter((t) => t.track_id).map((t) => `spotify:track:${t.track_id}`);

  async function handleCreate() {
    setStatus("creating");
    setError(null);
    try {
      const user = await getCurrentUser();
      const playlist = await createPlaylist(user.id, name.trim() || "My Harmoniq Playlist", false);
      await addTracksToPlaylist(playlist.id, trackUris);
      setPlaylistUrl(playlist.external_urls.spotify);
      setStatus("done");
    } catch {
      setError("Could not create the playlist. Try reconnecting Spotify.");
      setStatus("error");
    }
  }

  if (status === "done" && playlistUrl) {
    return (
      <div className="rounded-md border border-border bg-surface p-4">
        <p className="text-sm">Playlist created in your Spotify account.</p>
        <a
          href={playlistUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Open in Spotify
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <label className="mb-1 block text-xs text-muted-foreground">Playlist name</label>
      <input
        className="w-full rounded-sm border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus:border-ring"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <button
        onClick={handleCreate}
        disabled={status === "creating" || trackUris.length === 0}
        className="mt-3 inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Music className="size-4" />
        {status === "creating" ? "Creating…" : "Create Spotify Playlist"}
      </button>
      <p className="mt-2 text-xs text-muted-foreground">
        Creates a private playlist in your Spotify account with these {trackUris.length} tracks.
      </p>
      <button
        onClick={disconnect}
        className="mt-2 block text-xs text-muted-foreground underline decoration-dotted hover:text-foreground"
      >
        Disconnect Spotify
      </button>
    </div>
  );
}
