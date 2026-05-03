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

const optionColors = [
  { bg: "#1a0d2e", border: "#7c3aed", label: "#a78bfa" },  // violet
  { bg: "#0d1a2e", border: "#0e7490", label: "#22d3ee" },  // cyan
  { bg: "#1a2e0d", border: "#15803d", label: "#4ade80" },  // green
  { bg: "#2e0d1a", border: "#be185d", label: "#f472b6" },  // pink
];

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

    function joinSession() {
      socket.emit("kiosk:join-session", { sessionId, teamId, deviceToken: "kiosk" });
    }

    function onQuestionStart(payload: GameQuestionStartPayload) {
      setQuestion(payload);
      setSelectedAnswer(null);
      selectedAnswerRef.current = null;
      setReveal(null);
      setTimer(payload.timeLimit);
      setState("question");
    }

    function onTimerTick({ secondsRemaining }: { secondsRemaining: number }) {
      setTimer(secondsRemaining);
    }

    function onTimerExpired() {
      setTimer(0);
      setState(prev => prev === "question" ? "answered" : prev);
      sound.timerExpired();
    }

    function onAnswerReveal({ correctAnswer }: { correctAnswer: string }) {
      const myAns = selectedAnswerRef.current ?? "";
      setReveal({ correctAnswer, myAnswer: myAns });
      setState("reveal");
      const isCorrect = myAns.toLowerCase() === correctAnswer.toLowerCase();
      if (isCorrect) sound.correctAnswer();
      else sound.wrongAnswer();
    }

    // Register all listeners first, then join — so no events are missed
    // on reconnect regardless of timing on slow connections (e.g. Render)
    socket.on("game:question-start", onQuestionStart);
    socket.on("timer:tick", onTimerTick);
    socket.on("timer:expired", onTimerExpired);
    socket.on("game:answer-reveal", onAnswerReveal);
    socket.on("game:round-ended", () => setState("waiting"));
    socket.on("game:session-ended", () => { setState("waiting"); sound.gameOver(); });
    socket.on("answer:acknowledged", () => { setState("answered"); sound.answerLocked(); });

    // Join immediately if connected, otherwise wait — and re-join on every reconnect
    if (socket.connected) {
      joinSession();
    } else {
      socket.once("connect", joinSession);
    }
    socket.on("connect", joinSession);

    return () => {
      socket.off("connect", joinSession);
      socket.off("game:question-start", onQuestionStart);
      socket.off("timer:tick", onTimerTick);
      socket.off("timer:expired", onTimerExpired);
      socket.off("game:answer-reveal", onAnswerReveal);
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
      <div className="min-h-screen flex items-center justify-center p-8" style={{ background: "var(--bg)" }}>
        <p className="text-xl text-center" style={{ color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}>
          No team ID found. Please register again.
        </p>
      </div>
    );
  }

  // Waiting screen
  if (state === "waiting") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
        style={{ background: "var(--bg)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 50% 50% at 50% 50%, color-mix(in srgb, #ff7afb 6%, transparent), transparent 70%)",
          }}
        />
        <div className="relative text-6xl mb-6">🎩</div>
        <h2
          className="font-display text-3xl font-bold mb-3 relative"
          style={{ color: "var(--on-surface)" }}
        >
          You&apos;re in!
        </h2>
        <p className="text-xl relative" style={{ color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}>
          Waiting for the host to start...
        </p>
        <div className="mt-8 flex gap-2 relative">
          {[0,1,2].map(i => (
            <div key={i} className="bounce-dot" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  // Answered screen
  if (state === "answered") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
        style={{ background: "var(--bg)" }}
      >
        <div className="text-6xl mb-6">✅</div>
        <h2 className="font-display text-3xl font-bold mb-3" style={{ color: "var(--on-surface)" }}>
          Answer locked in!
        </h2>
        {selectedAnswer && (
          <p
            className="text-2xl font-semibold mb-2 px-6 py-3 rounded-2xl"
            style={{
              color: "var(--secondary)",
              background: "color-mix(in srgb, var(--secondary) 10%, transparent)",
              fontFamily: "Manrope, sans-serif",
            }}
          >
            &ldquo;{selectedAnswer}&rdquo;
          </p>
        )}
        <p className="text-lg mt-3" style={{ color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}>
          Waiting for the host to reveal the answer...
        </p>
      </div>
    );
  }

  // Reveal screen
  if (state === "reveal" && reveal) {
    const isCorrect = selectedAnswer?.toLowerCase() === reveal.correctAnswer.toLowerCase();
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
        style={{ background: "var(--bg)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: isCorrect
              ? "radial-gradient(ellipse 60% 50% at 50% 50%, color-mix(in srgb, #00e3fd 8%, transparent), transparent 70%)"
              : "radial-gradient(ellipse 60% 50% at 50% 50%, color-mix(in srgb, #ff6e84 8%, transparent), transparent 70%)",
          }}
        />
        <div className="relative text-7xl mb-6">{isCorrect ? "🎉" : "😬"}</div>
        <h2
          className="font-display text-4xl font-bold mb-4 relative"
          style={{ color: isCorrect ? "var(--secondary)" : "var(--error)" }}
        >
          {isCorrect ? "Correct!" : "Not quite!"}
        </h2>
        <p className="text-xl mb-2 relative" style={{ color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}>
          The answer was:
        </p>
        <p
          className="font-display text-3xl font-bold relative px-6 py-3 rounded-2xl"
          style={{
            color: "var(--tertiary)",
            background: "color-mix(in srgb, var(--tertiary) 10%, transparent)",
          }}
        >
          {reveal.correctAnswer}
        </p>
        {!isCorrect && selectedAnswer && (
          <p className="text-lg mt-4 relative" style={{ color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}>
            You answered: {selectedAnswer}
          </p>
        )}
      </div>
    );
  }

  // Question screen
  return (
    <div
      className="min-h-screen flex flex-col p-6"
      style={{ background: "var(--bg)" }}
    >
      {/* Timer bar */}
      {timer !== null && question && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}>
              Question {question.orderIndex + 1} of {question.totalQuestions}
            </span>
            <span
              className="font-display text-2xl font-bold"
              style={{ color: timer <= 5 ? "var(--error)" : "var(--on-surface)" }}
            >
              {timer}s
            </span>
          </div>
          <div className="mana-bar-track h-3">
            <div
              className={`mana-bar-fill h-3 ${timer <= 5 ? "urgent" : ""}`}
              style={{ width: `${Math.max(0, (timer / question.timeLimit) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Question text */}
      {question && (
        <div className="flex-1 flex flex-col">
          <div
            className="rounded-2xl p-6 mb-6"
            style={{
              background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 15%, var(--surface-container)), var(--surface-container))",
              border: "1px solid color-mix(in srgb, var(--primary) 20%, transparent)",
            }}
          >
            <p
              className="text-2xl font-semibold text-center leading-relaxed"
              style={{ color: "var(--on-surface)", fontFamily: "Manrope, sans-serif" }}
            >
              {question.questionText}
            </p>
          </div>

          {/* Answer buttons */}
          <div className="grid grid-cols-2 gap-4 flex-1">
            {question.options.map((option, i) => {
              const col = optionColors[i % optionColors.length];
              const isSelected = selectedAnswer === option;
              return (
                <button
                  key={i}
                  onClick={() => submitAnswer(option)}
                  disabled={state !== "question" || submitting || timer === 0}
                  className="flex items-center gap-3 p-5 rounded-2xl text-left font-semibold text-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: isSelected
                      ? `color-mix(in srgb, ${col.border} 30%, var(--surface-container))`
                      : col.bg,
                    border: `2px solid ${isSelected ? col.border : "color-mix(in srgb, " + col.border + " 40%, transparent)"}`,
                    boxShadow: isSelected ? `0 0 16px color-mix(in srgb, ${col.border} 40%, transparent)` : "none",
                    fontFamily: "Manrope, sans-serif",
                    color: "var(--on-surface)",
                  }}
                >
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: col.border, color: "white", fontFamily: "Space Grotesk, sans-serif" }}
                  >
                    {optionLabels[i]}
                  </span>
                  <span>{option}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function KioskGamePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
          <div className="flex gap-1.5">
            {[0,1,2].map(i => (
              <div key={i} className="bounce-dot" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      }
    >
      <KioskGame sessionId={sessionId} />
    </Suspense>
  );
}
