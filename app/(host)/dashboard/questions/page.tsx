"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  category: string | null;
  points: number;
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    questionText: "",
    options: ["", "", "", ""],
    correctAnswer: "",
    category: "",
    points: 10,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/questions");
    if (res.ok) setQuestions((await res.json()).data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const filledOptions = form.options.filter(Boolean);
    if (filledOptions.length < 2) { setError("At least 2 options required"); return; }
    if (!form.correctAnswer) { setError("Correct answer required"); return; }
    setSaving(true);
    const res = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, options: filledOptions }),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ questionText: "", options: ["", "", "", ""], correctAnswer: "", category: "", points: 10 });
      load();
    } else {
      const d = await res.json();
      setError(d.error);
    }
    setSaving(false);
  }

  async function deleteQuestion(id: string) {
    if (!confirm("Delete this question?")) return;
    await fetch(`/api/questions/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="btn-tertiary text-sm px-2 py-1">← Back</Link>
          <h2 className="font-display text-2xl font-bold" style={{ color: "var(--on-surface)" }}>
            Question Bank
          </h2>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary px-4 py-2 text-sm"
        >
          + Add Question
        </button>
      </div>

      {/* Add question form */}
      {showForm && (
        <form
          onSubmit={save}
          className="rounded-xl p-5 mb-6 space-y-4"
          style={{ background: "var(--surface-container)" }}
        >
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}>
              Question
            </label>
            <input
              value={form.questionText}
              onChange={e => setForm(f => ({ ...f, questionText: e.target.value }))}
              className="neon-input w-full px-4 py-2 text-sm"
              placeholder="Enter question text"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}>
              Answer Options
            </label>
            <div className="grid grid-cols-2 gap-2">
              {form.options.map((opt, i) => (
                <input
                  key={i}
                  value={opt}
                  onChange={e => setForm(f => ({ ...f, options: f.options.map((o, j) => j === i ? e.target.value : o) }))}
                  className="neon-input px-3 py-2 text-sm"
                  placeholder={`Option ${i + 1}`}
                />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}>
                Correct Answer
              </label>
              <input
                value={form.correctAnswer}
                onChange={e => setForm(f => ({ ...f, correctAnswer: e.target.value }))}
                className="neon-input w-full px-3 py-2 text-sm"
                placeholder="Exact match"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}>
                Category
              </label>
              <input
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="neon-input w-full px-3 py-2 text-sm"
                placeholder="e.g. Science"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}>
                Points
              </label>
              <input
                type="number"
                value={form.points}
                onChange={e => setForm(f => ({ ...f, points: parseInt(e.target.value) || 10 }))}
                className="neon-input w-full px-3 py-2 text-sm"
                min={1}
                max={1000}
              />
            </div>
          </div>
          {error && <p className="text-sm" style={{ color: "var(--error)", fontFamily: "Manrope, sans-serif" }}>{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary px-4 py-2 text-sm">
              {saving ? "Saving..." : "Save Question"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-tertiary px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Questions list */}
      {loading ? (
        <p className="text-sm" style={{ color: "var(--on-surface-var)" }}>Loading...</p>
      ) : questions.length === 0 ? (
        <div className="text-center py-20" style={{ color: "var(--on-surface-var)" }}>
          No questions yet. Add your first one!
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map(q => (
            <div
              key={q.id}
              className="rounded-xl p-4 flex items-start justify-between gap-4"
              style={{ background: "var(--surface-container)" }}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate" style={{ color: "var(--on-surface)", fontFamily: "Manrope, sans-serif" }}>
                  {q.questionText}
                </p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {(q.options as string[]).map((o, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: o.toLowerCase() === q.correctAnswer.toLowerCase()
                          ? "color-mix(in srgb, #00e3fd 15%, transparent)"
                          : "var(--surface-high)",
                        color: o.toLowerCase() === q.correctAnswer.toLowerCase()
                          ? "var(--secondary)"
                          : "var(--on-surface-var)",
                        fontFamily: "Manrope, sans-serif",
                      }}
                    >
                      {o}
                    </span>
                  ))}
                </div>
                <p className="text-xs mt-1.5" style={{ color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}>
                  {q.category ?? "No category"} · {q.points} pts
                </p>
              </div>
              <button
                onClick={() => deleteQuestion(q.id)}
                className="text-sm transition-colors shrink-0"
                style={{ color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--error)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--on-surface-var)")}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
