import { SeedTrack, Category, tracksForCategory } from "../data/seedTracks";
import { searchTracks } from "../services/itunes";
import { getArtistTopTracks } from "../services/lastfm";

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
const expandedPoolCache = new Map<Category, Promise<SeedTrack[]>>();

const EXPANDED_POOL_SIZE = 100;
const DISCOVERY_RESULTS_PER_ARTIST = 50;
const MAX_RANKED_CANDIDATES_PER_ARTIST = 10;
const MIN_DISCOVERED_LISTENERS = 50_000;
const MIN_DISCOVERED_PLAYS = 500_000;

function canonicalTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\([^)]*(remaster|version|edit|mix)[^)]*\)/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s+-\s+(remaster(ed)?|single version|radio edit).*$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function canonicalSongKey(artist: string, title: string): string {
  return `${artist.toLowerCase()}::${canonicalTitle(title)}`;
}

function isStandardSongVersion(title: string): boolean {
  return !/\b(live|remix|demo|karaoke|instrumental|commentary|sped up|slowed|acoustic version|tribute)\b/i.test(title);
}

/** Expands decade rounds to 100 recognizable, preview-backed songs while preserving the curated starter set. */
async function expandedTracksForCategory(category: Category): Promise<SeedTrack[]> {
  if (category === "general") return tracksForCategory(category);
  const cached = expandedPoolCache.get(category);
  if (cached) return cached;

  const promise = (async () => {
    const curated = tracksForCategory(category);
    const pool = [...curated];
    const seen = new Set(pool.map((track) => canonicalSongKey(track.artist, track.title)));
    const decadeStart = Number(category.slice(0, 4));
    const artists = [...new Set(curated.map((track) => track.artist))];
    const candidatesByArtist: { track: SeedTrack; media: TrackMedia }[][] = [];

    for (const artist of artists) {
      const [results, rankedTracks] = await Promise.all([
        searchTracks(artist, DISCOVERY_RESULTS_PER_ARTIST),
        getArtistTopTracks(artist, 20),
      ]);
      const familiarity = new Map(rankedTracks.map((track, rank) => [canonicalTitle(track.title), { ...track, rank }]));
      const artistCandidates: { track: SeedTrack; media: TrackMedia }[] = [];
      const artistSeen = new Set<string>();
      const familiarResults = results
        .map((result) => ({ result, stats: familiarity.get(canonicalTitle(result.title)) }))
        .filter(({ stats }) => stats && (stats.listeners >= MIN_DISCOVERED_LISTENERS || stats.playcount >= MIN_DISCOVERED_PLAYS))
        .sort((a, b) => (a.stats?.rank ?? 999) - (b.stats?.rank ?? 999));
      for (const { result } of familiarResults) {
        if (artistCandidates.length >= MAX_RANKED_CANDIDATES_PER_ARTIST) break;
        if (!result.previewUrl || !result.releaseYear) continue;
        if (Math.floor(result.releaseYear / 10) * 10 !== decadeStart) continue;
        if (result.artistName.toLowerCase() !== artist.toLowerCase()) continue;
        if (!isStandardSongVersion(result.title)) continue;
        const candidate: SeedTrack = { title: result.title, artist: result.artistName, releaseYear: result.releaseYear };
        const key = canonicalSongKey(candidate.artist, candidate.title);
        if (seen.has(key) || artistSeen.has(key)) continue;
        artistSeen.add(key);
        artistCandidates.push({
          track: candidate,
          media: { previewUrl: result.previewUrl, artworkUrl: result.artworkUrl },
        });
      }
      candidatesByArtist.push(artistCandidates);
    }

    // Take each artist's best-ranked remaining song in turn. Artists with thin
    // catalogs simply drop out while deeper hitmakers continue contributing.
    for (let rank = 0; pool.length < EXPANDED_POOL_SIZE; rank++) {
      let addedAtThisRank = false;
      for (const artistCandidates of candidatesByArtist) {
        const candidate = artistCandidates[rank];
        if (!candidate || pool.length >= EXPANDED_POOL_SIZE) continue;
        const key = canonicalSongKey(candidate.track.artist, candidate.track.title);
        if (seen.has(key)) continue;
        seen.add(key);
        pool.push(candidate.track);
        mediaCache.set(trackKey(candidate.track), candidate.media);
        addedAtThisRank = true;
      }
      if (!addedAtThisRank) break;
    }

    return pool.slice(0, EXPANDED_POOL_SIZE);
  })();

  expandedPoolCache.set(category, promise);
  return promise;
}

async function resolveTrackMedia(track: SeedTrack): Promise<TrackMedia> {
  const key = trackKey(track);
  const cached = mediaCache.get(key);
  if (cached) return cached;
  const results = await searchTracks(`${track.title} ${track.artist}`, 1);
  const media: TrackMedia = { previewUrl: results[0]?.previewUrl ?? null, artworkUrl: results[0]?.artworkUrl };
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
  let pool = await expandedTracksForCategory(category);
  // Guards against a thin category pool — falls back to the full catalog rather than stalling the game.
  if (pool.length < MIN_POOL_SIZE) pool = tracksForCategory("general");

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
