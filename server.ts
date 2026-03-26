import "dotenv/config";
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "./types/socket-events";
import { registerSocketHandlers } from "./lib/socket-server";

const dev = process.env.NODE_ENV !== "production";
const hostname = dev ? "localhost" : "0.0.0.0";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(
    httpServer,
    {
      cors: {
        // In production allow the configured URL or all origins as fallback.
        // Since the server and client are on the same Render service, same-origin
        // requests don't need CORS, but this keeps it safe for future setups.
        origin: dev ? "*" : (process.env.NEXT_PUBLIC_APP_URL ?? "*"),
        methods: ["GET", "POST"],
      },
      transports: ["websocket"],
    }
  );

  // Attach io to global so API routes can access it
  (global as Record<string, unknown>).io = io;

  registerSocketHandlers(io);

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
