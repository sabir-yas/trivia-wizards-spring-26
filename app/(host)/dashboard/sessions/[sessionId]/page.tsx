"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSocket } from "@/components/shared/SocketProvider";
import { useSound } from "@/hooks/useSound";

interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  category: string | null;
  points: number;
}

interface RoundQuestion {
  id: string;
  orderIndex: number;
  timeLimit: number;
  question: Question;
}

interface Round {
  id: string;
  roundNumber: number;
  theme: string | null;
  defaultTimeLimit: number;
  status: "PENDING" | "ACTIVE" | "COMPLETED";
  roundQuestions: RoundQuestion[];
}

interface Team {
  id: string;
  teamName: string;
  totalScore: number;
  tableId: string | null;
}

interface Session {
  id: string;
  sessionName: string;
  status: "LOBBY" | "ACTIVE" | "COMPLETED";
  currentRoundId: string | null;
  rounds: Round[];
  teams: Team[];
}

interface AllQuestion {
  id: string;
  questionText: string;
  category: string | null;
  points: number;
}

export default function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const socket = useSocket();
  const sound = useSound();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRound, setActiveRound] = useState<Round | null>(null);
  const [activeRQId, setActiveRQId] = useState<string | null>(null);
  const [questionRevealed, setQuestionRevealed] = useState(false);
  const [timer, setTimer] = useState<number | null>(null);

  const [allQuestions, setAllQuestions] = useState<AllQuestion[]>([]);
  const [showAddRound, setShowAddRound] = useState(false);
  const [newRoundTheme, setNewRoundTheme] = useState("");
  const [newRoundTimeLimit, setNewRoundTimeLimit] = useState(30);
  const [showAssignQ, setShowAssignQ] = useState(false);
  const [assignCategoryFilter, setAssignCategoryFilter] = useState("");

  async function loadSession() {
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (res.ok) {
      const data = await res.json();
      setSession(data.data);
      const active = data.data.rounds.find((r: Round) => r.status === "ACTIVE");
      if (active) setActiveRound(active);
    }
    setLoading(false);
  }

  async function loadQuestions() {
    const res = await fetch("/api/questions");
    if (res.ok) setAllQuestions((await res.json()).data);
  }

  useEffect(() => {
    loadSession();
    loadQuestions();
  }, [sessionId]);

  useEffect(() => {
    if (!session) return;
    socket.emit("host:join-session", { sessionId, hostToken: "host" });
  }, [!!session, socket, sessionId]);

  useEffect(() => {
    socket.on("timer:tick", ({ secondsRemaining }) => {
      setTimer(secondsRemaining);
      if (secondsRemaining <= 5 && secondsRemaining > 0) sound.urgentTick();
    });
    socket.on("timer:expired", () => {
      setTimer(0);
      sound.timerExpired();
    });
    socket.on("team:registered", () => {
      loadSession();
      sound.teamJoined();
    });
    socket.on("game:answer-reveal", ({ scores }) => {
      setSession(prev => {
        if (!prev) return prev;
        const updated = prev.teams.map(t => {
          const s = scores.find(s => s.teamId === t.id);
          return s ? { ...t, totalScore: s.totalScore } : t;
        });
        return { ...prev, teams: updated };
      });
    });
    socket.on("game:round-ended", ({ leaderboard }) => {
      setSession(prev => {
        if (!prev) return prev;
        const updated = prev.teams.map(t => {
          const s = leaderboard.find(s => s.teamId === t.id);
          return s ? { ...t, totalScore: s.totalScore } : t;
        });
        return { ...prev, teams: updated };
      });
    });

    return () => {
      socket.off("timer:tick");
      socket.off("timer:expired");
      socket.off("team:registered");
      socket.off("game:answer-reveal");
      socket.off("game:round-ended");
    };
  }, [socket]);

  async function startSession() {
    await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ACTIVE" }),
    });
    loadSession();
  }

  async function endSession() {
    if (!confirm("End the game? This cannot be undone.")) return;
    socket.emit("host:end-session", { sessionId });
    await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    loadSession();
  }

  async function addRound() {
    if (!session) return;
    const nextNum = (session.rounds.length ?? 0) + 1;
    const res = await fetch(`/api/sessions/${sessionId}/rounds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roundNumber: nextNum,
        theme: newRoundTheme || undefined,
        defaultTimeLimit: newRoundTimeLimit,
      }),
    });
    if (res.ok) { setShowAddRound(false); setNewRoundTheme(""); setNewRoundTimeLimit(30); loadSession(); }
  }

  async function startRound(round: Round) {
    socket.emit("host:start-round", { sessionId, roundId: round.id });
    await fetch(`/api/sessions/${sessionId}/rounds/${round.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ACTIVE" }),
    });
    setActiveRound(round);
    setActiveRQId(null);
    setQuestionRevealed(false);
    setTimer(null);
    loadSession();
  }

  async function startQuestion(rq: RoundQuestion) {
    if (!activeRound) return;
    socket.emit("host:start-question", { sessionId, roundId: activeRound.id, roundQuestionId: rq.id });
    setActiveRQId(rq.id);
    setQuestionRevealed(false);
    setTimer(rq.timeLimit);
  }

  async function revealAnswer() {
    if (!activeRQId) return;
    socket.emit("host:reveal-answer", { sessionId, roundQuestionId: activeRQId });
    setQuestionRevealed(true);
    setTimer(null);
  }

  async function endRound() {
    if (!activeRound) return;
    socket.emit("host:end-round", { sessionId, roundId: activeRound.id });
    await fetch(`/api/sessions/${sessionId}/rounds/${activeRound.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    setActiveRound(null);
    setActiveRQId(null);
    setTimer(null);
    loadSession();
  }

  async function assignQuestion(questionId: string) {
    if (!activeRound) return;
    const orderIndex = activeRound.roundQuestions.length;
    await fetch(`/api/sessions/${sessionId}/rounds/${activeRound.id}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, orderIndex }),
    });
    loadSession();
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="flex gap-1.5">
        {[0,1,2].map(i => (
          <div key={i} className="bounce-dot" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
  if (!session) return <div className="text-center py-16" style={{ color: "var(--error)" }}>Session not found.</div>;

  const currentRQ = activeRound?.roundQuestions.find(rq => rq.id === activeRQId) ?? null;
  const sorted = [...session.teams].sort((a, b) => b.totalScore - a.totalScore);
  const [first, second, third] = sorted;

  // ── COMPLETED view ──
  if (session.status === "COMPLETED") {
    return (
      <div className="max-w-2xl mx-auto py-12 space-y-8">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="btn-tertiary text-sm px-2 py-1">← Back</Link>
          <h2 className="font-display text-2xl font-bold" style={{ color: "var(--on-surface)" }}>
            {session.sessionName}
          </h2>
          <span className="badge badge-completed">COMPLETED</span>
        </div>

        <div className="text-center">
          <div className="text-5xl mb-3">🏆</div>
          <h3 className="font-display text-3xl font-bold" style={{ color: "var(--tertiary)" }}>
            Final Results
          </h3>
          <p className="text-sm mt-1" style={{ color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}>
            {session.teams.length} teams competed
          </p>
        </div>

        {sorted.length > 0 && (
          <div className="flex items-end justify-center gap-4">
            {second && (
              <div className="flex flex-col items-center gap-2">
                <span className="text-3xl">🥈</span>
                <div
                  className="rounded-t-2xl px-6 py-4 text-center w-36 h-28 flex flex-col justify-center glow-secondary"
                  style={{
                    background: "color-mix(in srgb, var(--on-surface-var) 10%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--on-surface-var) 25%, transparent)",
                  }}
                >
                  <p className="font-semibold text-sm leading-tight" style={{ color: "var(--on-surface)" }}>{second.teamName}</p>
                  <p className="font-display text-xl font-bold mt-1" style={{ color: "var(--on-surface)" }}>{second.totalScore}</p>
                  <p className="text-xs" style={{ color: "var(--on-surface-var)" }}>pts</p>
                </div>
              </div>
            )}
            {first && (
              <div className="flex flex-col items-center gap-2">
                <span className="text-4xl">🥇</span>
                <div
                  className="rounded-t-2xl px-6 py-4 text-center w-40 h-36 flex flex-col justify-center glow-tertiary"
                  style={{
                    background: "color-mix(in srgb, var(--tertiary) 12%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--tertiary) 35%, transparent)",
                  }}
                >
                  <p className="font-semibold leading-tight" style={{ color: "var(--on-surface)" }}>{first.teamName}</p>
                  <p className="font-display text-2xl font-bold mt-1" style={{ color: "var(--tertiary)" }}>{first.totalScore}</p>
                  <p className="text-xs" style={{ color: "var(--tertiary)", opacity: 0.7 }}>pts</p>
                </div>
              </div>
            )}
            {third && (
              <div className="flex flex-col items-center gap-2">
                <span className="text-3xl">🥉</span>
                <div
                  className="rounded-t-2xl px-6 py-4 text-center w-36 h-20 flex flex-col justify-center"
                  style={{
                    background: "color-mix(in srgb, #ff7afb 8%, transparent)",
                    border: "1px solid color-mix(in srgb, #ff7afb 20%, transparent)",
                  }}
                >
                  <p className="font-semibold text-sm leading-tight" style={{ color: "var(--on-surface)" }}>{third.teamName}</p>
                  <p className="font-display text-xl font-bold mt-1" style={{ color: "var(--primary)" }}>{third.totalScore}</p>
                  <p className="text-xs" style={{ color: "var(--on-surface-var)" }}>pts</p>
                </div>
              </div>
            )}
          </div>
        )}

        {sorted.length > 3 && (
          <div className="space-y-2">
            <h4 className="font-display text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--on-surface-var)" }}>
              All Teams
            </h4>
            {sorted.map((t, i) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-xl px-5 py-3"
                style={{ background: i % 2 === 0 ? "var(--surface-container)" : "var(--surface-low)" }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm w-6" style={{ color: "var(--on-surface-var)" }}>{i + 1}.</span>
                  <span className="text-sm" style={{ color: "var(--on-surface)", fontFamily: "Manrope, sans-serif" }}>{t.teamName}</span>
                </div>
                <span className="font-display font-bold text-sm" style={{ color: "var(--primary)" }}>{t.totalScore} pts</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── ACTIVE / LOBBY view ──
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="btn-tertiary text-sm px-2 py-1">← Back</Link>
          <h2 className="font-display text-2xl font-bold" style={{ color: "var(--on-surface)" }}>
            {session.sessionName}
          </h2>
          <span className={`badge badge-${session.status.toLowerCase()}`}>{session.status}</span>
        </div>
        <div className="flex gap-2">
          <a
            href={`/display/${sessionId}`}
            target="_blank"
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            Open Display ↗
          </a>
          <a
            href={`/kiosk?session=${sessionId}`}
            target="_blank"
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            Open Kiosk ↗
          </a>
          {session.status === "LOBBY" && (
            <button
              onClick={startSession}
              className="btn-primary px-3 py-1.5 text-sm"
              style={{ background: "linear-gradient(135deg, #00e3fd, #00b4c8)", color: "#004d57" }}
            >
              Start Game
            </button>
          )}
          {session.status === "ACTIVE" && (
            <button
              onClick={endSession}
              className="px-3 py-1.5 text-sm font-semibold rounded-xl transition-colors"
              style={{ background: "color-mix(in srgb, var(--error) 20%, transparent)", color: "var(--error)", border: "1px solid color-mix(in srgb, var(--error) 30%, transparent)", fontFamily: "Space Grotesk, sans-serif" }}
            >
              End Game
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Rounds */}
        <div className="col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-sm uppercase tracking-widest" style={{ color: "var(--on-surface-var)" }}>
              Rounds
            </h3>
            <button
              onClick={() => setShowAddRound(!showAddRound)}
              className="btn-primary px-3 py-1.5 text-xs"
            >
              + Add Round
            </button>
          </div>

          {showAddRound && (
            <div className="flex gap-2 items-center">
              <input
                value={newRoundTheme}
                onChange={e => setNewRoundTheme(e.target.value)}
                placeholder="Round theme (optional)"
                className="neon-input flex-1 px-3 py-2 text-sm"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <label className="text-xs whitespace-nowrap" style={{ color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}>
                  Default timer
                </label>
                <input
                  type="number"
                  value={newRoundTimeLimit}
                  onChange={e => setNewRoundTimeLimit(Math.max(5, Math.min(300, parseInt(e.target.value) || 30)))}
                  className="neon-input w-16 px-2 py-2 text-sm text-center"
                  min={5}
                  max={300}
                />
                <span className="text-xs" style={{ color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}>s</span>
              </div>
              <button onClick={addRound} className="btn-primary px-3 py-2 text-sm">Add</button>
              <button onClick={() => setShowAddRound(false)} className="btn-tertiary px-3 py-2 text-sm">Cancel</button>
            </div>
          )}

          {session.rounds.length === 0 ? (
            <div className="text-center py-10 text-sm" style={{ color: "var(--on-surface-var)" }}>
              No rounds yet
            </div>
          ) : (
            session.rounds.map(round => (
              <div
                key={round.id}
                className="rounded-xl p-4"
                style={{
                  background: "var(--surface-container)",
                  border: activeRound?.id === round.id
                    ? "1px solid color-mix(in srgb, var(--primary) 50%, transparent)"
                    : "1px solid transparent",
                  boxShadow: activeRound?.id === round.id
                    ? "0 0 20px -5px color-mix(in srgb, var(--primary) 20%, transparent)"
                    : "none",
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-display font-semibold" style={{ color: "var(--on-surface)" }}>
                      Round {round.roundNumber}
                    </span>
                    {round.theme && (
                      <span className="text-sm ml-2" style={{ color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}>
                        — {round.theme}
                      </span>
                    )}
                    <span className="text-xs ml-2 px-2 py-0.5 rounded-full" style={{ background: "var(--surface-highest)", color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}>
                      {round.defaultTimeLimit}s default
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge badge-${round.status.toLowerCase()}`}>{round.status}</span>
                    {session.status === "ACTIVE" && round.status === "PENDING" && !activeRound && (
                      <button
                        onClick={() => startRound(round)}
                        className="btn-primary px-3 py-1 text-xs"
                        style={{ background: "linear-gradient(135deg, #00e3fd, #00b4c8)", color: "#004d57" }}
                      >
                        Start Round
                      </button>
                    )}
                    {activeRound?.id === round.id && (
                      <button
                        onClick={endRound}
                        className="px-3 py-1 text-xs font-semibold rounded-lg"
                        style={{ background: "color-mix(in srgb, var(--error) 20%, transparent)", color: "var(--error)", fontFamily: "Space Grotesk, sans-serif" }}
                      >
                        End Round
                      </button>
                    )}
                  </div>
                </div>

                {round.roundQuestions.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--on-surface-var)" }}>No questions assigned</p>
                ) : (
                  <div className="space-y-1.5">
                    {round.roundQuestions.map(rq => (
                      <div
                        key={rq.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg text-sm"
                        style={{
                          background: activeRQId === rq.id
                            ? "color-mix(in srgb, var(--primary) 12%, transparent)"
                            : "var(--surface-high)",
                          border: activeRQId === rq.id
                            ? "1px solid color-mix(in srgb, var(--primary) 40%, transparent)"
                            : "1px solid transparent",
                        }}
                      >
                        <span className="truncate flex-1" style={{ color: "var(--on-surface)", fontFamily: "Manrope, sans-serif" }}>
                          {rq.question.questionText}
                        </span>
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          <span className="text-xs" style={{ color: "var(--on-surface-var)" }}>{rq.timeLimit}s</span>
                          {activeRound?.id === round.id && activeRQId !== rq.id && !(activeRQId && !questionRevealed) && (
                            <button
                              onClick={() => startQuestion(rq)}
                              className="btn-primary px-2 py-0.5 text-xs"
                            >
                              Ask
                            </button>
                          )}
                          {activeRQId === rq.id && !questionRevealed && (
                            <button
                              onClick={revealAnswer}
                              className="px-2 py-0.5 text-xs font-bold rounded-lg"
                              style={{
                                background: "linear-gradient(135deg, var(--tertiary-container), var(--tertiary))",
                                color: "#2a1f00",
                                fontFamily: "Space Grotesk, sans-serif",
                              }}
                            >
                              Reveal
                            </button>
                          )}
                          {activeRQId === rq.id && questionRevealed && (
                            <span className="text-xs font-semibold" style={{ color: "var(--secondary)" }}>✓ Revealed</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeRound?.id === round.id && (
                  <div className="mt-3">
                    <button
                      onClick={() => setShowAssignQ(!showAssignQ)}
                      className="text-xs"
                      style={{ color: "var(--primary)", fontFamily: "Manrope, sans-serif" }}
                    >
                      + Assign Question
                    </button>
                    {showAssignQ && (() => {
                      const unassigned = allQuestions.filter(q => !round.roundQuestions.some(rq => rq.question.id === q.id));
                      const categories = Array.from(new Set(unassigned.map(q => q.category).filter(Boolean))) as string[];
                      const filtered = assignCategoryFilter
                        ? unassigned.filter(q => q.category === assignCategoryFilter)
                        : unassigned;
                      return (
                        <div className="mt-2 rounded-lg overflow-hidden" style={{ background: "var(--surface-high)" }}>
                          {/* Category filter chips */}
                          {categories.length > 0 && (
                            <div className="flex gap-1.5 flex-wrap px-3 pt-2 pb-1">
                              <button
                                onClick={() => setAssignCategoryFilter("")}
                                className="text-xs px-2 py-0.5 rounded-full transition-colors"
                                style={{
                                  background: assignCategoryFilter === "" ? "var(--primary)" : "var(--surface-highest)",
                                  color: assignCategoryFilter === "" ? "var(--on-primary)" : "var(--on-surface-var)",
                                  fontFamily: "Manrope, sans-serif",
                                }}
                              >
                                All
                              </button>
                              {categories.map(cat => (
                                <button
                                  key={cat}
                                  onClick={() => setAssignCategoryFilter(cat)}
                                  className="text-xs px-2 py-0.5 rounded-full transition-colors"
                                  style={{
                                    background: assignCategoryFilter === cat ? "var(--primary)" : "var(--surface-highest)",
                                    color: assignCategoryFilter === cat ? "var(--on-primary)" : "var(--on-surface-var)",
                                    fontFamily: "Manrope, sans-serif",
                                  }}
                                >
                                  {cat}
                                </button>
                              ))}
                            </div>
                          )}
                          {/* Question list */}
                          <div className="max-h-48 overflow-y-auto space-y-0.5 p-1">
                            {filtered.length === 0 ? (
                              <p className="text-xs px-3 py-2" style={{ color: "var(--on-surface-var)" }}>No questions in this category</p>
                            ) : filtered.map(q => (
                              <button
                                key={q.id}
                                onClick={() => { assignQuestion(q.id); setShowAssignQ(false); }}
                                className="w-full text-left text-xs px-3 py-2 rounded-lg transition-colors"
                                style={{ color: "var(--on-surface)", fontFamily: "Manrope, sans-serif" }}
                                onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-highest)")}
                                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                              >
                                {q.questionText}
                                <span className="ml-2" style={{ color: "var(--on-surface-var)" }}>
                                  {q.category} · {q.points}pts
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Right: Active question + Teams */}
        <div className="space-y-4">
          {currentRQ && (
            <div
              className="rounded-xl p-4 glow-primary"
              style={{
                background: "color-mix(in srgb, var(--primary) 8%, var(--surface-container))",
                border: "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
              }}
            >
              <p className="font-display text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--primary)" }}>
                Active Question
              </p>
              <p className="text-sm mb-3" style={{ color: "var(--on-surface)", fontFamily: "Manrope, sans-serif" }}>
                {currentRQ.question.questionText}
              </p>
              {timer !== null && (
                <div className="text-center">
                  <span
                    className="font-display text-4xl font-bold"
                    style={{ color: timer <= 5 ? "var(--error)" : "var(--on-surface)" }}
                  >
                    {timer}
                  </span>
                  <p className="text-xs mt-0.5" style={{ color: "var(--on-surface-var)" }}>seconds</p>
                  <div className="mana-bar-track mt-2 h-2">
                    <div
                      className={`mana-bar-fill h-2 ${timer <= 5 ? "urgent" : ""}`}
                      style={{ width: `${Math.max(0, (timer / currentRQ.timeLimit) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              {questionRevealed && (
                <p className="text-sm mt-2 font-semibold" style={{ color: "var(--secondary)", fontFamily: "Manrope, sans-serif" }}>
                  ✓ {currentRQ.question.correctAnswer}
                </p>
              )}
            </div>
          )}

          <div
            className="rounded-xl p-4"
            style={{ background: "var(--surface-container)" }}
          >
            <h3
              className="font-display font-semibold text-sm uppercase tracking-widest mb-3"
              style={{ color: "var(--on-surface-var)" }}
            >
              Teams ({session.teams.length})
            </h3>
            {session.teams.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--on-surface-var)" }}>No teams yet</p>
            ) : (
              <div className="space-y-2">
                {session.teams.map((t, i) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between text-sm py-1"
                    style={{
                      borderBottom: i < session.teams.length - 1
                        ? "1px solid color-mix(in srgb, var(--outline-var) 30%, transparent)"
                        : "none",
                    }}
                  >
                    <span style={{ color: "var(--on-surface)", fontFamily: "Manrope, sans-serif" }}>
                      {i + 1}. {t.teamName}
                    </span>
                    <span className="font-display font-semibold" style={{ color: "var(--primary)" }}>
                      {t.totalScore} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
