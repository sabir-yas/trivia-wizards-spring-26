"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { type Socket } from "socket.io-client";
import { getSocket } from "@/lib/socket-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@/types/socket-events";

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SocketContext = createContext<AppSocket | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<AppSocket | null>(null);

  useEffect(() => {
    const s = getSocket();
    socketRef.current = s;
    s.connect();
    return () => {
      s.disconnect();
    };
  }, []);

  const socket = getSocket();
  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}

export function useSocket(): AppSocket {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used inside <SocketProvider>");
  return ctx;
}
