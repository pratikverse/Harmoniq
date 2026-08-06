import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { handleCallback } from "../lib/spotifyAuth";
import { useSpotifyAuth } from "../lib/SpotifyAuthContext";

export default function Callback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useSpotifyAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const authError = searchParams.get("error");

    if (authError) {
      setError(`Spotify declined the connection: ${authError}`);
      return;
    }
    if (!code) {
      setError("No authorization code in the callback URL.");
      return;
    }

    handleCallback(code)
      .then(() => {
        refresh();
        navigate("/playlist", { replace: true });
      })
      .catch(() => setError("Could not complete the Spotify connection."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="mx-auto max-w-xl px-5 py-24 text-center">
      {error ? (
        <>
          <h1 className="font-display text-xl font-semibold text-destructive">
            Connection failed
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Connecting to Spotify…</p>
      )}
    </section>
  );
}
