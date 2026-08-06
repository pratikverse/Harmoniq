import { Check, Plus } from "lucide-react";
import type { TrackSummary } from "../api";
import { usePlaylist } from "../lib/playlist";

export default function AddToPlaylistButton({ track }: { track: TrackSummary }) {
  const { add, has } = usePlaylist();
  const inPlaylist = has(track.track_id);

  if (!track.track_id) return null;

  return (
    <button
      onClick={() => add(track)}
      disabled={inPlaylist}
      className="inline-flex w-full items-center justify-center gap-1.5 rounded-sm border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:cursor-default disabled:opacity-60"
    >
      {inPlaylist ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
      {inPlaylist ? "In playlist" : "Add to playlist"}
    </button>
  );
}
