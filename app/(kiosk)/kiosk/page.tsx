"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function KioskRegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") ?? "";

  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Request fullscreen on touch devices
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!teamName.trim() || !sessionId) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameSessionId: sessionId, teamName: teamName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to join"); return; }
      // Store teamId for this session
      sessionStorage.setItem(`team-${sessionId}`, data.data.id);
      router.push(`/kiosk/${sessionId}?teamId=${data.data.id}`);
    } finally {
      setLoading(false);
    }
  }

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-xl">No session ID provided. Ask your host for the kiosk URL.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold text-purple-400 mb-3">Trivia Wizards</h1>
          <p className="text-gray-400 text-xl">Enter your team name to join</p>
        </div>
        <form onSubmit={join} className="space-y-6">
          <input
            type="text"
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            placeholder="Team Name"
            maxLength={50}
            autoFocus
            className="w-full bg-gray-900 border-2 border-gray-700 focus:border-purple-500 rounded-2xl px-6 py-5 text-white text-2xl text-center focus:outline-none transition-colors"
          />
          {error && <p className="text-red-400 text-center text-lg">{error}</p>}
          <button
            type="submit"
            disabled={loading || !teamName.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-2xl py-5 rounded-2xl transition-colors"
          >
            {loading ? "Joining..." : "Join Game"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function KioskPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>}>
      <KioskRegisterForm />
    </Suspense>
  );
}
