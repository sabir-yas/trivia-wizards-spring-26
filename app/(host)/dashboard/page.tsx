"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Session {
  id: string;
  sessionName: string;
  status: "LOBBY" | "ACTIVE" | "COMPLETED";
  createdAt: string;
  _count: { teams: number; rounds: number };
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function loadSessions() {
    const res = await fetch("/api/sessions");
    if (res.ok) {
      const data = await res.json();
      setSessions(data.data);
    }
    setLoading(false);
  }

  useEffect(() => { loadSessions(); }, []);

  async function createSession(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionName: newName.trim() }),
    });
    if (res.ok) {
      setNewName("");
      setShowForm(false);
      loadSessions();
    }
    setCreating(false);
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <h2
          className="font-display text-2xl font-bold"
          style={{ color: "var(--on-surface)" }}
        >
          Game Sessions
        </h2>
        <div className="flex gap-3">
          <Link
            href="/dashboard/questions"
            className="btn-secondary px-4 py-2 text-sm"
          >
            Question Bank
          </Link>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary px-4 py-2 text-sm"
          >
            + New Session
          </button>
        </div>
      </div>

      {/* New session form */}
      {showForm && (
        <form
          onSubmit={createSession}
          className="rounded-xl p-4 mb-6 flex gap-3"
          style={{ background: "var(--surface-container)" }}
        >
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Session name (e.g. Tuesday Night Trivia)"
            className="neon-input flex-1 px-4 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="btn-primary px-4 py-2 text-sm"
          >
            {creating ? "Creating..." : "Create"}
          </button>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="btn-tertiary px-4 py-2 text-sm"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Session list */}
      {loading ? (
        <p className="text-sm" style={{ color: "var(--on-surface-var)" }}>Loading sessions...</p>
      ) : sessions.length === 0 ? (
        <div className="text-center py-20" style={{ color: "var(--on-surface-var)" }}>
          <div className="text-4xl mb-4">🎩</div>
          <p className="font-display text-lg font-semibold mb-1" style={{ color: "var(--on-surface)" }}>No sessions yet</p>
          <p className="text-sm">Create your first game session to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/sessions/${s.id}`}
              className="block rounded-xl p-5 transition-all group"
              style={{
                background: "var(--surface-container)",
                border: "1px solid transparent",
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "color-mix(in srgb, #ff7afb 30%, transparent)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "transparent")}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3
                    className="font-display font-semibold transition-colors"
                    style={{ color: "var(--on-surface)" }}
                  >
                    {s.sessionName}
                  </h3>
                  <p className="text-sm mt-1" style={{ color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}>
                    {s._count.rounds} rounds · {s._count.teams} teams ·{" "}
                    {new Date(s.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`badge badge-${s.status.toLowerCase()}`}>
                  {s.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
