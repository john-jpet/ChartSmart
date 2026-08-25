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

const MIN_POOL_SIZE = 4; // need at least 1 correct + 3 distractors

/** Picks an unused track (within the chosen category) with a playable preview, plus 3 distractor titles. */
export async function selectRound(usedTrackIds: Set<string>, category: Category = "general"): Promise<RoundData | null> {
  let pool = nameThatTuneTracksForCategory(category);
  // Guards against a thin category pool — falls back to the full catalog rather than stalling the game.
  if (pool.length < MIN_POOL_SIZE) pool = nameThatTuneTracksForCategory("general");

  const candidates = shuffle(pool.filter((t) => !usedTrackIds.has(trackKey(t))));

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
