# ChartSmart

ChartSmart is a music and movie trivia arcade. It combines live metadata, play counts, artwork, and audio previews from third-party services with curated catalogs and real-time multiplayer rooms.

## Game modes

- **Higher or Lower** — compare artist or song play counts. Keep the streak going, or play the daily challenge, which gives everyone the same UTC-day sequence.
- **Album Blitz** — choose a decade, get a surprise album, and type as many track titles as possible before time runs out. Answers are fuzzy-matched for case, punctuation, and common featured-artist variations.
- **Name That Tune** — identify songs from short audio previews. Play solo or race other players in a Socket.io room, with decade filters and Party or Remote playback modes.
- **Name That Movie** — identify films from score previews and movie artwork. Play solo or in multiplayer rooms, with decade filters and Party or Remote playback modes.

## Stack and data sources

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router, Socket.io Client, Fuse.js
- **Backend:** Node.js, Express, TypeScript, Socket.io
- **Music data:** iTunes Search API, Last.fm API, and MusicBrainz API
- **Movie data:** TMDB API, with iTunes used for available score previews

## Repository layout

```text
client/                 React + Vite frontend
  src/pages/            Game screens and routes
  src/components/       Shared UI components
  src/lib/              API and Socket.io clients
server/                 Express + Socket.io backend
  src/routes/           REST endpoints
  src/services/         Third-party API adapters and caching
  src/game/             Game and room logic
  src/data/             Seed and generated catalogs
  src/socket/           Multiplayer event handlers
  scripts/              Catalog generation and validation tools
.env.example            Local configuration template
```

## Requirements

- Node.js 20 or later
- npm
- A free [Last.fm API account](https://www.last.fm/api/account/create)
- A TMDB API key or v4 read access token for **Name That Movie**

## Local development

1. Create the local environment file:

   ```bash
   cp .env.example .env
   ```

   Fill in at least these values:

   ```dotenv
   LAST_FM_API_KEY=your_last_fm_key
   TMDB_ACCESS_TOKEN=your_tmdb_token
   # Or use TMDB_API_KEY instead of TMDB_ACCESS_TOKEN
   PORT=4000
   ```

   `LAST_FM_SHARED_SECRET`, `LAST_FM_USERNAME`, `VITE_API_URL`, and `VITE_SERVER_URL` are optional for the standard local setup.

2. Install dependencies from the repository root:

   ```bash
   npm install
   ```

3. Start the backend and frontend in separate terminals:

   ```bash
   npm run dev:server   # http://localhost:4000
   npm run dev:client   # http://localhost:5173
   ```

   Open <http://localhost:5173>. Vite proxies API requests to the backend during development.

## Production build

Build both workspaces from the repository root:

```bash
npm run build:server
npm run build:client
```

Then start the compiled server:

```bash
npm run start --workspace=server
```

The server hosts the compiled frontend from `client/dist` and serves the API and Socket.io connection from the same origin.

## Useful commands

```bash
# Frontend linting
npm run lint --workspace=client

# Build a generated music catalog
npm run catalog:build --workspace=server

# Build and validate the generated catalog
npm run catalog:validate --workspace=server
```

## HTTP API

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Server health check |
| `GET /api/tracks/search?q=` | Search tracks; optionally set `hydrate=false` to skip Last.fm enrichment |
| `GET /api/artists/:name` | Get Last.fm artist statistics |
| `GET /api/artists/:name/albums` | Get an artist's albums from iTunes/MusicBrainz |
| `GET /api/albums/:collectionId/tracks` | Get an album tracklist |
| `GET /api/game/higher-lower/pairs` | Generate Higher or Lower pairs (`mode`, `daily`, `count`) |
| `GET /api/game/name-that-tune/rounds` | Generate solo Name That Tune rounds (`category`, `count`) |
| `GET /api/game/name-that-movie/rounds` | Generate solo Name That Movie rounds (`category`, `count`) |
| `GET /api/game/album-blitz/round` | Generate an Album Blitz round (`category`) |

Multiplayer games use Socket.io. The main events include `room:create`, `room:join`, `room:start`, `room:restart`, `room:leave`, and `game:submit_answer`; server updates include `room:updated`, `game:round_start`, `game:round_end`, and `game:end_game`.

## Notes

- Third-party API availability and rate limits can affect round generation.
- Name That Movie requires TMDB credentials at runtime; without them, its API route returns a configuration error.
- Do not commit `.env` or other files containing API credentials.
