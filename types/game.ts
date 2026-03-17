export type SessionStatus = "LOBBY" | "ACTIVE" | "COMPLETED";
export type RoundStatus = "PENDING" | "ACTIVE" | "COMPLETED";

export interface Venue {
  id: string;
  name: string;
  address?: string | null;
  contactEmail?: string | null;
  createdAt: Date;
}

export interface Table {
  id: string;
  venueId: string;
  tableNumber: number;
  isActive: boolean;
}

export interface GameSession {
  id: string;
  venueId: string;
  sessionName: string;
  status: SessionStatus;
  currentRoundId?: string | null;
  startedAt?: Date | null;
  endedAt?: Date | null;
  createdAt: Date;
  rounds?: Round[];
  teams?: Team[];
}

export interface Round {
  id: string;
  gameSessionId: string;
  roundNumber: number;
  theme?: string | null;
  status: RoundStatus;
  startedAt?: Date | null;
  endedAt?: Date | null;
  roundQuestions?: RoundQuestion[];
}

export interface Question {
  id: string;
  venueId: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  category?: string | null;
  points: number;
  createdAt: Date;
}

export interface RoundQuestion {
  id: string;
  roundId: string;
  questionId: string;
  orderIndex: number;
  timeLimit: number;
  question?: Question;
}

export interface Team {
  id: string;
  gameSessionId: string;
  tableId?: string | null;
  teamName: string;
  totalScore: number;
  joinedAt: Date;
}

export interface AnswerSubmission {
  id: string;
  teamId: string;
  roundQuestionId: string;
  submittedAnswer: string;
  isCorrect: boolean;
  pointsAwarded: number;
  submittedAt: Date;
}

export interface TeamScore {
  teamId: string;
  teamName: string;
  totalScore: number;
  tableNumber?: number | null;
  rank: number;
}
