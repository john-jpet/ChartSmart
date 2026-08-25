import fs from "node:fs";
import path from "node:path";

const sourcePath = process.argv[2];
const outputPath = process.argv[3] ?? path.resolve("src/data/nameThatTuneTracks.ts");

if (!sourcePath) {
  console.error("Usage: node scripts/buildTrackCatalog.mjs <billboard-all.json> [output.ts]");
  process.exit(1);
}

const charts = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const decades = [1960, 1970, 1980, 1990, 2000, 2010, 2020];
const MAX_TRACKS_PER_DECADE = 500;
const MAX_TRACKS_PER_ARTIST = 15;

function canonical(value) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const songs = new Map();
for (const chart of charts) {
  const year = Number(chart.date.slice(0, 4));
  for (const entry of chart.data) {
    const key = `${canonical(entry.artist)}::${canonical(entry.song)}`;
    const existing = songs.get(key) ?? {
      title: entry.song,
      artist: entry.artist,
      firstChartYear: year,
    };
    existing.firstChartYear = Math.min(existing.firstChartYear, year);
    songs.set(key, existing);
  }
}

// Score only the original chart run. This prevents annual holiday re-entries
// from overwhelming the hits that defined their decade.
for (const song of songs.values()) {
  song.chartPoints = 0;
  song.peak = 100;
  song.weeks = 0;
}
for (const chart of charts) {
  const year = Number(chart.date.slice(0, 4));
  for (const entry of chart.data) {
    const song = songs.get(`${canonical(entry.artist)}::${canonical(entry.song)}`);
    if (!song || year > song.firstChartYear + 1) continue;
    song.chartPoints += 101 - entry.this_week;
    song.peak = Math.min(song.peak, entry.this_week);
    song.weeks += 1;
  }
}

function artistBucket(artist) {
  return canonical(artist.split(/\s+(?:featuring|feat\.?|with|x|&|and)\s+/i)[0]);
}

const catalogs = new Map();
for (const decade of decades) {
  const artistCounts = new Map();
  const ranked = [...songs.values()]
    .filter((song) => song.firstChartYear >= decade && song.firstChartYear < decade + 10)
    .sort((a, b) => b.chartPoints - a.chartPoints || a.peak - b.peak || b.weeks - a.weeks);
  const selected = [];
  for (const song of ranked) {
    const artistKey = artistBucket(song.artist);
    const artistCount = artistCounts.get(artistKey) ?? 0;
    if (artistCount >= MAX_TRACKS_PER_ARTIST) continue;
    selected.push(song);
    artistCounts.set(artistKey, artistCount + 1);
    if (selected.length === MAX_TRACKS_PER_DECADE) break;
  }
  catalogs.set(decade, selected);
}

const q = (value) => JSON.stringify(value);
const lines = [
  "/**",
  " * Static Name That Tune / Higher-Lower catalog generated from historical Billboard Hot 100 charts.",
  " * Regenerate with: node scripts/buildTrackCatalog.mjs <billboard-all.json> src/data/nameThatTuneTracks.ts",
  " */",
  "import { Category, SeedTrack } from \"./seedTracks\";",
  "",
  "type DecadeCategory = Exclude<Category, \"general\">;",
  "",
  "export const NAME_THAT_TUNE_DECADE_TRACKS: Record<DecadeCategory, SeedTrack[]> = {",
];

for (const decade of decades) {
  lines.push(`  \"${decade}s\": [`);
  for (const song of catalogs.get(decade)) {
    lines.push(`    { title: ${q(song.title)}, artist: ${q(song.artist)}, releaseYear: ${song.firstChartYear} },`);
  }
  lines.push("  ],");
}

lines.push(
  "};",
  "",
  "export const NAME_THAT_TUNE_TRACKS: SeedTrack[] = Object.values(NAME_THAT_TUNE_DECADE_TRACKS).flat();",
  "",
  "export function nameThatTuneTracksForCategory(category: Category): SeedTrack[] {",
  "  return category === \"general\" ? NAME_THAT_TUNE_TRACKS : NAME_THAT_TUNE_DECADE_TRACKS[category];",
  "}",
  ""
);

fs.writeFileSync(outputPath, lines.join("\n"), "utf8");
for (const decade of decades) {
  console.log(`${decade}s: ${catalogs.get(decade).length} tracks`);
}
