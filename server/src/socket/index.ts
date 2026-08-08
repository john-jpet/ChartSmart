import { Server, Socket } from "socket.io";
import { roomManager, Room } from "../game/roomManager";
import { selectRound } from "../game/nameThatTune";
import { isCategory, Category } from "../data/seedTracks";

const ROUND_ANSWER_WINDOW_MS = 8000;
const ROUND_RESULT_DISPLAY_MS = 4000;
const DEFAULT_TOTAL_ROUNDS = 5;
const MIN_TOTAL_ROUNDS = 5;
const MAX_TOTAL_ROUNDS = 20;
const MAX_ANSWER_SCORE = 1000;
const MIN_ANSWER_SCORE = 100;

function broadcastRoomUpdate(io: Server, room: Room) {
  io.to(room.code).emit("room:updated", { roomCode: room.code, players: roomManager.playersList(room) });
}

function currentScores(room: Room): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const player of room.players.values()) {
    scores[player.id] = player.score;
  }
  return scores;
}

async function startRound(io: Server, room: Room) {
  const roundData = await selectRound(room.usedTrackIds, room.settings.category);
  if (!roundData) {
    // Ran out of playable tracks — end the game early with whatever scores exist.
    endGame(io, room);
    return;
  }

  room.round += 1;
  room.state = "PLAYING";
  room.roundStartedAt = Date.now();
  room.answers = new Map();
  room.currentCorrectIndex = roundData.correctIndex;

  for (const player of room.players.values()) {
    const receivesAudio = room.settings.playbackMode === "remote" || player.isHost;
    io.to(player.id).emit("game:round_start", {
      round: room.round,
      totalRounds: room.settings.totalRounds,
      previewUrl: receivesAudio ? roundData.previewUrl : undefined,
      artworkUrl: roundData.artworkUrl,
      options: roundData.options,
      durationMs: ROUND_ANSWER_WINDOW_MS,
      playbackMode: room.settings.playbackMode,
    });
  }

  const timer = setTimeout(() => endRound(io, room), ROUND_ANSWER_WINDOW_MS);
  room.timers.push(timer);
}

function endRound(io: Server, room: Room) {
  if (room.state !== "PLAYING") return;
  room.state = "ROUND_RESULT";

  for (const [playerId, answer] of room.answers.entries()) {
    if (answer.optionIndex === room.currentCorrectIndex) {
      const player = room.players.get(playerId);
      if (!player) continue;
      const speedBonus = Math.max(0, ROUND_ANSWER_WINDOW_MS - answer.answeredAtMs);
      const points = MIN_ANSWER_SCORE + Math.round((speedBonus / ROUND_ANSWER_WINDOW_MS) * (MAX_ANSWER_SCORE - MIN_ANSWER_SCORE));
      player.score += points;
    }
  }

  io.to(room.code).emit("game:round_end", {
    correctAnswerIndex: room.currentCorrectIndex,
    scores: currentScores(room),
  });

  if (room.round >= room.settings.totalRounds) {
    const timer = setTimeout(() => endGame(io, room), ROUND_RESULT_DISPLAY_MS);
    room.timers.push(timer);
  } else {
    const timer = setTimeout(() => startRound(io, room), ROUND_RESULT_DISPLAY_MS);
    room.timers.push(timer);
  }
}

function endGame(io: Server, room: Room) {
  room.state = "END_GAME";
  roomManager.clearTimers(room);
  io.to(room.code).emit("game:end_game", { scores: currentScores(room) });
}

export function registerSocketHandlers(io: Server) {
  io.on("connection", (socket: Socket) => {
    socket.on(
      "room:create",
      ({ hostName, settings }: { hostName: string; settings?: { totalRounds?: number; category?: string; playbackMode?: string } }) => {
        const category: Category =
          settings?.category && isCategory(settings.category) ? settings.category : "general";
        const requestedRounds = Number(settings?.totalRounds) || DEFAULT_TOTAL_ROUNDS;
        const room = roomManager.createRoom(socket.id, hostName || "Host", {
          totalRounds: Math.max(MIN_TOTAL_ROUNDS, Math.min(requestedRounds, MAX_TOTAL_ROUNDS)),
          category,
          playbackMode: settings?.playbackMode === "remote" ? "remote" : "party",
        });
        socket.join(room.code);
        socket.emit("room:created", { roomCode: room.code });
        broadcastRoomUpdate(io, room);
      }
    );

    socket.on("room:join", ({ roomCode, playerName }: { roomCode: string; playerName: string }) => {
      const room = roomManager.joinRoom(roomCode, socket.id, playerName || "Player");
      if (!room) {
        socket.emit("room:error", { error: "Room not found or already in progress" });
        return;
      }
      socket.join(room.code);
      broadcastRoomUpdate(io, room);
    });

    socket.on("room:start", ({ roomCode }: { roomCode: string }) => {
      const room = roomManager.getRoom(roomCode);
      if (!room || room.hostId !== socket.id || room.state !== "LOBBY") return;
      startRound(io, room);
    });

    socket.on(
      "game:submit_answer",
      ({ roomCode, optionIndex }: { roomCode: string; optionIndex: number; clientTimeMs?: number }) => {
        const room = roomManager.getRoom(roomCode);
        if (!room || room.state !== "PLAYING" || room.roundStartedAt === null) return;
        if (room.answers.has(socket.id)) return;
        room.answers.set(socket.id, { optionIndex, answeredAtMs: Date.now() - room.roundStartedAt });
      }
    );

    socket.on("disconnect", () => {
      const room = roomManager.removePlayer(socket.id);
      if (room) broadcastRoomUpdate(io, room);
    });
  });
}
