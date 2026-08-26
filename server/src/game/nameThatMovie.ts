import { Category } from "../data/seedTracks";
import { moviesForCategory, SeedMovie } from "../data/seedMovies";
import { searchTracks } from "../services/itunes";
import { getMovieBackdrop } from "../services/tmdb";

export interface MovieRoundData {
  trackKey: string;
  imageUrl: string;
  previewUrl?: string;
  options: string[];
  correctIndex: number;
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function canonical(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function soundtrackPreview(movie: SeedMovie): Promise<string | undefined> {
  const tracks = await searchTracks(`${movie.scoreTitle} ${movie.composer}`, 8);
  const exact = tracks.find((track) => canonical(track.title).includes(canonical(movie.scoreTitle)));
  return (exact ?? tracks[0])?.previewUrl ?? undefined;
}

export async function selectMovieRound(usedIds: Set<string>, category: Category = "general"): Promise<MovieRoundData | null> {
  let pool = moviesForCategory(category);
  if (pool.length < 4) pool = moviesForCategory("general");
  const candidates = shuffle(pool.filter((movie) => !usedIds.has(String(movie.tmdbId))));

  for (const movie of candidates) {
    const imageUrl = await getMovieBackdrop(movie.tmdbId);
    if (!imageUrl) continue;
    const previewUrl = await soundtrackPreview(movie).catch(() => undefined);
    const distractors = shuffle(pool.filter((item) => item.tmdbId !== movie.tmdbId)).slice(0, 3).map((item) => item.title);
    const options = shuffle([movie.title, ...distractors]);
    usedIds.add(String(movie.tmdbId));
    return {
      trackKey: `tmdb:${movie.tmdbId}`,
      imageUrl,
      previewUrl,
      options,
      correctIndex: options.indexOf(movie.title),
    };
  }
  return null;
}
