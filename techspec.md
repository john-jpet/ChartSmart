# Technical Specification: Music Game Arcade Platform

## 1. System Overview

The **Music Game Arcade** is a unified, web-based platform hosting single-player and real-time multiplayer music trivia games. The system aggregates metadata, playback snippets, and listening metrics from public music APIs (iTunes, Last.fm, MusicBrainz) into a normalized internal data layer to power multiple distinct game modes.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Client Application                            │
│   ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────┐   │
│   │   Higher/Lower   │  │   Album Blitz    │  │  Name That Tune    │   │
│   │   (Solo/Daily)   │  │   (Time Attack)  │  │   (Multiplayer)    │   │
│   └────────┬─────────┘  └────────┬─────────┘  └─────────┬──────────┘   │
└────────────┼─────────────────────┼──────────────────────┼──────────────┘
             │ WebSocket (Socket.io)│ REST API             │
             ▼                     ▼                      │
┌─────────────────────────────────────────────────────────┼──────────────┐
│                  Node.js / Express Backend Engine       │              │
│                                                         │              │
│  ┌──────────────────────┐    ┌──────────────────────┐   │              │
│  │ Lobby & Room Manager │    │ Game Loop & Scoring  │   │              │
│  └──────────────────────┘    └──────────────────────┘   │              │
│  ┌──────────────────────┐    ┌──────────────────────┐   │              │
│  │  Fuzzy Match Engine  │    │  Seed / Daily Engine │   │              │
│  └──────────────────────┘    └──────────────────────┘   │              │
│                                                         ▼              │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     Data Aggregation Layer                       │  │
│  │       (Data Normalization, Cache Layer & Rate Limiter)           │  │
│  └──────┬─────────────────────────┬─────────────────────────┬───────┘  │
└─────────┼─────────────────────────┼─────────────────────────┼──────────┘
          ▼                         ▼                         ▼
  ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
  │ Last.fm API  │          │  iTunes API  │          │ MusicBrainz  │
  │ (Playcounts) │          │(Audio/Albums)│          │ (Discography)│
  └──────────────┘          └──────────────┘          └──────────────┘

```

---

## 2. Architecture & Tech Stack

### Core Technologies

* **Frontend:** React (TypeScript), Tailwind CSS, HTML5 Audio API, Lucide Icons.
* **Backend:** Node.js, Express, Socket.io (real-time state synchronization).
* **Search / Matching:** Fuse.js (client & server string distance matching).
* **Caching Layer:** In-memory LRU cache (or Redis) for API response caching.
* **Hosting Targets:** Vercel/Netlify (Frontend), Render/Fly.io (Node.js + WebSockets).

---

## 3. Data Schema & Aggregation Layer

To abstract third-party API dependencies, all external payloads are parsed into standard TypeScript interfaces.

### Core Domain Interfaces

```typescript
export interface Track {
  id: string;              // e.g., "itunes_1440850249"
  title: string;           // "Blinding Lights"
  artistName: string;      // "The Weeknd"
  albumName: string;       // "After Hours"
  previewUrl: string | null; // 30-second AAC/MP3 URL
  playcount?: number;      // Exact global plays from Last.fm
  popularity?: number;     // 0-100 metric
  releaseYear?: number;
  artworkUrl?: string;
}

export interface Artist {
  id: string;
  name: string;
  listeners?: number;
  playcount?: number;
  imageUrl?: string;
}

export interface Album {
  id: string;
  title: string;
  artistName: string;
  tracks: Track[];
  artworkUrl?: string;
  releaseYear?: number;
}

```

### Data Providers & Routing Logic

| Field | Source | Fallback / Behavior |
| --- | --- | --- |
| **Track Metadata & Audio** | iTunes Search API | Open REST API. Returns 30s preview URLs and high-res artwork. |
| **Stream Counts / Playcounts** | Last.fm REST API (`track.getInfo`, `artist.getInfo`) | Requires API key. Returns exact numeric `playcount` and `listeners`. |
| **Complete Discographies** | MusicBrainz API / iTunes Entity Lookup | Used for **Album Blitz** mode to fetch all official track titles for an artist. |

---

## 4. Game Modes Specification

### 4.1 Game Mode A: Higher or Lower (Songs & Artists)

* **Mechanic:** Player is shown Entity A (with visible playcount) and Entity B (hidden playcount). Player selects whether B is higher or lower than A.
* **Data Sources:** Last.fm API (`artist.getInfo` / `track.getInfo`).
* **Scoring:** $+1$ point per consecutive correct choice; game over on first mistake.
* **Daily Mode:** Uses an epoch-seeded random generator to yield the exact same 10-pair sequence for all players globally every 24 hours.

### 4.2 Game Mode B: Album Blitz

* **Mechanic:** Player selects an artist or album. A 60-second timer begins. Player types song titles into a single input box. Correct guesses automatically populate an checklist grid.
* **Data Sources:** iTunes Lookup API (`entity=song` by `amgArtistId` or `albumId`).
* **Validation Engine:** `Fuse.js` performs fuzzy matching against normalized strings (stripping punctuation, case, and featured artists like `"feat. ..."`).
* **Match Threshold:** Distance ratio $\le 0.2$ qualifies as a match.

### 4.3 Game Mode C: Name That Tune (Multiplayer)

* **Mechanic:** Kahoot-style room. A 1–5 second audio snippet plays. Players select the correct song title from 4 multiple-choice options. Points are rewarded based on response speed.
* **Data Sources:** iTunes Search API (`previewUrl`).
* **Architecture:** Socket.io room management with server-authoritative timers.

---

## 5. Real-Time Protocol (Multiplayer WebSocket Specification)

### Room State Lifecycle

```
[ LOBBY ] ──(host starts)──► [ ROUND_START ] ──(broadcast snippet)──► [ PLAYING ]
                                                                             │
[ END_GAME ] ◄──(all rounds complete)── [ ROUND_RESULT ] ◄──(timer ends)─────┘

```

### WebSocket Event Payloads

#### Client $\rightarrow$ Server

* `room:create` $\rightarrow$ `{ hostName: string, settings: GameSettings }`
* `room:join` $\rightarrow$ `{ roomCode: string, playerName: string }`
* `game:submit_answer` $\rightarrow$ `{ roomCode: string, optionIndex: number, clientTimeMs: number }`

#### Server $\rightarrow$ Client

* `room:updated` $\rightarrow$ `{ roomCode: string, players: Player[] }`
* `game:round_start` $\rightarrow$ `{ round: number, totalRounds: number, previewUrl: string, options: string[] }` *(Note: Correct answer is omitted from payload to prevent client-side inspection)*
* `game:round_end` $\rightarrow$ `{ correctAnswerIndex: number, scores: Record<string, number> }`

---

## 6. Implementation Roadmap

1. **Core Backend & Data Layer:** Phase 1.
Set up the Node.js Express server. Implement third-party API adapters (iTunes & Last.fm) with in-memory caching and response normalization models.


2. **Single-Player Game Engines:** Phase 2.
Build client-side UI components for Higher/Lower and Album Blitz. Implement Fuse.js fuzzy string matching for player inputs.


3. **WebSocket & Room Infrastructure:** Phase 3.
Implement Socket.io server logic for real-time room creation, countdown synchronization, and server-side scoring verification.


4. **Multiplayer UI & Audio Synchronization:** Phase 4.
Construct the multiplayer lobby frontend, synchronized HTML5 audio player controls, leaderboard views, and global daily seed generation.