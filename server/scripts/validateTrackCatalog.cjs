const { CATEGORIES } = require("../dist/data/seedTracks.js");
const { nameThatTuneTracksForCategory } = require("../dist/data/nameThatTuneTracks.js");

function canonical(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

let failed = false;
for (const { id } of CATEGORIES) {
  const tracks = nameThatTuneTracksForCategory(id);
  const keys = tracks.map((track) => `${canonical(track.artist)}::${canonical(track.title)}`);
  const duplicates = keys.length - new Set(keys).size;
  if (duplicates) console.log(`duplicate keys in ${id}:`, keys.filter((key, index) => keys.indexOf(key) !== index));
  if (id !== "general") {
    const decade = Number(id.slice(0, 4));
    const wrongDecade = tracks.filter(
      (track) => track.releaseYear < decade || track.releaseYear >= decade + 10
    ).length;
    if (tracks.length > 500 || tracks.length < 4 || duplicates || wrongDecade) failed = true;
    console.log(`${id}: ${tracks.length} tracks, ${new Set(tracks.map((track) => track.artist)).size} credited artists, ${duplicates} duplicates, ${wrongDecade} wrong-decade entries`);
  } else {
    if (duplicates) failed = true;
    console.log(`${id}: ${tracks.length} tracks, ${duplicates} duplicates`);
  }
}

if (failed) process.exitCode = 1;
