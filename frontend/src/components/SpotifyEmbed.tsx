export default function SpotifyEmbed({ trackId }: { trackId: string | null }) {
  if (!trackId) return null;
  return (
    // Spotify's normal-height (152px) embed card leaves a margin of its own
    // white background around the card, which doesn't scale reliably with
    // width -- a fixed-pixel zoom/crop broke at different card widths. The
    // compact layout (80px) is a single-row player with no such margin, so
    // it renders edge-to-edge cleanly, and it's smaller besides.
    <div className="h-[80px] w-full overflow-hidden rounded-md">
      <iframe
        className="block h-full w-full"
        src={`https://open.spotify.com/embed/track/${trackId}?theme=0`}
        frameBorder={0}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    </div>
  );
}
