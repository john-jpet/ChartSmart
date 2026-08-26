import { Router } from "express";
import { buildHigherLowerChain, resolveSeed, HigherLowerMode } from "../game/higherLower";
import { selectRound } from "../game/nameThatTune";
import { isCategory, Category } from "../data/seedTracks";
import { tracksForCategory } from "../data/seedTracks";
import { searchArtist, lookupArtistAlbums, lookupAlbumTracks } from "../services/itunes";
import { selectMovieRound } from "../game/nameThatMovie";

export const gameRouter = Router();

gameRouter.get("/higher-lower/pairs", async (req, res, next) => {
  try {
    const mode: HigherLowerMode = req.query.mode === "tracks" ? "tracks" : "artists";
    const daily = req.query.daily === "true";
    const seed = resolveSeed(daily, req.query.seed as string | undefined);
    const count = Math.min(Number(req.query.count) || 10, 20);

    const pairs = await buildHigherLowerChain(mode, seed, count);
    res.json({ mode, daily, seed, pairs });
  } catch (err) {
    next(err);
  }
});

/** Solo Name That Tune rounds — no room/opponents needed, so this skips Socket.io entirely. */
gameRouter.get("/name-that-tune/rounds", async (req, res, next) => {
  try {
    const count = Math.max(5, Math.min(Number(req.query.count) || 5, 20));
    const categoryParam = req.query.category as string | undefined;
    const category: Category = categoryParam && isCategory(categoryParam) ? categoryParam : "general";
    const usedTrackIds = new Set<string>();
    const rounds = [];
    for (let i = 0; i < count; i++) {
      const round = await selectRound(usedTrackIds, category);
      if (!round) break;
      rounds.push(round);
    }
    res.json({ category, rounds });
  } catch (err) {
    next(err);
  }
});

/** Solo Name That Movie rounds. Images come from TMDB; score previews come from iTunes when available. */
gameRouter.get("/name-that-movie/rounds", async (req, res, next) => {
  try {
    if (!process.env.TMDB_ACCESS_TOKEN?.trim() && !process.env.TMDB_API_KEY?.trim()) {
      res.status(503).json({ error: "Name That Movie needs TMDB_ACCESS_TOKEN or TMDB_API_KEY in the server environment." });
      return;
    }
    const count = Math.max(5, Math.min(Number(req.query.count) || 5, 20));
    const categoryParam = req.query.category as string | undefined;
    const category: Category = categoryParam && isCategory(categoryParam) ? categoryParam : "general";
    const usedIds = new Set<string>();
    const rounds = [];
    for (let i = 0; i < count; i++) {
      const round = await selectMovieRound(usedIds, category);
      if (!round) break;
      rounds.push(round);
    }
    res.json({ category, rounds });
  } catch (err) {
    next(err);
  }
});

gameRouter.get("/album-blitz/round", async (req, res, next) => {
  try {
    const categoryParam = req.query.category as string | undefined;
    const category: Category = categoryParam && isCategory(categoryParam) ? categoryParam : "general";
    const candidates = [...tracksForCategory(category)].sort(() => Math.random() - 0.5);

    for (const seed of candidates.slice(0, 12)) {
      const artist = await searchArtist(seed.artist);
      if (!artist) continue;

      const albums = await lookupArtistAlbums(artist.artistId);
      const matchingAlbums = albums.filter((album) => {
        if (!album.collectionId || !album.releaseDate) return false;
        const releaseYear = new Date(album.releaseDate).getFullYear();
        if (!Number.isFinite(releaseYear)) return false;
        return category === "general" || Math.floor(releaseYear / 10) * 10 === Number(category.slice(0, 4));
      });

      for (const album of matchingAlbums.sort(() => Math.random() - 0.5)) {
        const tracks = await lookupAlbumTracks(album.collectionId!);
        if (tracks.length < 5) continue;
        res.json({
          category,
          album: {
            id: album.collectionId,
            title: album.collectionName ?? "Mystery Album",
            artistName: album.artistName ?? seed.artist,
            artworkUrl: album.artworkUrl100?.replace("100x100", "600x600"),
            releaseYear: new Date(album.releaseDate!).getFullYear(),
          },
          tracks,
        });
        return;
      }
    }

    res.status(404).json({ error: "No playable album found for that category. Try again." });
  } catch (err) {
    next(err);
  }
});
