import { useCallback, useEffect, useState } from "react";
import { Shuffle } from "lucide-react";
import { getGenreExplorer, getGenres, type TrackSummary } from "../api";
import AddToPlaylistButton from "../components/AddToPlaylistButton";
import SpotifyEmbed from "../components/SpotifyEmbed";
import SectionHeading from "../components/SectionHeading";
import { Reveal } from "../lib/reveal";

export default function Genre() {
  const [genres, setGenres] = useState<string[]>([]);
  const [selectedGenre, setSelectedGenre] = useState("");
  const [playlist, setPlaylist] = useState<TrackSummary[]>([]);
  const [recommendations, setRecommendations] = useState<TrackSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getGenres().then((response) => {
      setGenres(response.genres);
      if (response.genres.length > 0) setSelectedGenre(response.genres[0]);
    });
  }, []);

  const load = useCallback((genre: string, shuffle: boolean) => {
    if (!genre) return;
    setLoading(true);
    getGenreExplorer(genre, 12, 20, shuffle)
      .then((response) => {
        setPlaylist(response.playlist);
        setRecommendations(response.recommendations);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(selectedGenre, false);
  }, [selectedGenre, load]);

  return (
    <section className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
      <SectionHeading
        eyebrow="Genre"
        title="Genre Explorer"
        description="Browse curated genre families and generate ready-to-share playlists without typing a search query."
      />

      <div className="mt-8 flex max-w-xl items-end gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-muted-foreground">Choose a genre</label>
          <select
            className="w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus:border-ring"
            value={selectedGenre}
            onChange={(event) => setSelectedGenre(event.target.value)}
          >
            {genres.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => load(selectedGenre, true)}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Shuffle className="size-4" />
          Shuffle
        </button>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="mt-12">
            <h2 className="text-xl font-semibold text-foreground">
              {selectedGenre} Playlist Generator
            </h2>
            {playlist.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No playlist could be generated for the {selectedGenre} explorer group.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  Generated a {playlist.length}-song playlist for {selectedGenre}.
                </p>
                <div className="mt-4 overflow-hidden rounded-2xl border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Track</th>
                        <th className="px-4 py-2.5 font-medium">Artist</th>
                        <th className="px-4 py-2.5 font-medium">Genre</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {playlist.map((track) => (
                        <tr key={track.index}>
                          <td className="px-4 py-2.5">{track.track_name}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{track.artists}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {track.track_genre}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="mt-12">
            {recommendations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tracks were found for the {selectedGenre} explorer group.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Showing browseable {selectedGenre.toLowerCase()} picks without using search.
                </p>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  {recommendations.map((track, i) => (
                    <Reveal key={track.index} delay={i * 50}>
                      <article className="h-full space-y-3 rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:border-primary/40 hover:shadow-lg">
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">
                            {track.track_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">{track.artists}</p>
                          <p className="text-sm text-muted-foreground">
                            Genre: {track.track_genre}
                          </p>
                          <span className="mt-2 inline-block rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
                            Popularity {track.popularity}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          This track appears in the {selectedGenre.toLowerCase()} explorer because
                          its dataset genre maps into that family.
                        </p>
                        <SpotifyEmbed trackId={track.track_id} />
                        <AddToPlaylistButton track={track} />
                      </article>
                    </Reveal>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
