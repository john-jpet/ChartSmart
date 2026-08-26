import { Server, Socket } from "socket.io";
import { roomManager, Room } from "../game/roomManager";
import { selectRound } from "../game/nameThatTune";
import { isCategory, Category } from "../data/seedTracks";
import { selectMovieRound } from "../game/nameThatMovie";

const ROUND_ANSWER_WINDOW_MS = 10000;
const ROUND_RESULT_DISPLAY_MS = 4000;
const DEFAULT_TOTAL_ROUNDS = 5;
const MIN_TOTAL_ROUNDS = 5;
const MAX_TOTAL_ROUNDS = 20;
const MAX_ANSWER_SCORE = 1000;
const MIN_ANSWER_SCORE = 100;

function broadcastRoomUpdate(io: Server, room: Room) {
  const players = visiblePlayers(room);
  io.to(room.code).emit("room:updated", { roomCode: room.code, players });
}

function visiblePlayers(room: Room) {
  return roomManager.playersList(room).filter(
    (player) => room.settings.playbackMode === "remote" || !player.isHost
  );
}

function currentScores(room: Room): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const player of room.players.values()) {
    if (room.settings.playbackMode === "party" && player.isHost) continue;
    scores[player.id] = player.score;
  }
  return scores;
}

function currentStreaks(room: Room): Record<string, number> {
  const streaks: Record<string, number> = {};
  for (const player of visiblePlayers(room)) streaks[player.id] = player.streak;
  return streaks;
}

async function startRound(io: Server, room: Room) {
  // Lock immediately, before the asynchronous catalog lookup, so repeated
  // start clicks cannot launch overlapping rounds.
  room.state = "ROUND_START";
  let roundData;
  try {
    roundData = room.settings.gameType === "movie"
      ? await selectMovieRound(room.usedTrackIds, room.settings.category)
      : await selectRound(room.usedTrackIds, room.settings.category);
  } catch (error) {
    const message = room.settings.gameType === "movie" && error instanceof Error && error.message.includes("TMDB")
      ? error.message
      : "The next round could not be loaded.";
    io.to(room.code).emit("room:cancelled", { error: message });
    room.state = "END_GAME";
    roomManager.deleteRoom(room.code);
    return;
  }
  if (roomManager.getRoom(room.code) !== room || room.state !== "ROUND_START") return;
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
      imageUrl: "imageUrl" in roundData ? roundData.imageUrl : undefined,
      artworkUrl: "artworkUrl" in roundData ? roundData.artworkUrl : undefined,
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

  for (const player of visiblePlayers(room)) {
    const answer = room.answers.get(player.id);
    if (answer?.optionIndex === room.currentCorrectIndex) {
      const speedBonus = Math.max(0, ROUND_ANSWER_WINDOW_MS - answer.answeredAtMs);
      const points = MIN_ANSWER_SCORE + Math.round((speedBonus / ROUND_ANSWER_WINDOW_MS) * (MAX_ANSWER_SCORE - MIN_ANSWER_SCORE));
      player.score += points;
      player.streak += 1;
    } else player.streak = 0;
  }

  io.to(room.code).emit("game:round_end", {
    correctAnswerIndex: room.currentCorrectIndex,
    scores: currentScores(room),
    streaks: currentStreaks(room),
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
  io.to(room.code).emit("game:end_game", {
    scores: currentScores(room),
    players: visiblePlayers(room),
  });
}

function leaveCurrentRoom(io: Server, socket: Socket) {
  const room = roomManager.getRoomForPlayer(socket.id);
  if (!room) return;

  if (room.hostId === socket.id) {
    room.state = "END_GAME";
    if (room.players.size > 1) {
      io.to(room.code).emit("room:cancelled", { error: "The host left, so the room was cancelled." });
    }
    roomManager.deleteRoom(room.code);
    io.in(room.code).socketsLeave(room.code);
    return;
  }

  roomManager.removePlayer(socket.id);
  socket.leave(room.code);
  broadcastRoomUpdate(io, room);
}

export function registerSocketHandlers(io: Server) {
  io.on("connection", (socket: Socket) => {
    socket.on(
      "room:create",
      ({ hostName, settings }: { hostName: string; settings?: { totalRounds?: number; category?: string; playbackMode?: string; gameType?: string } }) => {
        const category: Category =
          settings?.category && isCategory(settings.category) ? settings.category : "general";
        const requestedRounds = Number(settings?.totalRounds) || DEFAULT_TOTAL_ROUNDS;
        const room = roomManager.createRoom(socket.id, hostName || "Host", {
          totalRounds: Math.max(MIN_TOTAL_ROUNDS, Math.min(requestedRounds, MAX_TOTAL_ROUNDS)),
          category,
          playbackMode: settings?.playbackMode === "remote" ? "remote" : "party",
          gameType: settings?.gameType === "movie" ? "movie" : "tune",
        });
        socket.join(room.code);
        socket.emit("room:created", { roomCode: room.code });
        broadcastRoomUpdate(io, room);
      }
    );

    socket.on("room:join", ({ roomCode, playerName, gameType }: { roomCode: string; playerName: string; gameType?: string }) => {
      const normalizedCode = String(roomCode || "").trim().toUpperCase();
      if (!/^[A-Z2-9]{5}$/.test(normalizedCode)) {
        socket.emit("room:error", { code: "INVALID_CODE", error: "Enter a valid 5-character room code." });
        return;
      }
      const room = roomManager.joinRoom(normalizedCode, socket.id, String(playerName || "Player").trim().slice(0, 24));
      if (!room) {
        socket.emit("room:error", { code: "ROOM_NOT_FOUND", error: "Room not found, or the game has already started." });
        return;
      }
      if (gameType && room.settings.gameType !== gameType) {
        roomManager.removePlayer(socket.id);
        socket.emit("room:error", { code: "ROOM_NOT_FOUND", error: `That code belongs to a different game.` });
        return;
      }
      socket.join(room.code);
      socket.emit("room:joined", { roomCode: room.code });
      broadcastRoomUpdate(io, room);
    });

    socket.on("room:start", ({ roomCode }: { roomCode: string }) => {
      const room = roomManager.getRoom(roomCode);
      if (!room || room.hostId !== socket.id || room.state !== "LOBBY") return;
      const contestants = roomManager.playersList(room).filter((player) => room.settings.playbackMode === "remote" || !player.isHost);
      if (contestants.length === 0) {
        socket.emit("room:error", { code: "NO_PLAYERS", error: "Wait for at least one player to join." });
        return;
      }
      void startRound(io, room);
    });

    socket.on(
      "game:submit_answer",
      ({ roomCode, optionIndex }: { roomCode: string; optionIndex: number; clientTimeMs?: number }) => {
        const room = roomManager.getRoom(roomCode);
        if (!room || room.state !== "PLAYING" || room.roundStartedAt === null) return;
        if (room.settings.playbackMode === "party" && room.hostId === socket.id) return;
        if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 3) return;
        if (room.answers.has(socket.id)) return;
        room.answers.set(socket.id, { optionIndex, answeredAtMs: Date.now() - room.roundStartedAt });
      }
    );

    socket.on("room:leave", () => leaveCurrentRoom(io, socket));
    socket.on("disconnect", () => leaveCurrentRoom(io, socket));
  });
}
