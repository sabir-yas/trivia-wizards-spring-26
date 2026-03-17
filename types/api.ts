// ─── Request Bodies ──────────────────────────────────────────────────────────

export interface CreateSessionBody {
  sessionName: string;
}

export interface CreateRoundBody {
  roundNumber: number;
  theme?: string;
}

export interface AssignQuestionBody {
  questionId: string;
  orderIndex: number;
  timeLimit?: number;
}

export interface CreateQuestionBody {
  questionText: string;
  options: string[];
  correctAnswer: string;
  category?: string;
  points?: number;
}

export interface UpdateQuestionBody {
  questionText?: string;
  options?: string[];
  correctAnswer?: string;
  category?: string;
  points?: number;
}

export interface RegisterTeamBody {
  gameSessionId: string;
  teamName: string;
  tableId?: string;
  deviceIdentifier?: string;
}

export interface SubmitAnswerBody {
  roundQuestionId: string;
  submittedAnswer: string;
}

export interface HostLoginBody {
  password: string;
}

export interface RegisterKioskBody {
  deviceIdentifier: string;
  tableId: string;
}

// ─── Response Bodies ─────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  code?: string;
}

export interface ApiSuccess<T = void> {
  data: T;
}
