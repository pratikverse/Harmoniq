/**
 * Spotify Authorization Code with PKCE -- the OAuth flow meant for
 * public clients (SPAs) that can't keep a secret. No backend involved:
 * the browser exchanges the auth code for a token directly with
 * Spotify's accounts service.
 */

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined;
const REDIRECT_URI = `${window.location.origin}/callback`;
const SCOPES = "playlist-modify-private playlist-modify-public";

const TOKEN_KEY = "harmoniq_spotify_token";
const VERIFIER_KEY = "harmoniq_spotify_verifier";

interface StoredToken {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

function base64UrlEncode(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function generateCodeVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(64));
  return base64UrlEncode(bytes.buffer);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(digest);
}

export function isSpotifyConfigured(): boolean {
  return Boolean(CLIENT_ID);
}

export async function startLogin(): Promise<void> {
  if (!CLIENT_ID) throw new Error("VITE_SPOTIFY_CLIENT_ID is not set.");

  const verifier = generateCodeVerifier();
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  const challenge = await generateCodeChallenge(verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function handleCallback(code: string): Promise<void> {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier || !CLIENT_ID) throw new Error("Missing PKCE verifier or client id.");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!response.ok) throw new Error("Spotify token exchange failed.");
  const data = await response.json();
  storeToken(data);
  sessionStorage.removeItem(VERIFIER_KEY);
}

function storeToken(data: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}): void {
  const stored: StoredToken = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000 - 30_000,
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(stored));
}

async function refreshAccessToken(refreshToken: string): Promise<StoredToken | null> {
  if (!CLIENT_ID) return null;

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  // Spotify may omit refresh_token on refresh -- keep the old one if so.
  const merged = { ...data, refresh_token: data.refresh_token ?? refreshToken };
  storeToken(merged);
  return JSON.parse(localStorage.getItem(TOKEN_KEY)!) as StoredToken;
}

export async function getValidAccessToken(): Promise<string | null> {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;

  const stored = JSON.parse(raw) as StoredToken;
  if (Date.now() < stored.expires_at) return stored.access_token;

  const refreshed = await refreshAccessToken(stored.refresh_token);
  return refreshed?.access_token ?? null;
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return localStorage.getItem(TOKEN_KEY) !== null;
}
