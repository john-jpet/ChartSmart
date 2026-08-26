# Name That Movie (experimental)

The game uses TMDB backdrops as movie stills and curated iTunes soundtrack searches for optional background audio. It supports solo, party-mode multiplayer, and remote multiplayer.

## Setup

1. Create TMDB API credentials at <https://www.themoviedb.org/settings/api>.
2. Add either the v4 Read Access Token as `TMDB_ACCESS_TOKEN=...` or the shorter v3 key as `TMDB_API_KEY=...` to the repository-root `.env` file. For compatibility, a v3 key placed in `TMDB_ACCESS_TOKEN` is also detected automatically.
3. Restart the server.

The server keeps the token private. Browser clients only receive the selected public TMDB image URL.

Soundtrack previews are best-effort. A round remains playable with its still image when iTunes does not return a preview in the player's storefront.

## Catalog

Movie IDs and their curated score cues live in `server/src/data/seedMovies.ts`. Add at least four movies to a decade before exposing that decade as a category; thin categories automatically fall back to the general pool.

TMDB image responses and soundtrack searches use the existing in-memory service cache. No API lookup occurs after a round has been resolved until that cache entry expires.
