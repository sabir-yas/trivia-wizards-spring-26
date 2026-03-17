import type { Server as SocketIOServer } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "../types/socket-events";

type IO = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

interface ActiveTimer {
  intervalId: ReturnType<typeof setInterval>;
  secondsRemaining: number;
  roundQuestionId: string;
  sessionId: string;
}

// Singleton map: roundQuestionId → timer state
const activeTimers = new Map<string, ActiveTimer>();

export function startTimer(
  io: IO,
  sessionId: string,
  roundQuestionId: string,
  timeLimit: number
): void {
  // Clear any existing timer for this question
  stopTimer(roundQuestionId);

  let secondsRemaining = timeLimit;

  const intervalId = setInterval(() => {
    secondsRemaining -= 1;

    io.to(`session:${sessionId}`).emit("timer:tick", {
      roundQuestionId,
      secondsRemaining,
    });

    if (secondsRemaining <= 0) {
      stopTimer(roundQuestionId);
      io.to(`session:${sessionId}`).emit("timer:expired", { roundQuestionId });
    }
  }, 1000);

  activeTimers.set(roundQuestionId, {
    intervalId,
    secondsRemaining,
    roundQuestionId,
    sessionId,
  });
}

export function stopTimer(roundQuestionId: string): void {
  const timer = activeTimers.get(roundQuestionId);
  if (timer) {
    clearInterval(timer.intervalId);
    activeTimers.delete(roundQuestionId);
  }
}

export function overrideTimer(
  io: IO,
  sessionId: string,
  roundQuestionId: string,
  secondsRemaining: number
): void {
  const timer = activeTimers.get(roundQuestionId);
  if (!timer) return;

  // Update the remaining time in place; the interval will pick it up next tick
  timer.secondsRemaining = secondsRemaining;

  // Immediately emit the new value so all clients snap to it
  io.to(`session:${sessionId}`).emit("timer:tick", {
    roundQuestionId,
    secondsRemaining,
  });
}

export function isTimerActive(roundQuestionId: string): boolean {
  return activeTimers.has(roundQuestionId);
}

export function getSecondsRemaining(roundQuestionId: string): number {
  return activeTimers.get(roundQuestionId)?.secondsRemaining ?? 0;
}

export function stopAllSessionTimers(sessionId: string): void {
  for (const [rqId, timer] of activeTimers.entries()) {
    if (timer.sessionId === sessionId) {
      stopTimer(rqId);
    }
  }
}
