export interface Track {
  id: string;
  title: string;
  artistName: string;
  albumName: string;
  previewUrl: string | null;
  playcount?: number;
  popularity?: number;
  releaseYear?: number;
  artworkUrl?: string;
}

export interface Artist {
  id: string;
  name: string;
  listeners?: number;
  playcount?: number;
  imageUrl?: string;
}

export interface AlbumSummary {
  id: number;
  title: string;
  artistName?: string;
  artworkUrl?: string;
  releaseYear?: number;
}

export interface HigherLowerEntity {
  name: string;
  subtitle?: string;
  playcount: number;
  artworkUrl?: string;
  previewUrl?: string;
}

export interface HigherLowerPair {
  a: HigherLowerEntity;
  b: HigherLowerEntity;
}

export interface NameThatTuneRound {
  trackKey: string;
  previewUrl: string;
  artworkUrl?: string;
  options: string[];
  correctIndex: number;
}

export type Category = "general" | "1950s" | "1960s" | "1970s" | "1980s" | "1990s" | "2000s" | "2010s" | "2020s";

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "general", label: "General" },
  { id: "1950s", label: "50s" },
  { id: "1960s", label: "60s" },
  { id: "1970s", label: "70s" },
  { id: "1980s", label: "80s" },
  { id: "1990s", label: "90s" },
  { id: "2000s", label: "00s" },
  { id: "2010s", label: "10s" },
  { id: "2020s", label: "20s" },
];

async function getJson<T>(path: string): Promise<T> {
  const apiOrigin = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  const response = await fetch(`${apiOrigin}${path}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${response.status}`);
  }
  return response.json();
}

export function searchTracks(query: string, limit = 25): Promise<{ results: Track[] }> {
  return getJson(`/api/tracks/search?q=${encodeURIComponent(query)}&limit=${limit}`);
}

export function getArtist(name: string): Promise<{ artist: Artist }> {
  return getJson(`/api/artists/${encodeURIComponent(name)}`);
}

export function getArtistAlbums(name: string): Promise<{ albums: AlbumSummary[] }> {
  return getJson(`/api/artists/${encodeURIComponent(name)}/albums`);
}

export function getAlbumTracks(collectionId: number): Promise<{ tracks: Track[] }> {
  return getJson(`/api/albums/${collectionId}/tracks`);
}

export function getHigherLowerPairs(opts: {
  mode: "artists" | "tracks";
  daily?: boolean;
  count?: number;
}): Promise<{ mode: string; daily: boolean; seed: number; pairs: HigherLowerPair[] }> {
  const params = new URLSearchParams({
    mode: opts.mode,
    daily: String(opts.daily ?? false),
    count: String(opts.count ?? 10),
  });
  return getJson(`/api/game/higher-lower/pairs?${params.toString()}`);
}

export function getNameThatTuneRounds(
  count = 5,
  category: Category = "general"
): Promise<{ category: Category; rounds: NameThatTuneRound[] }> {
  return getJson(`/api/game/name-that-tune/rounds?count=${count}&category=${category}`);
}

export function getAlbumBlitzRound(
  category: Category = "general"
): Promise<{ category: Category; album: AlbumSummary; tracks: Track[] }> {
  return getJson(`/api/game/album-blitz/round?category=${category}`);
}
