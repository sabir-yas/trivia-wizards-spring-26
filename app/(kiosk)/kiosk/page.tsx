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
      sessionStorage.setItem(`team-${sessionId}`, data.data.id);
      router.push(`/kiosk/${sessionId}?teamId=${data.data.id}`);
    } finally {
      setLoading(false);
    }
  }

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <p className="text-xl text-center" style={{ color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}>
          No session ID provided. Ask your host for the kiosk URL.
        </p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-8"
      style={{ background: "var(--bg)" }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, color-mix(in srgb, #ff7afb 7%, transparent) 0%, transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-lg">
        {/* Title */}
        <div className="text-center mb-12">
          <div className="text-6xl mb-4">🎩</div>
          <h1
            className="font-display font-bold mb-3"
            style={{
              fontSize: "clamp(2.5rem, 8vw, 4rem)",
              background: "linear-gradient(135deg, #ff7afb, #00e3fd)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Trivia Wizards
          </h1>
          <p className="text-xl" style={{ color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}>
            Enter your team name to join
          </p>
        </div>

        <form onSubmit={join} className="space-y-5">
          <input
            type="text"
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            placeholder="Team Name"
            maxLength={50}
            autoFocus
            className="neon-input w-full px-6 py-5 text-2xl text-center"
            style={{ borderRadius: "1rem" }}
          />
          {error && (
            <p className="text-center text-lg" style={{ color: "var(--error)", fontFamily: "Manrope, sans-serif" }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !teamName.trim()}
            className="btn-primary w-full py-5 text-2xl font-bold"
            style={{ borderRadius: "1rem" }}
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
      <KioskRegisterForm />
    </Suspense>
  );
}
