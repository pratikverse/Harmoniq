import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { isLoggedIn, isSpotifyConfigured, logout as clearToken, startLogin } from "./spotifyAuth";

interface SpotifyAuthContextValue {
  connected: boolean;
  configured: boolean;
  connect: () => void;
  disconnect: () => void;
  refresh: () => void;
}

const SpotifyAuthContext = createContext<SpotifyAuthContextValue | null>(null);

export function SpotifyAuthProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(isLoggedIn());

  useEffect(() => {
    function onStorage() {
      setConnected(isLoggedIn());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value: SpotifyAuthContextValue = {
    connected,
    configured: isSpotifyConfigured(),
    connect: () => void startLogin(),
    disconnect: () => {
      clearToken();
      setConnected(false);
    },
    refresh: () => setConnected(isLoggedIn()),
  };

  return <SpotifyAuthContext.Provider value={value}>{children}</SpotifyAuthContext.Provider>;
}

export function useSpotifyAuth() {
  const context = useContext(SpotifyAuthContext);
  if (!context) throw new Error("useSpotifyAuth must be used within a SpotifyAuthProvider");
  return context;
}
