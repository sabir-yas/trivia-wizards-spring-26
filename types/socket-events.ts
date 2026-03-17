import type { SessionStatus, RoundStatus, TeamScore } from "./game";

// ─── Server → Client Events ──────────────────────────────────────────────────

export interface GameStateChangedPayload {
  sessionId: string;
  status: SessionStatus;
}

export interface GameRoundStartedPayload {
  sessionId: string;
  roundId: string;
  roundNumber: number;
  theme?: string | null;
  questionCount: number;
}

export interface GameQuestionStartPayload {
  sessionId: string;
  roundQuestionId: string;
  questionText: string;
  options: string[];
  timeLimit: number;
  orderIndex: number;
  totalQuestions: number;
}

export interface TimerTickPayload {
  roundQuestionId: string;
  secondsRemaining: number;
}

export interface TimerExpiredPayload {
  roundQuestionId: string;
}

export interface GameAnswerRevealPayload {
  roundQuestionId: string;
  correctAnswer: string;
  scores: TeamScore[];
}

export interface GameRoundEndedPayload {
  roundId: string;
  leaderboard: TeamScore[];
}

export interface GameSessionEndedPayload {
  sessionId: string;
  finalLeaderboard: TeamScore[];
}

export interface TeamRegisteredPayload {
  teamId: string;
  teamName: string;
  tableId?: string | null;
  tableNumber?: number | null;
}

export interface AnswerAcknowledgedPayload {
  teamId: string;
  roundQuestionId: string;
}

export interface SubmissionRejectedPayload {
  reason: "TIMER_EXPIRED" | "ALREADY_SUBMITTED" | "INVALID_SESSION";
}

// ─── Client → Server Events ──────────────────────────────────────────────────

export interface HostJoinSessionPayload {
  sessionId: string;
  hostToken: string;
}

export interface KioskJoinSessionPayload {
  sessionId: string;
  teamId: string;
  deviceToken: string;
}

export interface DisplayJoinSessionPayload {
  sessionId: string;
}

export interface HostStartRoundPayload {
  sessionId: string;
  roundId: string;
}

export interface HostStartQuestionPayload {
  sessionId: string;
  roundId: string;
  roundQuestionId: string;
}

export interface HostRevealAnswerPayload {
  sessionId: string;
  roundQuestionId: string;
}

export interface HostEndRoundPayload {
  sessionId: string;
  roundId: string;
}

export interface HostEndSessionPayload {
  sessionId: string;
}

export interface KioskSubmitAnswerPayload {
  teamId: string;
  roundQuestionId: string;
  submittedAnswer: string;
}

export interface HostOverrideTimerPayload {
  sessionId: string;
  secondsRemaining: number;
}

// ─── Event Map (for typed socket.on / socket.emit) ───────────────────────────

export interface ServerToClientEvents {
  "game:state-changed": (payload: GameStateChangedPayload) => void;
  "game:round-started": (payload: GameRoundStartedPayload) => void;
  "game:question-start": (payload: GameQuestionStartPayload) => void;
  "timer:tick": (payload: TimerTickPayload) => void;
  "timer:expired": (payload: TimerExpiredPayload) => void;
  "game:answer-reveal": (payload: GameAnswerRevealPayload) => void;
  "game:round-ended": (payload: GameRoundEndedPayload) => void;
  "game:session-ended": (payload: GameSessionEndedPayload) => void;
  "team:registered": (payload: TeamRegisteredPayload) => void;
  "answer:acknowledged": (payload: AnswerAcknowledgedPayload) => void;
  "error:submission-rejected": (payload: SubmissionRejectedPayload) => void;
}

export interface ClientToServerEvents {
  "host:join-session": (payload: HostJoinSessionPayload) => void;
  "kiosk:join-session": (payload: KioskJoinSessionPayload) => void;
  "display:join-session": (payload: DisplayJoinSessionPayload) => void;
  "host:start-round": (payload: HostStartRoundPayload) => void;
  "host:start-question": (payload: HostStartQuestionPayload) => void;
  "host:reveal-answer": (payload: HostRevealAnswerPayload) => void;
  "host:end-round": (payload: HostEndRoundPayload) => void;
  "host:end-session": (payload: HostEndSessionPayload) => void;
  "kiosk:submit-answer": (payload: KioskSubmitAnswerPayload) => void;
  "host:override-timer": (payload: HostOverrideTimerPayload) => void;
}
