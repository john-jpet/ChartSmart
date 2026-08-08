import { Router } from "express";
import { lookupAlbumTracks } from "../services/itunes";

export const albumsRouter = Router();

albumsRouter.get("/:collectionId/tracks", async (req, res, next) => {
  try {
    const collectionId = Number(req.params.collectionId);
    if (!Number.isFinite(collectionId)) {
      res.status(400).json({ error: "collectionId must be numeric" });
      return;
    }
    const tracks = await lookupAlbumTracks(collectionId);
    res.json({ tracks });
  } catch (err) {
    next(err);
  }
});
