import { Router } from "express";
import { searchArtist, lookupArtistAlbums } from "../services/itunes";
import { getArtistInfo } from "../services/lastfm";
import { searchArtistMbid, getArtistDiscography } from "../services/musicbrainz";

export const artistsRouter = Router();

artistsRouter.get("/:name", async (req, res, next) => {
  try {
    const name = req.params.name;
    const artist = await getArtistInfo(name);
    if (!artist) {
      res.status(404).json({ error: `Artist '${name}' not found` });
      return;
    }
    res.json({ artist });
  } catch (err) {
    next(err);
  }
});

/** Album list for the artist, merging iTunes collection metadata (artwork) with MusicBrainz discography. */
artistsRouter.get("/:name/albums", async (req, res, next) => {
  try {
    const name = req.params.name;
    const [itunesArtist, mbid] = await Promise.all([searchArtist(name), searchArtistMbid(name)]);

    const [itunesAlbums, discography] = await Promise.all([
      itunesArtist ? lookupArtistAlbums(itunesArtist.artistId) : Promise.resolve([]),
      mbid ? getArtistDiscography(mbid) : Promise.resolve([]),
    ]);

    const albums = itunesAlbums.length
      ? itunesAlbums.map((a) => ({
          id: a.collectionId,
          title: a.collectionName,
          artworkUrl: a.artworkUrl100?.replace("100x100", "600x600"),
          releaseYear: a.releaseDate ? new Date(a.releaseDate).getFullYear() : undefined,
        }))
      : discography.map((d) => ({ id: d.id, title: d.title, releaseYear: d.releaseYear }));

    res.json({ albums });
  } catch (err) {
    next(err);
  }
});
