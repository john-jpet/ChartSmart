import { io, Socket } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || window.location.origin;

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL, { autoConnect: true });
  }
  return socket;
}

export interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  streak: number;
}

export interface RoundStartPayload {
  round: number;
  totalRounds: number;
  previewUrl?: string;
  artworkUrl?: string;
  imageUrl?: string;
  options: string[];
  durationMs: number;
  playbackMode: "party" | "remote";
}

export interface RoundEndPayload {
  correctAnswerIndex: number;
  scores: Record<string, number>;
  streaks: Record<string, number>;
}

export interface EndGamePayload {
  scores: Record<string, number>;
  players: Player[];
}
