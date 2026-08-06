import { useEffect, useState } from "react";
import { getMoodTracks, getMoods, type MoodTrack } from "../api";
import AddToPlaylistButton from "../components/AddToPlaylistButton";
import SpotifyEmbed from "../components/SpotifyEmbed";

export default function Mood() {
  const [moods, setMoods] = useState<string[]>([]);
  const [selectedMood, setSelectedMood] = useState("");
  const [tracks, setTracks] = useState<MoodTrack[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getMoods().then((response) => {
      setMoods(response.moods);
      if (response.moods.length > 0) setSelectedMood(response.moods[0]);
    });
  }, []);

  useEffect(() => {
    if (!selectedMood) return;
    setLoading(true);
    getMoodTracks(selectedMood, 12)
      .then((response) => setTracks(response.tracks))
      .finally(() => setLoading(false));
  }, [selectedMood]);

  return (
    <section className="mx-auto max-w-7xl px-5 py-12">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Mood Recommendations</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Pick a listening mood and Harmoniq will surface tracks whose audio signatures best match
        that context.
      </p>

      <div className="mt-6 max-w-xs">
        <label className="mb-1 block text-xs text-muted-foreground">Choose a mood</label>
        <select
          className="w-full rounded-sm border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus:border-ring"
          value={selectedMood}
          onChange={(event) => setSelectedMood(event.target.value)}
        >
          {moods.map((mood) => (
            <option key={mood} value={mood}>
              {mood}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Generated from energy, tempo, valence, danceability, acousticness, and related audio
        features.
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {tracks.map((track) => (
            <article key={track.index} className="rise space-y-3 rounded-md border border-border bg-surface p-4">
              <div>
                <h3 className="font-display text-base font-semibold">{track.track_name}</h3>
                <p className="text-sm text-muted-foreground">{track.artists}</p>
                <p className="text-sm text-muted-foreground">Genre: {track.track_genre}</p>
                <span className="mt-2 inline-block rounded-sm border border-border bg-accent px-2 py-0.5 text-xs">
                  Primary mood {track.mood}
                </span>
              </div>

              <div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${track.mood_score * 100}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {(track.mood_score * 100).toFixed(2)}% mood fit |{" "}
                  {(track.mood_match_score * 100).toFixed(2)}% final mood score
                </p>
              </div>

              <p className="text-sm text-muted-foreground">
                This song was selected for {selectedMood.toLowerCase()} because its audio profile
                strongly matches that mood.
              </p>
              <ul className="list-disc space-y-0.5 pl-4 text-sm text-muted-foreground">
                {track.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>

              <SpotifyEmbed trackId={track.track_id} />
              <AddToPlaylistButton track={track} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
