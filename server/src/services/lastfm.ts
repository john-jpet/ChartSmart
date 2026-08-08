import axios from "axios";
import { cachedFetch, lastfmRateLimiter } from "./cache";
import { env } from "../config/env";
import { Artist } from "../types/domain";

const BASE_URL = "https://ws.audioscrobbler.com/2.0/";

interface LastFmTrackInfoResponse {
  track?: {
    name: string;
    artist: { name: string };
    playcount?: string;
    listeners?: string;
  };
  error?: number;
  message?: string;
}

interface LastFmArtistInfoResponse {
  artist?: {
    name: string;
    mbid?: string;
    stats?: { listeners?: string; playcount?: string };
    image?: { "#text": string; size: string }[];
  };
  error?: number;
  message?: string;
}

async function lastfmGet<T extends {}>(params: Record<string, string>): Promise<T> {
  const cacheKey = `lastfm:${JSON.stringify(params)}`;
  return cachedFetch(cacheKey, () =>
    lastfmRateLimiter.schedule("lastfm", async () => {
      const response = await axios.get<T>(BASE_URL, {
        params: {
          ...params,
          api_key: env.lastfm.apiKey,
          format: "json",
        },
      });
      return response.data;
    })
  );
}

export interface TrackPlayStats {
  playcount?: number;
  listeners?: number;
}

export async function getTrackInfo(artistName: string, trackTitle: string): Promise<TrackPlayStats> {
  const data = await lastfmGet<LastFmTrackInfoResponse>({
    method: "track.getInfo",
    artist: artistName,
    track: trackTitle,
  });
  if (!data.track) {
    return {};
  }
  return {
    playcount: data.track.playcount ? Number(data.track.playcount) : undefined,
    listeners: data.track.listeners ? Number(data.track.listeners) : undefined,
  };
}

export async function getArtistInfo(artistName: string): Promise<Artist | null> {
  const data = await lastfmGet<LastFmArtistInfoResponse>({
    method: "artist.getInfo",
    artist: artistName,
  });
  if (!data.artist) {
    return null;
  }
  const largestImage = data.artist.image?.filter((img) => img["#text"]).pop();
  return {
    id: data.artist.mbid || data.artist.name,
    name: data.artist.name,
    listeners: data.artist.stats?.listeners ? Number(data.artist.stats.listeners) : undefined,
    playcount: data.artist.stats?.playcount ? Number(data.artist.stats.playcount) : undefined,
    imageUrl: largestImage?.["#text"] || undefined,
  };
}
