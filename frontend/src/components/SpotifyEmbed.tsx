export default function SpotifyEmbed({ trackId }: { trackId: string | null }) {
  if (!trackId) return null;
  return (
    <iframe
      style={{ borderRadius: 12 }}
      src={`https://open.spotify.com/embed/track/${trackId}`}
      width="100%"
      height={152}
      frameBorder={0}
      allowFullScreen
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
    />
  );
}
