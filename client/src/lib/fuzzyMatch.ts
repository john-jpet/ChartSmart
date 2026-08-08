import Fuse from "fuse.js";

/** Strips punctuation, case, and "feat./ft." credits so guesses match the canonical title. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(feat\.?[^)]*\)/g, "")
    .replace(/\bfeat\.?\s.*$/g, "")
    .replace(/\bft\.?\s.*$/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const MATCH_DISTANCE_THRESHOLD = 0.2;

export interface MatchableTrack {
  id: string;
  title: string;
  normalized: string;
}

export function buildMatchIndex(titles: { id: string; title: string }[]) {
  const items: MatchableTrack[] = titles.map((t) => ({
    id: t.id,
    title: t.title,
    normalized: normalizeTitle(t.title),
  }));
  const fuse = new Fuse(items, {
    keys: ["normalized"],
    includeScore: true,
    threshold: MATCH_DISTANCE_THRESHOLD,
    ignoreLocation: true,
  });
  return { items, fuse };
}

export function findMatch(
  fuse: Fuse<MatchableTrack>,
  guess: string
): MatchableTrack | null {
  const normalizedGuess = normalizeTitle(guess);
  if (!normalizedGuess) return null;
  const results = fuse.search(normalizedGuess);
  const best = results[0];
  if (best && (best.score ?? 1) <= MATCH_DISTANCE_THRESHOLD) {
    return best.item;
  }
  return null;
}
