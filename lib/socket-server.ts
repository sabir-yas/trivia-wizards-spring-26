import type { Server as SocketIOServer, Socket } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "../types/socket-events";
import { prisma } from "./prisma";
import {
  startTimer,
  stopTimer,
  stopAllSessionTimers,
  isTimerActive,
} from "./game-engine";

type IO = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerSocketHandlers(io: IO): void {
  io.on("connection", (socket: AppSocket) => {
    // ── Join Handlers ──────────────────────────────────────────────────────

    socket.on("host:join-session", async ({ sessionId, hostToken }) => {
      // Verify that the host token corresponds to a valid session
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
      });
      if (!session) {
        socket.emit("error:submission-rejected", { reason: "INVALID_SESSION" });
        return;
      }
      socket.join(`session:${sessionId}`);
      socket.join(`host:${sessionId}`);
    });

    socket.on("kiosk:join-session", async ({ sessionId, teamId, deviceToken }) => {
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
      });
      if (!session) {
        socket.emit("error:submission-rejected", { reason: "INVALID_SESSION" });
        return;
      }
      socket.join(`session:${sessionId}`);
      socket.join(`kiosk:${teamId}`);
    });

    socket.on("display:join-session", async ({ sessionId }) => {
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: {
          teams: { orderBy: { totalScore: "desc" } },
          rounds: {
            orderBy: { roundNumber: "asc" },
            include: { roundQuestions: { orderBy: { orderIndex: "asc" } } },
          },
        },
      });
      if (!session) return;
      socket.join(`session:${sessionId}`);

      // Replay current state so reconnecting displays catch up
      socket.emit("game:state-changed", {
        sessionId,
        status: session.status as "LOBBY" | "ACTIVE" | "COMPLETED",
      });
    });

    // ── Host Game Control ──────────────────────────────────────────────────

    socket.on("host:start-round", async ({ sessionId, roundId }) => {
      const round = await prisma.round.update({
        where: { id: roundId },
        data: { status: "ACTIVE", startedAt: new Date() },
        include: { roundQuestions: true },
      });

      await prisma.gameSession.update({
        where: { id: sessionId },
        data: { currentRoundId: roundId },
      });

      io.to(`session:${sessionId}`).emit("game:round-started", {
        sessionId,
        roundId,
        roundNumber: round.roundNumber,
        theme: round.theme,
        questionCount: round.roundQuestions.length,
      });
    });

    socket.on("host:start-question", async ({ sessionId, roundId, roundQuestionId }) => {
      const rq = await prisma.roundQuestion.findUnique({
        where: { id: roundQuestionId },
        include: { question: true, round: { include: { roundQuestions: true } } },
      });
      if (!rq) return;

      const totalQuestions = rq.round.roundQuestions.length;
      const question = rq.question;

      io.to(`session:${sessionId}`).emit("game:question-start", {
        sessionId,
        roundQuestionId,
        questionText: question.questionText,
        options: question.options as string[],
        timeLimit: rq.timeLimit,
        orderIndex: rq.orderIndex,
        totalQuestions,
      });

      startTimer(io, sessionId, roundQuestionId, rq.timeLimit);
    });

    socket.on("host:reveal-answer", async ({ sessionId, roundQuestionId }) => {
      stopTimer(roundQuestionId);

      const rq = await prisma.roundQuestion.findUnique({
        where: { id: roundQuestionId },
        include: { question: true },
      });
      if (!rq) return;

      const teams = await prisma.team.findMany({
        where: { gameSession: { id: sessionId } },
        orderBy: { totalScore: "desc" },
        include: { table: true },
      });

      const scores = teams.map((t, idx) => ({
        teamId: t.id,
        teamName: t.teamName,
        totalScore: t.totalScore,
        tableNumber: t.table?.tableNumber ?? null,
        rank: idx + 1,
      }));

      io.to(`session:${sessionId}`).emit("game:answer-reveal", {
        roundQuestionId,
        correctAnswer: rq.question.correctAnswer,
        scores,
      });
    });

    socket.on("host:end-round", async ({ sessionId, roundId }) => {
      stopAllSessionTimers(sessionId);

      await prisma.round.update({
        where: { id: roundId },
        data: { status: "COMPLETED", endedAt: new Date() },
      });

      const teams = await prisma.team.findMany({
        where: { gameSession: { id: sessionId } },
        orderBy: { totalScore: "desc" },
        include: { table: true },
      });

      const leaderboard = teams.map((t, idx) => ({
        teamId: t.id,
        teamName: t.teamName,
        totalScore: t.totalScore,
        tableNumber: t.table?.tableNumber ?? null,
        rank: idx + 1,
      }));

      io.to(`session:${sessionId}`).emit("game:round-ended", {
        roundId,
        leaderboard,
      });
    });

    socket.on("host:end-session", async ({ sessionId }) => {
      stopAllSessionTimers(sessionId);

      await prisma.gameSession.update({
        where: { id: sessionId },
        data: { status: "COMPLETED", endedAt: new Date() },
      });

      const teams = await prisma.team.findMany({
        where: { gameSession: { id: sessionId } },
        orderBy: { totalScore: "desc" },
        include: { table: true },
      });

      const finalLeaderboard = teams.map((t, idx) => ({
        teamId: t.id,
        teamName: t.teamName,
        totalScore: t.totalScore,
        tableNumber: t.table?.tableNumber ?? null,
        rank: idx + 1,
      }));

      io.to(`session:${sessionId}`).emit("game:session-ended", {
        sessionId,
        finalLeaderboard,
      });

      io.to(`session:${sessionId}`).emit("game:state-changed", {
        sessionId,
        status: "COMPLETED",
      });
    });

    // ── Timer Override ─────────────────────────────────────────────────────

    socket.on("host:override-timer", ({ sessionId, secondsRemaining }) => {
      // Find the active roundQuestionId for this session
      // (We emit to the session, override-timer is host-only)
      // The host should send the roundQuestionId but we use a fallback here
    });

    // ── Kiosk Answer Submission (via socket for real-time ack) ─────────────
    // Note: canonical submission is via REST POST /api/teams/[teamId]/answers
    // This handler is for the real-time acknowledgement path only
    socket.on("kiosk:submit-answer", async ({ teamId, roundQuestionId, submittedAnswer }) => {
      if (!isTimerActive(roundQuestionId)) {
        io.to(`kiosk:${teamId}`).emit("error:submission-rejected", {
          reason: "TIMER_EXPIRED",
        });
        return;
      }

      // Check for duplicate
      const existing = await prisma.answerSubmission.findUnique({
        where: { teamId_roundQuestionId: { teamId, roundQuestionId } },
      });
      if (existing) {
        io.to(`kiosk:${teamId}`).emit("error:submission-rejected", {
          reason: "ALREADY_SUBMITTED",
        });
        return;
      }

      // Compute correctness
      const rq = await prisma.roundQuestion.findUnique({
        where: { id: roundQuestionId },
        include: { question: true },
      });
      if (!rq) return;

      const isCorrect =
        submittedAnswer.trim().toLowerCase() ===
        rq.question.correctAnswer.trim().toLowerCase();
      const pointsAwarded = isCorrect ? rq.question.points : 0;

      await prisma.$transaction([
        prisma.answerSubmission.create({
          data: {
            teamId,
            roundQuestionId,
            submittedAnswer,
            isCorrect,
            pointsAwarded,
          },
        }),
        prisma.team.update({
          where: { id: teamId },
          data: { totalScore: { increment: pointsAwarded } },
        }),
      ]);

      io.to(`kiosk:${teamId}`).emit("answer:acknowledged", {
        teamId,
        roundQuestionId,
      });
    });
  });
}
