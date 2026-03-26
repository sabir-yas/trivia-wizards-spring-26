"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/host/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        setError(data.error ?? "Login failed");
        return;
      }
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--bg)" }}
    >
      {/* Ambient glow backdrop */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, color-mix(in srgb, #ff7afb 8%, transparent) 0%, transparent 70%)",
        }}
      />

      <div
        className="glass glow-primary relative w-full max-w-sm rounded-2xl p-8"
        style={{ border: "1px solid color-mix(in srgb, #ff7afb 15%, transparent)" }}
      >
        {/* Logo mark */}
        <div className="flex items-center justify-center mb-6">
          <span className="text-5xl">🎩</span>
        </div>

        <h1
          className="font-display text-3xl font-bold text-center mb-1"
          style={{ color: "var(--on-surface)" }}
        >
          Trivia Wizards
        </h1>
        <p
          className="text-center text-sm mb-8"
          style={{ color: "var(--on-surface-var)", fontFamily: "var(--font-body)" }}
        >
          Host Login
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="neon-input w-full px-4 py-3 text-sm"
              placeholder="Enter host password"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: "var(--error)", fontFamily: "Manrope, sans-serif" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="btn-primary w-full py-3 text-sm mt-2"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>
      </div>
    </div>
  );
}
