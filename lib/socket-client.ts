import { io, type Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@/types/socket-events";

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!socket) {
    // In the browser fall back to the current origin so it works on any
    // deployment (Render, Vercel, localhost) without needing NEXT_PUBLIC_APP_URL
    const url = (
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== "undefined" ? window.location.origin : "")
    ).replace(/\/$/, "");

    socket = io(url, {
      autoConnect: false,
      // Skip the polling handshake and connect directly via WebSocket.
      // Polling adds 1-3s of latency on mobile — especially noticeable for
      // timer ticks and question delivery.
      transports: ["websocket"],
      // Reconnect aggressively for mobile network switches
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
    });
  }
  return socket;
}
