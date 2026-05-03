"use client";

import { useState, useEffect, use } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useSocket } from "@/components/shared/SocketProvider";
import { useSound } from "@/hooks/useSound";
import type {
  GameQuestionStartPayload,
  GameAnswerRevealPayload,
  TeamScore,
} from "@/types/socket-events";

type DisplayState = "lobby" | "question" | "reveal" | "leaderboard" | "ended";

const optionConfig = [
  { bg: "color-mix(in srgb, #7c3aed 25%, #0c0c21)", border: "#7c3aed", label: "#a78bfa" },
  { bg: "color-mix(in srgb, #0e7490 25%, #0c0c21)", border: "#0e7490", label: "#22d3ee" },
  { bg: "color-mix(in srgb, #15803d 25%, #0c0c21)", border: "#15803d", label: "#4ade80" },
  { bg: "color-mix(in srgb, #be185d 25%, #0c0c21)", border: "#be185d", label: "#f472b6" },
];

export default function DisplayPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const socket = useSocket();
  const sound = useSound();

  const [displayState, setDisplayState] = useState<DisplayState>("lobby");
  const [question, setQuestion] = useState<GameQuestionStartPayload | null>(null);
  const [reveal, setReveal] = useState<GameAnswerRevealPayload | null>(null);
  const [leaderboard, setLeaderboard] = useState<TeamScore[]>([]);
  const [timer, setTimer] = useState<number | null>(null);
  const [sessionName, setSessionName] = useState<string>("");
  const [kioskUrl, setKioskUrl] = useState<string>("");

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then(r => r.json())
      .then(d => setSessionName(d.data?.sessionName ?? "Trivia Night"))
      .catch(() => {});
    setKioskUrl(`${window.location.origin}/kiosk?session=${sessionId}`);
  }, [sessionId]);

  useEffect(() => {
    function joinSession() {
      socket.emit("display:join-session", { sessionId });
    }

    // Register all listeners before joining so no events are missed
    // on slow connections or reconnects (e.g. Render)
    socket.on("game:state-changed", ({ status }) => {
      if (status === "LOBBY") setDisplayState("lobby");
      if (status === "COMPLETED") setDisplayState("ended");
    });

    socket.on("game:round-started", () => {
      setDisplayState("lobby");
      setQuestion(null);
      setReveal(null);
      sound.roundStart();
    });

    socket.on("game:question-start", (payload) => {
      setQuestion(payload);
      setReveal(null);
      setTimer(payload.timeLimit);
      setDisplayState("question");
      sound.questionStart();
    });

    socket.on("timer:tick", ({ secondsRemaining }) => {
      setTimer(secondsRemaining);
      if (secondsRemaining <= 5 && secondsRemaining > 0) sound.urgentTick();
      else if (secondsRemaining > 5) sound.tick();
    });
    socket.on("timer:expired", () => {
      setTimer(0);
      sound.timerExpired();
    });

    socket.on("game:answer-reveal", (payload) => {
      setReveal(payload);
      setLeaderboard(payload.scores);
      setDisplayState("reveal");
      sound.answerReveal();
    });

    socket.on("game:round-ended", ({ leaderboard }) => {
      setLeaderboard(leaderboard);
      setDisplayState("leaderboard");
      sound.roundEnd();
    });

    socket.on("game:session-ended", ({ finalLeaderboard }) => {
      setLeaderboard(finalLeaderboard);
      setDisplayState("ended");
      sound.gameOver();
    });

    // Join after listeners are registered
    if (socket.connected) {
      joinSession();
    } else {
      socket.once("connect", joinSession);
    }
    socket.on("connect", joinSession);

    return () => {
      socket.off("connect", joinSession);
      socket.off("game:state-changed");
      socket.off("game:round-started");
      socket.off("game:question-start");
      socket.off("timer:tick");
      socket.off("timer:expired");
      socket.off("game:answer-reveal");
      socket.off("game:round-ended");
      socket.off("game:session-ended");
    };
  }, [socket, sessionId]);

  const optionLabels = ["A", "B", "C", "D", "E", "F"];

  // ── Lobby ──
  if (displayState === "lobby") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center text-center p-12 relative"
        style={{ background: "var(--bg)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 45%, color-mix(in srgb, #ff7afb 9%, transparent) 0%, transparent 70%)",
          }}
        />
        <div className="relative text-8xl mb-8">🎩</div>
        <h1
          className="font-display font-bold mb-4 relative"
          style={{
            fontSize: "clamp(3rem, 8vw, 6rem)",
            background: "linear-gradient(135deg, #ff7afb, #00e3fd)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Trivia Wizards
        </h1>
        <p className="relative" style={{ fontSize: "clamp(1.5rem, 4vw, 3rem)", color: "var(--on-surface)", fontFamily: "Manrope, sans-serif" }}>
          {sessionName}
        </p>
        <p className="relative mt-6" style={{ fontSize: "clamp(1rem, 2.5vw, 2rem)", color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}>
          Get ready — game starting soon!
        </p>
        <div className="flex gap-3 mt-10 relative">
          {[0,1,2].map(i => (
            <div
              key={i}
              className="w-4 h-4 rounded-full"
              style={{
                background: "var(--primary)",
                animation: "bounce 1s ease-in-out infinite",
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>

        {/* QR code to join */}
        {kioskUrl && (
          <div
            className="relative mt-12 flex flex-col items-center gap-4 rounded-2xl px-8 py-6"
            style={{
              background: "var(--surface-container)",
              border: "1px solid color-mix(in srgb, #ff7afb 20%, transparent)",
              boxShadow: "0 0 30px -5px color-mix(in srgb, #ff7afb 15%, transparent)",
            }}
          >
            <p className="font-display font-semibold uppercase tracking-widest text-sm" style={{ color: "var(--on-surface-var)" }}>
              Scan to Join
            </p>
            <div className="rounded-xl overflow-hidden p-2" style={{ background: "white" }}>
              <QRCodeSVG value={kioskUrl} size={160} />
            </div>
            <p className="text-xs font-body" style={{ color: "var(--on-surface-var)" }}>
              {kioskUrl}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Active question ──
  if (displayState === "question" && question) {
    const timerPct = Math.max(0, ((timer ?? question.timeLimit) / question.timeLimit) * 100);
    const isUrgent = timer !== null && timer <= 5;
    return (
      <div
        className="min-h-screen flex flex-col p-10"
        style={{ background: "var(--bg)" }}
      >
        {/* Timer bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: "1.5rem", color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}>
              Question {question.orderIndex + 1} / {question.totalQuestions}
            </span>
            <span
              className="font-display font-bold"
              style={{
                fontSize: "clamp(2.5rem, 5vw, 4rem)",
                color: isUrgent ? "var(--error)" : "var(--on-surface)",
                animation: isUrgent ? "pulse-urgent 0.5s ease-in-out infinite alternate" : "none",
              }}
            >
              {timer ?? question.timeLimit}
            </span>
          </div>
          <div className="mana-bar-track h-5">
            <div
              className={`mana-bar-fill h-5 ${isUrgent ? "urgent" : ""}`}
              style={{ width: `${timerPct}%` }}
            />
          </div>
        </div>

        {/* Question card */}
        <div className="flex-1 flex flex-col justify-center">
          <div
            className="rounded-3xl p-10 mb-8 text-center"
            style={{
              background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 12%, var(--surface-container)), var(--surface-container))",
              border: "1px solid color-mix(in srgb, var(--primary) 20%, transparent)",
              boxShadow: "0 0 40px -10px color-mix(in srgb, var(--primary) 20%, transparent)",
            }}
          >
            <p
              className="font-body font-semibold leading-tight"
              style={{ fontSize: "clamp(1.5rem, 4vw, 3rem)", color: "var(--on-surface)" }}
            >
              {question.questionText}
            </p>
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-5">
            {question.options.map((opt, i) => {
              const col = optionConfig[i % optionConfig.length];
              return (
                <div
                  key={i}
                  className="rounded-2xl p-6 flex items-center gap-4"
                  style={{ background: col.bg, border: `2px solid color-mix(in srgb, ${col.border} 50%, transparent)` }}
                >
                  <span
                    className="flex items-center justify-center shrink-0 font-display font-bold"
                    style={{
                      width: "3rem",
                      height: "3rem",
                      borderRadius: "9999px",
                      background: col.border,
                      color: "white",
                      fontSize: "1.25rem",
                    }}
                  >
                    {optionLabels[i]}
                  </span>
                  <span
                    className="font-body font-semibold"
                    style={{ fontSize: "clamp(1rem, 2.5vw, 1.5rem)", color: "var(--on-surface)" }}
                  >
                    {opt}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Reveal ──
  if (displayState === "reveal" && reveal && question) {
    return (
      <div
        className="min-h-screen flex flex-col p-10"
        style={{ background: "var(--bg)" }}
      >
        <div className="mb-8 text-center">
          <p
            className="font-body mb-6"
            style={{ fontSize: "clamp(1rem, 2.5vw, 1.75rem)", color: "var(--on-surface-var)" }}
          >
            {question.questionText}
          </p>
          <div
            className="inline-block rounded-2xl px-10 py-5"
            style={{
              background: "color-mix(in srgb, var(--secondary) 15%, var(--surface-container))",
              border: "2px solid color-mix(in srgb, var(--secondary) 50%, transparent)",
              boxShadow: "0 0 30px color-mix(in srgb, var(--secondary) 20%, transparent)",
            }}
          >
            <p
              className="font-body mb-1"
              style={{ fontSize: "1.25rem", color: "var(--secondary)" }}
            >
              Correct Answer
            </p>
            <p
              className="font-display font-bold"
              style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", color: "var(--on-surface)" }}
            >
              {reveal.correctAnswer}
            </p>
          </div>
        </div>

        {/* Mini leaderboard */}
        <div className="flex-1">
          <h3
            className="font-display font-bold mb-4 text-center uppercase tracking-widest"
            style={{ fontSize: "1.5rem", color: "var(--on-surface-var)" }}
          >
            Scoreboard
          </h3>
          <div className="max-w-2xl mx-auto space-y-3">
            {reveal.scores.slice(0, 8).map((team, i) => (
              <div
                key={team.teamId}
                className="flex items-center justify-between rounded-xl px-6 py-4"
                style={{ background: i % 2 === 0 ? "var(--surface-container)" : "var(--surface-low)" }}
              >
                <div className="flex items-center gap-4">
                  <span
                    className="font-display font-bold w-8 text-center"
                    style={{
                      fontSize: "1.5rem",
                      color: i === 0 ? "var(--tertiary)" : i === 1 ? "var(--on-surface-var)" : i === 2 ? "#fb923c" : "var(--outline)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    className="font-body"
                    style={{ fontSize: "1.25rem", color: "var(--on-surface)" }}
                  >
                    {team.teamName}
                  </span>
                </div>
                <span
                  className="font-display font-bold"
                  style={{ fontSize: "1.5rem", color: "var(--primary)" }}
                >
                  {team.totalScore}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Leaderboard ──
  if (displayState === "leaderboard") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-10"
        style={{ background: "var(--bg)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 60% 50% at 50% 40%, color-mix(in srgb, #ff7afb 7%, transparent), transparent 70%)",
          }}
        />
        <h2
          className="font-display font-bold mb-1 relative"
          style={{ fontSize: "clamp(2.5rem, 6vw, 4rem)", color: "var(--on-surface)" }}
        >
          Leaderboard
        </h2>
        <p
          className="mb-10 relative"
          style={{ fontSize: "1.25rem", color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}
        >
          {sessionName}
        </p>

        <div className="w-full max-w-2xl space-y-3 relative">
          {leaderboard.slice(0, 10).map((team, i) => (
            <div
              key={team.teamId}
              className="flex items-center justify-between rounded-2xl px-8 py-5"
              style={{
                background: i === 0
                  ? "color-mix(in srgb, var(--tertiary) 12%, var(--surface-container))"
                  : i === 1
                  ? "color-mix(in srgb, var(--on-surface-var) 8%, var(--surface-container))"
                  : i === 2
                  ? "color-mix(in srgb, #ff7afb 8%, var(--surface-container))"
                  : "var(--surface-container)",
                border: i === 0
                  ? "1px solid color-mix(in srgb, var(--tertiary) 40%, transparent)"
                  : i === 1
                  ? "1px solid color-mix(in srgb, var(--on-surface-var) 25%, transparent)"
                  : i === 2
                  ? "1px solid color-mix(in srgb, #ff7afb 25%, transparent)"
                  : "1px solid transparent",
                boxShadow: i === 0 ? "0 0 20px color-mix(in srgb, var(--tertiary) 15%, transparent)" : "none",
              }}
            >
              <div className="flex items-center gap-5">
                <span style={{ fontSize: "2.5rem" }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (
                    <span className="font-display font-bold" style={{ fontSize: "1.5rem", color: "var(--on-surface-var)" }}>
                      {i + 1}.
                    </span>
                  )}
                </span>
                <span
                  className="font-display font-bold"
                  style={{ fontSize: "clamp(1.25rem, 3vw, 2rem)", color: "var(--on-surface)" }}
                >
                  {team.teamName}
                </span>
                {team.tableNumber && (
                  <span style={{ fontSize: "1rem", color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}>
                    Table {team.tableNumber}
                  </span>
                )}
              </div>
              <span
                className="font-display font-bold"
                style={{
                  fontSize: "clamp(1.5rem, 3vw, 2.5rem)",
                  color: i === 0 ? "var(--tertiary)" : "var(--primary)",
                }}
              >
                {team.totalScore}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Final podium ──
  if (displayState === "ended") {
    const [first, second, third] = leaderboard;
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-10 text-center relative"
        style={{ background: "var(--bg)" }}
      >
        {/* Ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 40%, color-mix(in srgb, #ffe792 10%, transparent), transparent 70%)",
          }}
        />

        <div className="relative text-7xl mb-4">🏆</div>
        <h2
          className="font-display font-bold mb-2 relative"
          style={{ fontSize: "clamp(2.5rem, 7vw, 5rem)", color: "var(--on-surface)" }}
        >
          Final Results
        </h2>
        <p
          className="mb-14 relative"
          style={{ fontSize: "1.5rem", color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}
        >
          {sessionName}
        </p>

        {/* Podium */}
        <div className="flex items-end justify-center gap-6 mb-12 relative">
          {/* 2nd */}
          {second && (
            <div className="flex flex-col items-center gap-3">
              <span style={{ fontSize: "3rem" }}>🥈</span>
              <div
                className="rounded-t-3xl px-8 py-6 flex flex-col justify-center"
                style={{
                  width: "12rem",
                  height: "10rem",
                  background: "color-mix(in srgb, var(--on-surface-var) 10%, var(--surface-container))",
                  border: "2px solid color-mix(in srgb, var(--on-surface-var) 30%, transparent)",
                }}
              >
                <p className="font-display font-bold leading-tight" style={{ fontSize: "1.25rem", color: "var(--on-surface)" }}>
                  {second.teamName}
                </p>
                {second.tableNumber && (
                  <p className="mt-1" style={{ fontSize: "0.875rem", color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}>
                    Table {second.tableNumber}
                  </p>
                )}
                <p
                  className="font-display font-bold mt-2"
                  style={{ fontSize: "2rem", color: "var(--on-surface)" }}
                >
                  {second.totalScore}
                </p>
                <p style={{ fontSize: "0.75rem", color: "var(--on-surface-var)" }}>pts</p>
              </div>
            </div>
          )}

          {/* 1st */}
          {first && (
            <div className="flex flex-col items-center gap-3">
              <span style={{ fontSize: "4.5rem", animation: "bounce 1s ease-in-out infinite" }}>🥇</span>
              <div
                className="rounded-t-3xl px-10 py-8 flex flex-col justify-center glow-tertiary"
                style={{
                  width: "14rem",
                  height: "13rem",
                  background: "color-mix(in srgb, var(--tertiary) 15%, var(--surface-container))",
                  border: "2px solid color-mix(in srgb, var(--tertiary) 50%, transparent)",
                }}
              >
                <p className="font-display font-bold leading-tight" style={{ fontSize: "1.5rem", color: "var(--on-surface)" }}>
                  {first.teamName}
                </p>
                {first.tableNumber && (
                  <p className="mt-1" style={{ fontSize: "0.875rem", color: "var(--tertiary)", opacity: 0.7, fontFamily: "Manrope, sans-serif" }}>
                    Table {first.tableNumber}
                  </p>
                )}
                <p
                  className="font-display font-bold mt-2"
                  style={{ fontSize: "2.5rem", color: "var(--tertiary)" }}
                >
                  {first.totalScore}
                </p>
                <p style={{ fontSize: "0.875rem", color: "var(--tertiary)", opacity: 0.7 }}>pts</p>
              </div>
            </div>
          )}

          {/* 3rd */}
          {third && (
            <div className="flex flex-col items-center gap-3">
              <span style={{ fontSize: "3rem" }}>🥉</span>
              <div
                className="rounded-t-3xl px-8 py-6 flex flex-col justify-center"
                style={{
                  width: "12rem",
                  height: "8rem",
                  background: "color-mix(in srgb, var(--primary) 8%, var(--surface-container))",
                  border: "2px solid color-mix(in srgb, var(--primary) 25%, transparent)",
                }}
              >
                <p className="font-display font-bold leading-tight" style={{ fontSize: "1.25rem", color: "var(--on-surface)" }}>
                  {third.teamName}
                </p>
                {third.tableNumber && (
                  <p className="mt-1" style={{ fontSize: "0.875rem", color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}>
                    Table {third.tableNumber}
                  </p>
                )}
                <p
                  className="font-display font-bold mt-2"
                  style={{ fontSize: "2rem", color: "var(--primary)" }}
                >
                  {third.totalScore}
                </p>
                <p style={{ fontSize: "0.75rem", color: "var(--on-surface-var)" }}>pts</p>
              </div>
            </div>
          )}
        </div>

        {/* Remaining teams */}
        {leaderboard.length > 3 && (
          <div className="w-full max-w-lg space-y-2 relative">
            {leaderboard.slice(3).map((team, i) => (
              <div
                key={team.teamId}
                className="flex items-center justify-between rounded-2xl px-6 py-3"
                style={{ background: i % 2 === 0 ? "var(--surface-container)" : "var(--surface-low)" }}
              >
                <div className="flex items-center gap-4">
                  <span className="font-display w-8" style={{ fontSize: "1.25rem", color: "var(--on-surface-var)" }}>
                    {i + 4}.
                  </span>
                  <span className="font-body" style={{ fontSize: "1.25rem", color: "var(--on-surface)" }}>
                    {team.teamName}
                  </span>
                </div>
                <span className="font-display font-bold" style={{ fontSize: "1.25rem", color: "var(--primary)" }}>
                  {team.totalScore}
                </span>
              </div>
            ))}
          </div>
        )}

        <p
          className="mt-12 relative"
          style={{ fontSize: "1.25rem", color: "var(--on-surface-var)", opacity: 0.5, fontFamily: "Manrope, sans-serif" }}
        >
          Thanks for playing Trivia Wizards!
        </p>
      </div>
    );
  }

  return null;
}
