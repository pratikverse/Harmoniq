import { useEffect, useState } from "react";
import { getGenreExplorer, getGenres, type TrackSummary } from "../api";
import AddToPlaylistButton from "../components/AddToPlaylistButton";
import SpotifyEmbed from "../components/SpotifyEmbed";

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

  useEffect(() => {
    if (!selectedGenre) return;
    setLoading(true);
    getGenreExplorer(selectedGenre, 12, 20)
      .then((response) => {
        setPlaylist(response.playlist);
        setRecommendations(response.recommendations);
      })
      .finally(() => setLoading(false));
  }, [selectedGenre]);

  return (
    <section className="mx-auto max-w-7xl px-5 py-12">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Genre Explorer</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Browse curated genre families and generate ready-to-share playlists without typing a
        search query.
      </p>

      <div className="mt-6 max-w-xs">
        <label className="mb-1 block text-xs text-muted-foreground">Choose a genre</label>
        <select
          className="w-full rounded-sm border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus:border-ring"
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

      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="mt-10">
            <h2 className="font-display text-xl font-semibold">
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
                <div className="mt-4 overflow-hidden rounded-md border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 font-medium">Track</th>
                        <th className="px-4 py-2 font-medium">Artist</th>
                        <th className="px-4 py-2 font-medium">Genre</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {playlist.map((track) => (
                        <tr key={track.index}>
                          <td className="px-4 py-2">{track.track_name}</td>
                          <td className="px-4 py-2 text-muted-foreground">{track.artists}</td>
                          <td className="px-4 py-2 text-muted-foreground">{track.track_genre}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="mt-10">
            {recommendations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tracks were found for the {selectedGenre} explorer group.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Showing browseable {selectedGenre.toLowerCase()} picks without using search.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {recommendations.map((track) => (
                    <article
                      key={track.index}
                      className="rise space-y-3 rounded-md border border-border bg-surface p-4"
                    >
                      <div>
                        <h3 className="font-display text-base font-semibold">
                          {track.track_name}
                        </h3>
                        <p className="text-sm text-muted-foreground">{track.artists}</p>
                        <p className="text-sm text-muted-foreground">
                          Genre: {track.track_genre}
                        </p>
                        <span className="mt-2 inline-block rounded-sm border border-border bg-accent px-2 py-0.5 text-xs">
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
