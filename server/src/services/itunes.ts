import axios from "axios";
import { cachedFetch, itunesRateLimiter } from "./cache";
import { Track } from "../types/domain";

const BASE_URL = "https://itunes.apple.com";

export interface ITunesTrackResult {
  wrapperType: string;
  kind?: string;
  trackId?: number;
  trackName?: string;
  artistId?: number;
  artistName?: string;
  collectionId?: number;
  collectionName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  releaseDate?: string;
}

interface ITunesArtistResult {
  wrapperType: string;
  artistId: number;
  artistName: string;
}

interface ITunesLookupResponse<T> {
  resultCount: number;
  results: T[];
}

async function itunesGet<T extends {}>(pathname: string, params: Record<string, string | number>): Promise<T> {
  const cacheKey = `itunes:${pathname}:${JSON.stringify(params)}`;
  return cachedFetch(cacheKey, () =>
    itunesRateLimiter.schedule("itunes", async () => {
      const response = await axios.get<T>(`${BASE_URL}/${pathname}`, { params });
      return response.data;
    })
  );
}

export function normalizeItunesTrack(raw: ITunesTrackResult): Track {
  const releaseYear = raw.releaseDate ? new Date(raw.releaseDate).getFullYear() : undefined;
  return {
    id: `itunes_${raw.trackId}`,
    title: raw.trackName ?? "Unknown Title",
    artistName: raw.artistName ?? "Unknown Artist",
    albumName: raw.collectionName ?? "Unknown Album",
    previewUrl: raw.previewUrl ?? null,
    releaseYear,
    // Apple's 100x100 artwork URLs support arbitrary size substitution.
    artworkUrl: raw.artworkUrl100?.replace("100x100", "600x600"),
  };
}

export async function searchTracks(term: string, limit = 25): Promise<Track[]> {
  const data = await itunesGet<ITunesLookupResponse<ITunesTrackResult>>("search", {
    term,
    entity: "song",
    limit,
  });
  return data.results.filter((r) => r.wrapperType === "track").map(normalizeItunesTrack);
}

export async function searchArtist(term: string): Promise<ITunesArtistResult | null> {
  const data = await itunesGet<ITunesLookupResponse<ITunesArtistResult>>("search", {
    term,
    entity: "musicArtist",
    limit: 1,
  });
  return data.results[0] ?? null;
}

export async function lookupArtistAlbums(artistId: number): Promise<ITunesTrackResult[]> {
  const data = await itunesGet<ITunesLookupResponse<ITunesTrackResult>>("lookup", {
    id: artistId,
    entity: "album",
  });
  return data.results.filter((r) => r.wrapperType === "collection");
}

export async function lookupAlbumTracks(collectionId: number): Promise<Track[]> {
  const data = await itunesGet<ITunesLookupResponse<ITunesTrackResult>>("lookup", {
    id: collectionId,
    entity: "song",
  });
  return data.results.filter((r) => r.wrapperType === "track").map(normalizeItunesTrack);
}
