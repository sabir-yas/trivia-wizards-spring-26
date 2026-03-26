import { io, type Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@/types/socket-events";

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!socket) {
    // In the browser fall back to the current origin so it works on any
    // deployment (Render, Vercel, localhost) without needing NEXT_PUBLIC_APP_URL
    const url =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");

    socket = io(url, {
      autoConnect: false,
      // Prefer WebSocket over long-polling; Render supports WS and polling
      // can be unreliable on their free tier
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}
