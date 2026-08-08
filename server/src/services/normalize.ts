import { Track } from "../types/domain";
import { getTrackInfo } from "./lastfm";

/** Enriches an iTunes-sourced track with exact playcount/listeners from Last.fm. */
export async function hydrateTrackPlaycount(track: Track): Promise<Track> {
  try {
    const stats = await getTrackInfo(track.artistName, track.title);
    return { ...track, playcount: stats.playcount, popularity: stats.listeners };
  } catch {
    // Last.fm has no entry for this track (common for deep-catalog/obscure tracks) — keep iTunes metadata only.
    return track;
  }
}

export async function hydrateTracksPlaycount(tracks: Track[]): Promise<Track[]> {
  return Promise.all(tracks.map(hydrateTrackPlaycount));
}
