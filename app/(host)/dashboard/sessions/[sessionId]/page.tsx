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

  // For adding rounds / questions
  const [allQuestions, setAllQuestions] = useState<AllQuestion[]>([]);
  const [showAddRound, setShowAddRound] = useState(false);
  const [newRoundTheme, setNewRoundTheme] = useState("");
  const [showAssignQ, setShowAssignQ] = useState(false);

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

  // Join the host socket room once session is loaded
  useEffect(() => {
    if (!session) return;
    socket.emit("host:join-session", { sessionId, hostToken: "host" });
  }, [!!session, socket, sessionId]);

  // Register socket listeners once on mount — never re-register
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
      body: JSON.stringify({ roundNumber: nextNum, theme: newRoundTheme || undefined }),
    });
    if (res.ok) { setShowAddRound(false); setNewRoundTheme(""); loadSession(); }
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

  if (loading) return <div className="text-gray-500 text-center py-16">Loading...</div>;
  if (!session) return <div className="text-red-400 text-center py-16">Session not found.</div>;

  const currentRQ = activeRound?.roundQuestions.find(rq => rq.id === activeRQId) ?? null;
  const sorted = [...session.teams].sort((a, b) => b.totalScore - a.totalScore);
  const [first, second, third] = sorted;

  if (session.status === "COMPLETED") {
    return (
      <div className="max-w-2xl mx-auto py-12 space-y-8">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-500 hover:text-white text-sm">← Back</Link>
          <h2 className="text-2xl font-bold">{session.sessionName}</h2>
          <span className="text-xs px-2 py-1 rounded-full font-medium bg-gray-500/20 text-gray-400">COMPLETED</span>
        </div>

        <div className="text-center">
          <div className="text-5xl mb-2">🏆</div>
          <h3 className="text-3xl font-bold text-white">Final Results</h3>
          <p className="text-gray-400 mt-1">{session.teams.length} teams competed</p>
        </div>

        {/* Podium */}
        {sorted.length > 0 && (
          <div className="flex items-end justify-center gap-4">
            {/* 2nd */}
            {second && (
              <div className="flex flex-col items-center gap-2">
                <span className="text-3xl">🥈</span>
                <div className="bg-gray-400/20 border-2 border-gray-500 rounded-t-xl px-6 py-4 text-center w-36 h-28 flex flex-col justify-center">
                  <p className="text-white font-bold text-sm leading-tight">{second.teamName}</p>
                  <p className="text-gray-300 text-xl font-bold mt-1">{second.totalScore}</p>
                  <p className="text-gray-500 text-xs">pts</p>
                </div>
              </div>
            )}
            {/* 1st */}
            {first && (
              <div className="flex flex-col items-center gap-2">
                <span className="text-4xl">🥇</span>
                <div className="bg-yellow-600/30 border-2 border-yellow-500 rounded-t-xl px-6 py-4 text-center w-40 h-36 flex flex-col justify-center">
                  <p className="text-white font-bold leading-tight">{first.teamName}</p>
                  <p className="text-yellow-300 text-2xl font-bold mt-1">{first.totalScore}</p>
                  <p className="text-yellow-500 text-xs">pts</p>
                </div>
              </div>
            )}
            {/* 3rd */}
            {third && (
              <div className="flex flex-col items-center gap-2">
                <span className="text-3xl">🥉</span>
                <div className="bg-orange-700/20 border-2 border-orange-600 rounded-t-xl px-6 py-4 text-center w-36 h-20 flex flex-col justify-center">
                  <p className="text-white font-bold text-sm leading-tight">{third.teamName}</p>
                  <p className="text-orange-300 text-xl font-bold mt-1">{third.totalScore}</p>
                  <p className="text-orange-500 text-xs">pts</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Full standings */}
        {sorted.length > 3 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">All Teams</h4>
            {sorted.map((t, i) => (
              <div key={t.id} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 w-6 text-sm">{i + 1}.</span>
                  <span className="text-white">{t.teamName}</span>
                </div>
                <span className="text-purple-300 font-bold">{t.totalScore} pts</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-500 hover:text-white text-sm">← Back</Link>
          <h2 className="text-2xl font-bold">{session.sessionName}</h2>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            session.status === "ACTIVE" ? "bg-green-500/20 text-green-300" :
            session.status === "COMPLETED" ? "bg-gray-500/20 text-gray-400" :
            "bg-yellow-500/20 text-yellow-300"
          }`}>{session.status}</span>
        </div>
        <div className="flex gap-2">
          <a
            href={`/display/${sessionId}`}
            target="_blank"
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs transition-colors"
          >
            Open Display ↗
          </a>
          <a
            href={`/kiosk?session=${sessionId}`}
            target="_blank"
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs transition-colors"
          >
            Open Kiosk ↗
          </a>
          {session.status === "LOBBY" && (
            <button onClick={startSession} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-semibold transition-colors">
              Start Game
            </button>
          )}
          {session.status === "ACTIVE" && (
            <button onClick={endSession} className="px-3 py-1.5 bg-red-700 hover:bg-red-800 rounded-lg text-sm transition-colors">
              End Game
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Rounds */}
        <div className="col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-300">Rounds</h3>
            {session.status !== "COMPLETED" && (
              <button onClick={() => setShowAddRound(!showAddRound)} className="text-sm text-purple-400 hover:text-purple-300">
                + Add Round
              </button>
            )}
          </div>

          {showAddRound && (
            <div className="flex gap-2">
              <input value={newRoundTheme} onChange={e => setNewRoundTheme(e.target.value)}
                placeholder="Round theme (optional)"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
              <button onClick={addRound} className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-semibold">Add</button>
              <button onClick={() => setShowAddRound(false)} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm">Cancel</button>
            </div>
          )}

          {session.rounds.length === 0 ? (
            <div className="text-center py-8 text-gray-600 text-sm">No rounds yet</div>
          ) : (
            session.rounds.map(round => (
              <div key={round.id} className={`bg-gray-900 border rounded-xl p-4 ${activeRound?.id === round.id ? "border-purple-600" : "border-gray-800"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-semibold">Round {round.roundNumber}</span>
                    {round.theme && <span className="text-gray-400 text-sm ml-2">— {round.theme}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      round.status === "ACTIVE" ? "bg-green-500/20 text-green-300" :
                      round.status === "COMPLETED" ? "bg-gray-500/20 text-gray-400" :
                      "bg-yellow-500/20 text-yellow-300"
                    }`}>{round.status}</span>
                    {session.status === "ACTIVE" && round.status === "PENDING" && !activeRound && (
                      <button onClick={() => startRound(round)} className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded-lg text-xs font-semibold">
                        Start Round
                      </button>
                    )}
                    {activeRound?.id === round.id && (
                      <button onClick={endRound} className="px-3 py-1 bg-red-700 hover:bg-red-800 rounded-lg text-xs">
                        End Round
                      </button>
                    )}
                  </div>
                </div>

                {/* Questions in this round */}
                {round.roundQuestions.length === 0 ? (
                  <p className="text-gray-600 text-xs">No questions assigned</p>
                ) : (
                  <div className="space-y-2">
                    {round.roundQuestions.map(rq => (
                      <div key={rq.id} className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                        activeRQId === rq.id ? "bg-purple-900/40 border border-purple-700" : "bg-gray-800"
                      }`}>
                        <span className="text-gray-300 truncate flex-1">{rq.question.questionText}</span>
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          <span className="text-gray-500 text-xs">{rq.timeLimit}s</span>
                          {activeRound?.id === round.id && activeRQId !== rq.id && !(activeRQId && !questionRevealed) && (
                            <button onClick={() => startQuestion(rq)} className="px-2 py-0.5 bg-purple-600 hover:bg-purple-700 rounded text-xs">
                              Ask
                            </button>
                          )}
                          {activeRQId === rq.id && !questionRevealed && (
                            <button onClick={revealAnswer} className="px-2 py-0.5 bg-yellow-600 hover:bg-yellow-700 rounded text-xs font-semibold">
                              Reveal
                            </button>
                          )}
                          {activeRQId === rq.id && questionRevealed && (
                            <span className="text-green-400 text-xs">✓ Revealed</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Assign question to this round */}
                {activeRound?.id === round.id && (
                  <div className="mt-3">
                    <button onClick={() => setShowAssignQ(!showAssignQ)} className="text-xs text-purple-400 hover:text-purple-300">
                      + Assign Question
                    </button>
                    {showAssignQ && (
                      <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                        {allQuestions.filter(q => !round.roundQuestions.some(rq => rq.question.id === q.id)).map(q => (
                          <button key={q.id} onClick={() => { assignQuestion(q.id); setShowAssignQ(false); }}
                            className="w-full text-left text-xs bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg text-gray-300 transition-colors">
                            {q.questionText}
                            <span className="text-gray-500 ml-2">{q.category} · {q.points}pts</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Right: Active status + Teams */}
        <div className="space-y-4">
          {/* Active question / timer */}
          {currentRQ && (
            <div className="bg-purple-900/30 border border-purple-700 rounded-xl p-4">
              <p className="text-xs text-purple-400 mb-1 font-medium uppercase tracking-wide">Active Question</p>
              <p className="text-white text-sm mb-3">{currentRQ.question.questionText}</p>
              {timer !== null && (
                <div className="text-center">
                  <span className={`text-4xl font-bold ${timer <= 5 ? "text-red-400" : "text-white"}`}>{timer}</span>
                  <p className="text-gray-500 text-xs">seconds</p>
                </div>
              )}
              {questionRevealed && (
                <p className="text-green-400 text-sm mt-2 font-medium">
                  ✓ Answer: {currentRQ.question.correctAnswer}
                </p>
              )}
            </div>
          )}

          {/* Teams */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="font-semibold text-gray-300 mb-3">Teams ({session.teams.length})</h3>
            {session.teams.length === 0 ? (
              <p className="text-gray-600 text-sm">No teams yet</p>
            ) : (
              <div className="space-y-2">
                {session.teams.map((t, i) => (
                  <div key={t.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{i + 1}. {t.teamName}</span>
                    <span className="text-purple-300 font-semibold">{t.totalScore} pts</span>
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
