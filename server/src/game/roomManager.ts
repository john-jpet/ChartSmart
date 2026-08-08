import { Category } from "../data/seedTracks";

export interface Player {
  id: string; // socket id
  name: string;
  score: number;
  isHost: boolean;
}

export interface GameSettings {
  totalRounds: number;
  category: Category;
  playbackMode: "party" | "remote";
}

export type RoomState = "LOBBY" | "ROUND_START" | "PLAYING" | "ROUND_RESULT" | "END_GAME";

export interface RoundAnswer {
  optionIndex: number;
  answeredAtMs: number; // ms since round start
}

export interface Room {
  code: string;
  hostId: string;
  players: Map<string, Player>;
  settings: GameSettings;
  state: RoomState;
  round: number; // 1-indexed
  usedTrackIds: Set<string>;
  currentCorrectIndex: number | null;
  roundStartedAt: number | null;
  answers: Map<string, RoundAnswer>;
  timers: NodeJS.Timeout[];
}

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars

function generateRoomCode(existing: Map<string, Room>): string {
  let code: string;
  do {
    code = Array.from({ length: 5 }, () => ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]).join(
      ""
    );
  } while (existing.has(code));
  return code;
}

class RoomManager {
  private rooms = new Map<string, Room>();

  createRoom(hostId: string, hostName: string, settings: GameSettings): Room {
    const code = generateRoomCode(this.rooms);
    const room: Room = {
      code,
      hostId,
      players: new Map([[hostId, { id: hostId, name: hostName, score: 0, isHost: true }]]),
      settings,
      state: "LOBBY",
      round: 0,
      usedTrackIds: new Set(),
      currentCorrectIndex: null,
      roundStartedAt: null,
      answers: new Map(),
      timers: [],
    };
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  joinRoom(code: string, playerId: string, playerName: string): Room | null {
    const room = this.getRoom(code);
    if (!room || room.state !== "LOBBY") return null;
    room.players.set(playerId, { id: playerId, name: playerName, score: 0, isHost: false });
    return room;
  }

  removePlayer(playerId: string): Room | null {
    for (const room of this.rooms.values()) {
      if (room.players.has(playerId)) {
        room.players.delete(playerId);
        if (room.players.size === 0) {
          this.clearTimers(room);
          this.rooms.delete(room.code);
          return null;
        }
        if (room.hostId === playerId) {
          const nextHost = room.players.values().next().value;
          if (nextHost) {
            nextHost.isHost = true;
            room.hostId = nextHost.id;
          }
        }
        return room;
      }
    }
    return null;
  }

  clearTimers(room: Room): void {
    room.timers.forEach(clearTimeout);
    room.timers = [];
  }

  playersList(room: Room): Player[] {
    return Array.from(room.players.values());
  }
}

export const roomManager = new RoomManager();
