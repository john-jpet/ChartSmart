import { env } from "./config/env";
import express, { ErrorRequestHandler } from "express";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { tracksRouter } from "./routes/tracks";
import { artistsRouter } from "./routes/artists";
import { albumsRouter } from "./routes/albums";
import { gameRouter } from "./routes/game";
import { registerSocketHandlers } from "./socket";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/tracks", tracksRouter);
app.use("/api/artists", artistsRouter);
app.use("/api/albums", albumsRouter);
app.use("/api/game", gameRouter);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: "*" },
});
registerSocketHandlers(io);

httpServer.listen(env.port, () => {
  console.log(`ChartSmart server listening on http://localhost:${env.port}`);
});
