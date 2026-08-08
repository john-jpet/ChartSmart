import { SEED_ARTISTS } from "../data/seedArtists";
import { SEED_TRACKS } from "../data/seedTracks";
import { getArtistInfo, getTrackInfo } from "../services/lastfm";
import { searchTracks } from "../services/itunes";
import { mulberry32, pickWithRng, todayEpoch } from "./seededRandom";

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

export type HigherLowerMode = "artists" | "tracks";

async function hydrateArtist(name: string): Promise<HigherLowerEntity | null> {
  const artist = await getArtistInfo(name);
  if (!artist || !artist.playcount) return null;
  // Last.fm rarely serves real artist photos anymore, so fall back to their
  // top track's cover art via iTunes as a representative image.
  const [topTrack] = await searchTracks(name, 1);
  return {
    name: artist.name,
    playcount: artist.playcount,
    artworkUrl: topTrack?.artworkUrl,
    previewUrl: topTrack?.previewUrl ?? undefined,
  };
}

async function hydrateTrack(title: string, artist: string): Promise<HigherLowerEntity | null> {
  const stats = await getTrackInfo(artist, title);
  if (!stats.playcount) return null;
  const [match] = await searchTracks(`${title} ${artist}`, 1);
  return {
    name: title,
    subtitle: artist,
    playcount: stats.playcount,
    artworkUrl: match?.artworkUrl,
    previewUrl: match?.previewUrl ?? undefined,
  };
}

export function resolveSeed(daily: boolean, explicitSeed?: string): number {
  if (daily) return todayEpoch();
  if (explicitSeed) return Number(explicitSeed) || Date.now();
  return Date.now();
}

export async function buildHigherLowerChain(
  mode: HigherLowerMode,
  seed: number,
  count = 10
): Promise<HigherLowerPair[]> {
  const rng = mulberry32(seed);
  const neededItems = count + 1;

  const entities: HigherLowerEntity[] = [];

  if (mode === "artists") {
    const picks = pickWithRng(SEED_ARTISTS, Math.min(neededItems + 5, SEED_ARTISTS.length), rng);
    for (const name of picks) {
      if (entities.length >= neededItems) break;
      const hydrated = await hydrateArtist(name);
      if (hydrated) entities.push(hydrated);
    }
  } else {
    const picks = pickWithRng(SEED_TRACKS, Math.min(neededItems + 5, SEED_TRACKS.length), rng);
    for (const t of picks) {
      if (entities.length >= neededItems) break;
      const hydrated = await hydrateTrack(t.title, t.artist);
      if (hydrated) entities.push(hydrated);
    }
  }

  const pairs: HigherLowerPair[] = [];
  for (let i = 0; i < entities.length - 1; i++) {
    pairs.push({ a: entities[i], b: entities[i + 1] });
  }
  return pairs;
}
