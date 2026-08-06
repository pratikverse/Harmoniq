export default function SpotifyEmbed({ trackId }: { trackId: string | null }) {
  if (!trackId) return null;
  return (
    // Spotify's own embed card doesn't fill the iframe edge-to-edge -- there's
    // a couple of px of the iframe's white default background peeking around
    // its rounded corners. Since that's rendered inside cross-origin content,
    // our overflow-hidden can't clip it directly, so instead we zoom the
    // iframe slightly and crop the zoomed-out edges (including that sliver)
    // away with the wrapper.
    <div className="h-[152px] w-full overflow-hidden rounded-md">
      <iframe
        className="h-[164px] w-[104%] origin-center -translate-x-[2%] -translate-y-[6px] scale-[1.02]"
        src={`https://open.spotify.com/embed/track/${trackId}`}
        frameBorder={0}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    </div>
  );
}
