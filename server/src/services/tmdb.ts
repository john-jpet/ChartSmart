import axios from "axios";
import { cachedFetch, itunesRateLimiter } from "./cache";

const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w1280";

interface TmdbImage {
  file_path: string;
  vote_average: number;
  vote_count: number;
  width: number;
  height: number;
  iso_639_1: string | null;
}

interface TmdbImagesResponse {
  backdrops: TmdbImage[];
}

export async function getMovieBackdrop(tmdbId: number): Promise<string | null> {
  const accessToken = process.env.TMDB_ACCESS_TOKEN?.trim();
  const apiKey = process.env.TMDB_API_KEY?.trim();
  const credential = accessToken || apiKey;
  if (!credential) throw new Error("TMDB_ACCESS_TOKEN or TMDB_API_KEY is required for Name That Movie");

  // TMDB issues both long v4 Read Access Tokens (Bearer auth) and shorter v3 API keys.
  // Accept either format so a v3 key is never accidentally sent as a Bearer token.
  const bearerToken = accessToken && (accessToken.startsWith("eyJ") || accessToken.includes("."))
    ? accessToken
    : undefined;
  const queryApiKey = apiKey || (!bearerToken ? accessToken : undefined);

  const cached = await cachedFetch(`tmdb:movie:${tmdbId}:backdrop`, () =>
    itunesRateLimiter.schedule("tmdb", async () => {
      let response;
      try {
        response = await axios.get<TmdbImagesResponse>(`${BASE_URL}/movie/${tmdbId}/images`, {
          headers: bearerToken ? { Authorization: `Bearer ${bearerToken}` } : undefined,
          params: { include_image_language: "null,en", ...(queryApiKey ? { api_key: queryApiKey } : {}) },
        });
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          throw new Error("TMDB rejected the configured credential. Rotate it and use a valid v3 API key or v4 Read Access Token.");
        }
        throw new Error("TMDB could not load the movie image.");
      }
      const backdrop = response.data.backdrops
        .filter((image) => image.width > image.height && image.iso_639_1 === null)
        .sort((a, b) => (b.vote_count - a.vote_count) || (b.vote_average - a.vote_average))[0];
      return { url: backdrop ? `${IMAGE_BASE_URL}${backdrop.file_path}` : null };
    })
  );
  return cached.url;
}
