// Expands src/data/seedMovies.ts with real TMDB movies (correct tmdbId + composer credits).
// Usage: node scripts/fetchMovieCatalog.mjs [targetPerDecade=100]
//
// Keeps every hand-curated entry already in seedMovies.ts (parsed out of the file verbatim)
// and tops each decade up to the target count with additional popular movies pulled from
// TMDB's /discover/movie, using real composer credits from /movie/{id}/credits.
// scoreTitle defaults to the movie's own title -- it's only used server-side to seed an
// iTunes soundtrack search (server/src/game/nameThatMovie.ts), never shown to players, and
// the runtime already falls back to the top search result when there's no exact cue match.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const seedMoviesPath = path.resolve(__dirname, "..", "src", "data", "seedMovies.ts");

// --- load repo-root .env (TMDB_ACCESS_TOKEN or TMDB_API_KEY) without adding a dotenv dependency ---
function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(path.join(repoRoot, ".env"));

const accessToken = process.env.TMDB_ACCESS_TOKEN?.trim();
const apiKey = process.env.TMDB_API_KEY?.trim();
const bearerToken = accessToken && (accessToken.startsWith("eyJ") || accessToken.includes(".")) ? accessToken : undefined;
const queryApiKey = apiKey || (!bearerToken ? accessToken : undefined);
if (!bearerToken && !queryApiKey) {
  console.error("Set TMDB_ACCESS_TOKEN or TMDB_API_KEY in the repo-root .env before running this script.");
  process.exit(1);
}

const TARGET_PER_DECADE = Number(process.argv[2] ?? 100);
const ALL_DECADES = [1970, 1980, 1990, 2000, 2010, 2020];
// Decades to (re)fetch from TMDB this run. Any decade in ALL_DECADES but not here is left untouched:
// its already-parsed curated entries still pass through to the output unchanged.
const DECADES = process.env.FMC_DECADES ? process.env.FMC_DECADES.split(",").map(Number) : ALL_DECADES;
const MIN_VOTE_COUNT = 120;
const TODAY = new Date().toISOString().slice(0, 10);

