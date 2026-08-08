# ChartSmart

A music trivia arcade built on real playcounts, real audio previews, and real discography data — no mocked content. Three game modes, single-player and multiplayer, pulling live from iTunes, Last.fm, and MusicBrainz.

## Game modes

- **Higher or Lower** — guess whether an artist or song has more plays than the last. One wrong guess ends the streak. Includes a daily mode that deals the same 10-pair sequence to every player globally via an epoch-seeded shuffle.
- **Album Blitz** — pick a decade (or General for anything), get handed a surprise album from that era, and type as many track titles as you can before the clock runs out. Guesses are fuzzy-matched (punctuation/case/`feat.` insensitive) against the real tracklist.
- **Name That Tune** — identify songs from short audio snippets. Play solo against the clock, or create/join a live multiplayer room where everyone races for the fastest correct answer. Rounds can be filtered to a specific decade (60s–20s) or General. Hosts can also choose **Party mode** (audio plays on the host's device, everyone looks at one screen) or **Remote mode** (audio streams to every player's own device).

## Tech stack

- **Client:** React + TypeScript, Vite, Tailwind CSS, React Router, Socket.io client, Fuse.js
- **Server:** Node.js, Express, Socket.io, TypeScript
- **Data sources:** iTunes Search API (track/album metadata, artwork, 30s previews), Last.fm API (playcounts, listener stats), MusicBrainz API (discography cross-referencing)

## Project structure

```
├── client/           React + Vite frontend
│   └── src/
│       ├── pages/     One component per game mode
│       ├── components/
│       └── lib/       API client + Socket.io wrapper
├── server/           Express + Socket.io backend
│   └── src/
│       ├── routes/    REST endpoints (tracks, artists, albums, game)
│       ├── services/  Third-party API adapters + caching
│       ├── game/      Game logic (Higher/Lower chains, Name That Tune rounds, room manager)
│       ├── data/      Curated seed track/artist pools
│       └── socket/    Multiplayer room/round event handlers
└── .env               Last.fm credentials (see below)
```

## Getting started

### Prerequisites

- Node.js 20+ and npm
- A [Last.fm API account](https://www.last.fm/api/account/create) (free) for `LAST_FM_API_KEY`

### Setup

1. Copy the example env file and fill in your Last.fm key:

   ```bash
   cp .env.example .env
   ```

   ```
   LAST_FM_API_KEY=your_key_here
   LAST_FM_SHARED_SECRET=
   LAST_FM_USERNAME=
   PORT=4000
   ```

2. Install dependencies from the repo root (this is an npm workspaces monorepo):

   ```bash
   npm install
   ```

3. Run the backend and frontend in separate terminals:

   ```bash
   npm run dev:server   # http://localhost:4000
   npm run dev:client   # http://localhost:5173
   ```

The Vite dev server proxies `/api` requests to the backend, so just open `http://localhost:5173`.

### Building for production

```bash
npm run build:server
npm run build:client
```

## API overview

| Endpoint | Description |
| --- | --- |
| `GET /api/tracks/search?q=` | Search tracks, hydrated with Last.fm playcounts |
| `GET /api/artists/:name` | Artist info (listeners, playcount) |
| `GET /api/artists/:name/albums` | Artist's albums (iTunes + MusicBrainz) |
| `GET /api/albums/:collectionId/tracks` | Full tracklist for an album |
| `GET /api/game/higher-lower/pairs` | Higher/Lower round chain (`mode=artists\|tracks`, `daily=true\|false`) |
| `GET /api/game/name-that-tune/rounds` | Solo Name That Tune rounds (`category=general\|1960s...2020s`) |
| `GET /api/game/album-blitz/round` | Random album for Album Blitz (`category=general\|1960s...2020s`) |

Multiplayer Name That Tune runs over Socket.io (`room:create`, `room:join`, `room:start`, `game:submit_answer` → `room:updated`, `game:round_start`, `game:round_end`, `game:end_game`).
