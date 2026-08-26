import { SeedTrack, Category } from "../data/seedTracks";
import { nameThatTuneTracksForCategory } from "../data/nameThatTuneTracks";
import { searchTracks } from "../services/itunes";

export interface RoundData {
  trackKey: string;
  previewUrl: string;
  artworkUrl?: string;
  options: string[];
  correctIndex: number;
}

function trackKey(t: SeedTrack): string {
  return `${t.artist}::${t.title}`;
}

interface TrackMedia {
  previewUrl: string | null;
  artworkUrl?: string;
}

const mediaCache = new Map<string, TrackMedia>();

function canonicalTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\([^)]*(remaster|version|edit|mix)[^)]*\)/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s+-\s+(remaster(ed)?|single version|radio edit).*$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function resolveTrackMedia(track: SeedTrack): Promise<TrackMedia> {
  const key = trackKey(track);
  const cached = mediaCache.get(key);
  if (cached) return cached;
  const results = await searchTracks(`${track.title} ${track.artist}`, 5);
  const exactTitle = results.find((result) => canonicalTitle(result.title) === canonicalTitle(track.title));
  const match = exactTitle ?? results[0];
  const media: TrackMedia = { previewUrl: match?.previewUrl ?? null, artworkUrl: match?.artworkUrl };
  mediaCache.set(key, media);
  return media;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Weighted random ordering (Efraimidis-Spirakis): each item gets a random key
 * scaled by its weight, then keys are sorted descending. Heavier items tend to
 * sort earlier without being guaranteed first, unlike a plain weighted pick.
 */
function weightedShuffle<T>(items: T[], weightOf: (item: T) => number): T[] {
  return items
    .map((item) => ({ item, key: Math.random() ** (1 / weightOf(item)) }))
    .sort((a, b) => b.key - a.key)
    .map(({ item }) => item);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

const MIN_POOL_SIZE = 4; // need at least 1 correct + 3 distractors

/** Picks an unused track (within the chosen category) with a playable preview, plus 3 distractor titles. */
export async function selectRound(usedTrackIds: Set<string>, category: Category = "general"): Promise<RoundData | null> {
  let pool = nameThatTuneTracksForCategory(category);
  // Guards against a thin category pool — falls back to the full catalog rather than stalling the game.
  if (pool.length < MIN_POOL_SIZE) pool = nameThatTuneTracksForCategory("general");

  const unused = pool.filter((t) => !usedTrackIds.has(trackKey(t)));
  // Tracks with no Billboard-chart popularity data (e.g. pre-1958 standards) fall
  // back to the pool's median so they land mid-pack instead of being starved.
  const fallbackPopularity = median(unused.map((t) => t.popularity).filter((p): p is number => p !== undefined));
  // A power between 0.5 (sqrt) and 1 (linear) compresses the multi-order-of-magnitude
  // spread in chart popularity, so well-known hits surface more often without making
  // selection deterministic. 0.6 leans a little harder toward hits than sqrt did.
  const candidates = weightedShuffle(unused, (t) => ((t.popularity ?? fallbackPopularity) + 1) ** 0.6);

  for (const candidate of candidates) {
    const media = await resolveTrackMedia(candidate);
    if (!media.previewUrl) continue;

    usedTrackIds.add(trackKey(candidate));

    const distractorPool = pool.filter((t) => t.title !== candidate.title);
    const distractors = shuffle(distractorPool)
      .slice(0, 3)
      .map((t) => t.title);

    const options = shuffle([candidate.title, ...distractors]);
    const correctIndex = options.indexOf(candidate.title);

    return {
      trackKey: trackKey(candidate),
      previewUrl: media.previewUrl,
      artworkUrl: media.artworkUrl,
      options,
      correctIndex,
    };
  }

  return null;
}
