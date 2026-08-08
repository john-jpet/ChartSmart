import { Router } from "express";
import { searchTracks } from "../services/itunes";
import { hydrateTracksPlaycount } from "../services/normalize";

export const tracksRouter = Router();

tracksRouter.get("/search", async (req, res, next) => {
  try {
    const term = String(req.query.q ?? "");
    if (!term.trim()) {
      res.status(400).json({ error: "Query parameter 'q' is required" });
      return;
    }
    const limit = Math.min(Number(req.query.limit) || 25, 50);
    const tracks = await searchTracks(term, limit);
    const hydrate = req.query.hydrate !== "false";
    const result = hydrate ? await hydrateTracksPlaycount(tracks) : tracks;
    res.json({ results: result });
  } catch (err) {
    next(err);
  }
});
