import { Download, Trash2, X } from "lucide-react";
import { usePlaylist } from "../lib/playlist";
import SpotifyEmbed from "../components/SpotifyEmbed";
import CreateSpotifyPlaylist from "../components/CreateSpotifyPlaylist";
import SectionHeading from "../components/SectionHeading";
import { Reveal } from "../lib/reveal";
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

  return (
    <section className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
      <SectionHeading
        eyebrow="Playlist"
        title="Playlist Builder"
        description="Tracks added from Recommendations, Mood, or Genre Explorer land here. Your playlist is stored in this browser only."
      />

      {tracks.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Your playlist is empty. Add tracks from the other pages using "Add to playlist".
        </p>
      ) : (
        <>
          <p className="mt-8 text-sm text-muted-foreground">
            {tracks.length} tracks | ~{totalMinutes.toFixed(1)} minutes
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => download("harmoniq_playlist.csv", buildCsv(tracks), "text/csv")}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              <Download className="size-4" />
              Download CSV
            </button>
            <button
              onClick={clear}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/5"
            >
              <Trash2 className="size-4" />
              Clear playlist
            </button>
          </div>

          <div className="mt-6">
            <CreateSpotifyPlaylist tracks={tracks} />
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {tracks.map((track, i) => (
              <Reveal key={track.track_id} delay={i * 50}>
                <article className="h-full space-y-3 rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:border-primary/40 hover:shadow-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        {track.track_name}
                      </h3>
                      <p className="text-sm text-muted-foreground">{track.artists}</p>
                      <p className="text-sm text-muted-foreground">Genre: {track.track_genre}</p>
                    </div>
                    <button
                      onClick={() => track.track_id && remove(track.track_id)}
                      className="shrink-0 rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
                      aria-label="Remove from playlist"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <SpotifyEmbed trackId={track.track_id} />
                </article>
              </Reveal>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
