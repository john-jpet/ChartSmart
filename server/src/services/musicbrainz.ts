import axios from "axios";
import { cachedFetch, musicbrainzRateLimiter } from "./cache";

const BASE_URL = "https://musicbrainz.org/ws/2";
// MusicBrainz requires a descriptive User-Agent identifying the application; requests without one get throttled harder.
const USER_AGENT = "ChartSmart/0.1.0 (https://github.com/chartsmart)";

interface MbArtistSearchResponse {
  artists: { id: string; name: string; score: number }[];
}

interface MbReleaseGroupSearchResponse {
  "release-groups": {
    id: string;
    title: string;
    "primary-type"?: string;
    "first-release-date"?: string;
  }[];
}

export interface DiscographyEntry {
  id: string;
  title: string;
  releaseYear?: number;
}

async function musicbrainzGet<T extends {}>(pathname: string, params: Record<string, string>): Promise<T> {
  const cacheKey = `musicbrainz:${pathname}:${JSON.stringify(params)}`;
  return cachedFetch(cacheKey, () =>
    musicbrainzRateLimiter.schedule("musicbrainz", async () => {
      const response = await axios.get<T>(`${BASE_URL}/${pathname}`, {
        params: { ...params, fmt: "json" },
        headers: { "User-Agent": USER_AGENT },
      });
      return response.data;
    })
  );
}

export async function searchArtistMbid(artistName: string): Promise<string | null> {
  const data = await musicbrainzGet<MbArtistSearchResponse>("artist", {
    query: `artist:${artistName}`,
    limit: "1",
  });
  return data.artists[0]?.id ?? null;
}

export async function getArtistDiscography(mbid: string): Promise<DiscographyEntry[]> {
  const data = await musicbrainzGet<MbReleaseGroupSearchResponse>("release-group", {
    artist: mbid,
    type: "album",
    limit: "100",
  });
  return data["release-groups"].map((rg) => ({
    id: rg.id,
    title: rg.title,
    releaseYear: rg["first-release-date"] ? new Date(rg["first-release-date"]).getFullYear() : undefined,
  }));
}
