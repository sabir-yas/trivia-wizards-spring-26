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

const statusColors = {
  LOBBY: "bg-yellow-500/20 text-yellow-300",
  ACTIVE: "bg-green-500/20 text-green-300",
  COMPLETED: "bg-gray-500/20 text-gray-400",
};

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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Game Sessions</h2>
        <div className="flex gap-3">
          <Link
            href="/dashboard/questions"
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
          >
            Question Bank
          </Link>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-semibold transition-colors"
          >
            + New Session
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={createSession} className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 flex gap-3">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Session name (e.g. Tuesday Night Trivia)"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-sm font-semibold transition-colors"
          >
            {creating ? "Creating..." : "Create"}
          </button>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500">Loading sessions...</p>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">No sessions yet</p>
          <p className="text-sm">Create your first game session to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/sessions/${s.id}`}
              className="block bg-gray-900 border border-gray-800 hover:border-purple-700 rounded-xl p-5 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white group-hover:text-purple-300 transition-colors">
                    {s.sessionName}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {s._count.rounds} rounds · {s._count.teams} teams ·{" "}
                    {new Date(s.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[s.status]}`}>
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
