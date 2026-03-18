"use client";

import { useState, useEffect, use, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useSocket } from "@/components/shared/SocketProvider";
import { useSound } from "@/hooks/useSound";
import type { GameQuestionStartPayload } from "@/types/socket-events";
import { Suspense } from "react";

type GameState = "waiting" | "question" | "answered" | "reveal";

interface RevealInfo {
  correctAnswer: string;
  myAnswer: string;
}

function KioskGame({ sessionId }: { sessionId: string }) {
  const socket = useSocket();
  const sound = useSound();
  const searchParams = useSearchParams();
  const teamId = searchParams.get("teamId") ?? "";
  const selectedAnswerRef = useRef<string | null>(null);

  const [state, setState] = useState<GameState>("waiting");
  const [question, setQuestion] = useState<GameQuestionStartPayload | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [timer, setTimer] = useState<number | null>(null);
  const [reveal, setReveal] = useState<RevealInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    socket.emit("kiosk:join-session", { sessionId, teamId, deviceToken: "kiosk" });

    socket.on("game:question-start", (payload) => {
      setQuestion(payload);
      setSelectedAnswer(null);
      selectedAnswerRef.current = null;
      setReveal(null);
      setTimer(payload.timeLimit);
      setState("question");
    });

    socket.on("timer:tick", ({ secondsRemaining }) => setTimer(secondsRemaining));
    socket.on("timer:expired", () => {
      setTimer(0);
      setState(prev => prev === "question" ? "answered" : prev);
      sound.timerExpired();
    });

    socket.on("game:answer-reveal", ({ correctAnswer }) => {
      const myAns = selectedAnswerRef.current ?? "";
      setReveal({ correctAnswer, myAnswer: myAns });
      setState("reveal");
      const isCorrect = myAns.toLowerCase() === correctAnswer.toLowerCase();
      if (isCorrect) sound.correctAnswer();
      else sound.wrongAnswer();
    });

    socket.on("game:round-ended", () => setState("waiting"));
    socket.on("game:session-ended", () => {
      setState("waiting");
      sound.gameOver();
    });
    socket.on("answer:acknowledged", () => {
      setState("answered");
      sound.answerLocked();
    });

    return () => {
      socket.off("game:question-start");
      socket.off("timer:tick");
      socket.off("timer:expired");
      socket.off("game:answer-reveal");
      socket.off("game:round-ended");
      socket.off("game:session-ended");
      socket.off("answer:acknowledged");
    };
  }, [socket, sessionId, teamId]);

  async function submitAnswer(answer: string) {
    if (!question || submitting || state !== "question") return;
    setSelectedAnswer(answer);
    selectedAnswerRef.current = answer;
    setSubmitting(true);
    try {
      await fetch(`/api/teams/${teamId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundQuestionId: question.roundQuestionId, submittedAnswer: answer }),
      });
      setState("answered");
    } finally {
      setSubmitting(false);
    }
  }

  const optionLabels = ["A", "B", "C", "D", "E", "F"];

  if (!teamId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-xl text-center px-8">No team ID found. Please register again.</p>
      </div>
    );
  }

  // Waiting screen
  if (state === "waiting") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
        <div className="text-6xl mb-6">🎩</div>
        <h2 className="text-3xl font-bold text-white mb-3">You&apos;re in!</h2>
        <p className="text-gray-400 text-xl">Waiting for the host to start...</p>
        <div className="mt-8 flex gap-1">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  // Answered / timer expired (waiting for reveal)
  if (state === "answered") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
        <div className="text-6xl mb-6">✅</div>
        <h2 className="text-3xl font-bold text-white mb-3">Answer locked in!</h2>
        {selectedAnswer && <p className="text-purple-300 text-2xl font-semibold mb-2">&ldquo;{selectedAnswer}&rdquo;</p>}
        <p className="text-gray-400 text-lg">Waiting for the host to reveal the answer...</p>
      </div>
    );
  }

  // Reveal screen
  if (state === "reveal" && reveal) {
    const isCorrect = selectedAnswer?.toLowerCase() === reveal.correctAnswer.toLowerCase();
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
        <div className="text-7xl mb-6">{isCorrect ? "🎉" : "😬"}</div>
        <h2 className={`text-4xl font-bold mb-4 ${isCorrect ? "text-green-400" : "text-red-400"}`}>
          {isCorrect ? "Correct!" : "Not quite!"}
        </h2>
        <p className="text-gray-300 text-xl mb-2">The answer was:</p>
        <p className="text-white text-3xl font-bold">{reveal.correctAnswer}</p>
        {!isCorrect && selectedAnswer && (
          <p className="text-gray-500 text-lg mt-3">You answered: {selectedAnswer}</p>
        )}
      </div>
    );
  }

  // Question screen
  return (
    <div className="min-h-screen flex flex-col p-6">
      {/* Timer bar */}
      {timer !== null && question && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Question {question.orderIndex + 1} of {question.totalQuestions}</span>
            <span className={`text-2xl font-bold ${timer <= 5 ? "text-red-400" : "text-white"}`}>{timer}s</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-1000 ${timer <= 5 ? "bg-red-500" : "bg-purple-500"}`}
              style={{ width: `${Math.max(0, (timer / (question.timeLimit)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Question text */}
      {question && (
        <div className="flex-1 flex flex-col">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
            <p className="text-white text-2xl font-semibold text-center leading-relaxed">
              {question.questionText}
            </p>
          </div>

          {/* Answer buttons */}
          <div className="grid grid-cols-2 gap-4 flex-1">
            {question.options.map((option, i) => (
              <button
                key={i}
                onClick={() => submitAnswer(option)}
                disabled={state !== "question" || submitting || timer === 0}
                className={`
                  flex items-center gap-3 p-5 rounded-2xl text-left font-semibold text-lg transition-all active:scale-95
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${selectedAnswer === option
                    ? "bg-purple-600 border-2 border-purple-400 text-white"
                    : "bg-gray-900 border-2 border-gray-700 hover:border-purple-600 hover:bg-gray-800 text-white"
                  }
                `}
              >
                <span className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold shrink-0">
                  {optionLabels[i]}
                </span>
                <span>{option}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function KioskGamePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>}>
      <KioskGame sessionId={sessionId} />
    </Suspense>
  );
}
