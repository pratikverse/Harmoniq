import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { TrackSummary } from "../api";

const STORAGE_KEY = "harmoniq_playlist";

function loadFromStorage(): TrackSummary[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TrackSummary[]) : [];
  } catch {
    return [];
  }
}

interface PlaylistContextValue {
  tracks: TrackSummary[];
  add: (track: TrackSummary) => boolean;
  remove: (trackId: string) => void;
  clear: () => void;
  has: (trackId: string | null) => boolean;
}

const PlaylistContext = createContext<PlaylistContextValue | null>(null);

export function PlaylistProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<TrackSummary[]>(() => loadFromStorage());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks));
  }, [tracks]);

  const add = useCallback((track: TrackSummary) => {
    if (!track.track_id) return false;
    let added = true;
    setTracks((current) => {
      if (current.some((item) => item.track_id === track.track_id)) {
        added = false;
        return current;
      }
      return [...current, track];
    });
    return added;
  }, []);

  const remove = useCallback((trackId: string) => {
    setTracks((current) => current.filter((item) => item.track_id !== trackId));
  }, []);

  const clear = useCallback(() => setTracks([]), []);

  const has = useCallback(
    (trackId: string | null) => Boolean(trackId) && tracks.some((item) => item.track_id === trackId),
    [tracks],
  );

  return (
    <PlaylistContext.Provider value={{ tracks, add, remove, clear, has }}>
      {children}
    </PlaylistContext.Provider>
  );
}

export function usePlaylist() {
  const context = useContext(PlaylistContext);
  if (!context) throw new Error("usePlaylist must be used within a PlaylistProvider");
  return context;
}