async function tmdbGet(pathname, params) {
  const url = new URL(`https://api.themoviedb.org/3${pathname}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  if (queryApiKey) url.searchParams.set("api_key", queryApiKey);
  const headers = bearerToken ? { Authorization: `Bearer ${bearerToken}` } : undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, { headers });
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "1");
      await sleep((retryAfter || 1) * 1000);
      continue;
    }
    if (!response.ok) throw new Error(`TMDB ${response.status} for ${pathname}`);
    return response.json();
  }
  throw new Error(`TMDB rate-limited repeatedly for ${pathname}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Small fixed-concurrency pool so we don't hammer the API.
async function mapWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function findComposer(tmdbId) {
  const credits = await tmdbGet(`/movie/${tmdbId}/credits`, {});
  const crew = credits.crew ?? [];
  const byJob = (job) => crew.find((c) => c.job === job)?.name;
  return byJob("Original Music Composer") ?? byJob("Composer") ?? byJob("Music") ??
    crew.find((c) => c.department === "Sound" && /compos/i.test(c.job ?? ""))?.name;
}

async function discoverDecade(decade) {
  const candidates = [];
  const seenPageIds = new Set();
  for (let page = 1; page <= 15 && candidates.length < TARGET_PER_DECADE * 2.5; page++) {
    const data = await tmdbGet("/discover/movie", {
      sort_by: "popularity.desc",
      "primary_release_date.gte": `${decade}-01-01`,
      "primary_release_date.lte": `${decade + 9}-12-31`,
      "vote_count.gte": MIN_VOTE_COUNT,
      include_adult: "false",
      page,
    });
    if (!data.results?.length) break;
    for (const movie of data.results) {
      if (!movie.backdrop_path || !movie.release_date) continue;
      if (movie.release_date > TODAY) continue; // exclude unreleased/announced titles players couldn't have seen
      if (seenPageIds.has(movie.id)) continue;
      seenPageIds.add(movie.id);
      candidates.push(movie);
    }
    if (page >= (data.total_pages ?? 1)) break;
  }
  return candidates;
}

function parseCuratedEntries(source) {
  const arrayMatch = source.match(/export const SEED_MOVIES: SeedMovie\[\] = \[([\s\S]*?)\n\];/);
  if (!arrayMatch) throw new Error("Could not locate SEED_MOVIES array in seedMovies.ts");
  const body = arrayMatch[1];
  const entries = [];
  const rowRegex = /\{\s*tmdbId:\s*(\d+),\s*title:\s*"((?:[^"\\]|\\.)*)",\s*releaseYear:\s*(\d+),\s*scoreTitle:\s*"((?:[^"\\]|\\.)*)",\s*composer:\s*"((?:[^"\\]|\\.)*)"\s*\},?/g;
  let m;
  while ((m = rowRegex.exec(body))) {
    entries.push({
      tmdbId: Number(m[1]),
      title: m[2].replace(/\\"/g, '"'),
      releaseYear: Number(m[3]),
      scoreTitle: m[4].replace(/\\"/g, '"'),
      composer: m[5].replace(/\\"/g, '"'),
    });
  }
  return entries;
}

function decadeOf(year) {
  return Math.floor(year / 10) * 10;
}

async function main() {
  const source = fs.readFileSync(seedMoviesPath, "utf8");
  const curated = parseCuratedEntries(source);
  const usedIds = new Set(curated.map((m) => m.tmdbId));
  console.log(`Parsed ${curated.length} existing curated entries.`);

  const byDecade = new Map(ALL_DECADES.map((d) => [d, curated.filter((m) => decadeOf(m.releaseYear) === d)]));

  for (const decade of DECADES) {
    const already = byDecade.get(decade).length;
    const needed = Math.max(0, TARGET_PER_DECADE - already);
    if (needed === 0) {
      console.log(`${decade}s: already have ${already}, skipping.`);
      continue;
    }
    console.log(`${decade}s: have ${already}, need ${needed} more. Discovering...`);
    const candidates = (await discoverDecade(decade)).filter((c) => !usedIds.has(c.id));

    const composers = await mapWithConcurrency(candidates, 6, async (movie) => {
      try {
        return await findComposer(movie.id);
      } catch {
        return undefined;
      }
    });

    const added = [];
    for (let i = 0; i < candidates.length && added.length < needed; i++) {
      const composer = composers[i];
      if (!composer) continue;
      const movie = candidates[i];
      usedIds.add(movie.id);
      added.push({
        tmdbId: movie.id,
        title: movie.title,
        releaseYear: Number(movie.release_date.slice(0, 4)),
        scoreTitle: movie.title,
        composer,
      });
    }
    console.log(`${decade}s: added ${added.length} (of ${needed} needed, ${candidates.length} candidates seen).`);
    byDecade.set(decade, [...byDecade.get(decade), ...added]);
  }

  const esc = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const lines = [
    'import { Category } from "./seedTracks";',
    "",
    "export interface SeedMovie {",
    "  tmdbId: number;",
    "  title: string;",
    "  releaseYear: number;",
    "  scoreTitle: string;",
    "  composer: string;",
    "}",
    "",
    "/** Movies for the Name That Movie game. Hand-picked score cues plus TMDB-sourced popularity picks, grouped by decade. */",
    "export const SEED_MOVIES: SeedMovie[] = [",
  ];
  for (const decade of ALL_DECADES) {
    lines.push(`  // ${decade}s`);
    for (const m of byDecade.get(decade).sort((a, b) => a.releaseYear - b.releaseYear || a.title.localeCompare(b.title))) {
      lines.push(
        `  { tmdbId: ${m.tmdbId}, title: "${esc(m.title)}", releaseYear: ${m.releaseYear}, scoreTitle: "${esc(m.scoreTitle)}", composer: "${esc(m.composer)}" },`
      );
    }
    lines.push("");
  }
  if (lines[lines.length - 1] === "") lines.pop();
  lines.push(
    "];",
    "",
    "export function moviesForCategory(category: Category): SeedMovie[] {",
    '  if (category === "general") return SEED_MOVIES;',
    "  const decade = Number(category.slice(0, 4));",
    "  return SEED_MOVIES.filter((movie) => Math.floor(movie.releaseYear / 10) * 10 === decade);",
    "}",
    ""
  );

  fs.writeFileSync(seedMoviesPath, lines.join("\n"), "utf8");
  for (const decade of ALL_DECADES) console.log(`${decade}s: ${byDecade.get(decade).length} total movies`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
