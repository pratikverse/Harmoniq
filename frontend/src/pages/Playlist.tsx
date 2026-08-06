import { Download, Trash2, X } from "lucide-react";
import { usePlaylist } from "../lib/playlist";
import SpotifyEmbed from "../components/SpotifyEmbed";
import type { TrackSummary } from "../api";

function buildCsv(tracks: TrackSummary[]): string {
  const header = "track_name,artists,track_genre,popularity,duration_ms,track_id,spotify_url";
  const rows = tracks.map((track) =>
    [
      track.track_name,
      track.artists,
      track.track_genre,
      track.popularity,
      track.duration_ms ?? "",
      track.track_id ?? "",
      track.track_id ? `https://open.spotify.com/track/${track.track_id}` : "",
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header, ...rows].join("\n") + "\n";
}

function buildM3u8(tracks: TrackSummary[]): string {
  const lines = ["#EXTM3U"];
  for (const track of tracks) {
    const durationSeconds = Math.floor((track.duration_ms ?? 0) / 1000);
    lines.push(`#EXTINF:${durationSeconds},${track.artists} - ${track.track_name}`);
    lines.push(`https://open.spotify.com/track/${track.track_id ?? ""}`);
  }
  return lines.join("\n") + "\n";
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Playlist() {
  const { tracks, remove, clear } = usePlaylist();

  const totalMinutes = tracks.reduce((sum, t) => sum + (t.duration_ms ?? 0), 0) / 60_000;
  const uris = tracks.map((t) => `spotify:track:${t.track_id}`).join("\n");

  return (
    <section className="mx-auto max-w-7xl px-5 py-12">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Playlist Builder</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Tracks added from Recommendations, Mood, or Genre Explorer land here. Your playlist is
        stored in this browser only.
      </p>

      {tracks.length === 0 ? (
        <p className="mt-8 rounded-md border border-border bg-surface p-4 text-sm text-muted-foreground">
          Your playlist is empty. Add tracks from the other pages using "Add to playlist".
        </p>
      ) : (
        <>
          <p className="mt-6 text-sm text-muted-foreground">
            {tracks.length} tracks | ~{totalMinutes.toFixed(1)} minutes
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => download("harmoniq_playlist.csv", buildCsv(tracks), "text/csv")}
              className="inline-flex items-center gap-2 rounded-sm border border-border px-4 py-2 text-sm font-medium hover:border-primary"
            >
              <Download className="size-4" />
              Download CSV
            </button>
            <button
              onClick={() =>
                download("harmoniq_playlist.m3u8", buildM3u8(tracks), "audio/x-mpegurl")
              }
              className="inline-flex items-center gap-2 rounded-sm border border-border px-4 py-2 text-sm font-medium hover:border-primary"
            >
              <Download className="size-4" />
              Download M3U8
            </button>
            <button
              onClick={clear}
              className="inline-flex items-center gap-2 rounded-sm border border-border px-4 py-2 text-sm font-medium text-destructive hover:border-destructive"
            >
              <Trash2 className="size-4" />
              Clear playlist
            </button>
          </div>

          <details className="mt-6 rounded-md border border-border bg-surface p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Spotify URIs (paste into the desktop Spotify app)
            </summary>
            <pre className="mt-3 overflow-x-auto rounded-sm bg-background p-3 font-mono text-xs text-muted-foreground">
              {uris}
            </pre>
          </details>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {tracks.map((track) => (
              <article
                key={track.track_id}
                className="rise space-y-3 rounded-md border border-border bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-semibold">{track.track_name}</h3>
                    <p className="text-sm text-muted-foreground">{track.artists}</p>
                    <p className="text-sm text-muted-foreground">Genre: {track.track_genre}</p>
                  </div>
                  <button
                    onClick={() => track.track_id && remove(track.track_id)}
                    className="shrink-0 rounded-sm border border-border p-1.5 text-muted-foreground hover:border-destructive hover:text-destructive"
                    aria-label="Remove from playlist"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <SpotifyEmbed trackId={track.track_id} />
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
