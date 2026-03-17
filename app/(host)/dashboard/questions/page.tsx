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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-500 hover:text-white text-sm">← Back</Link>
          <h2 className="text-2xl font-bold">Question Bank</h2>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-semibold transition-colors"
        >
          + Add Question
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Question</label>
            <input value={form.questionText} onChange={e => setForm(f => ({ ...f, questionText: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
              placeholder="Enter question text" required />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Answer Options</label>
            <div className="grid grid-cols-2 gap-2">
              {form.options.map((opt, i) => (
                <input key={i} value={opt} onChange={e => setForm(f => ({ ...f, options: f.options.map((o, j) => j === i ? e.target.value : o) }))}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  placeholder={`Option ${i + 1}`} />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Correct Answer</label>
              <input value={form.correctAnswer} onChange={e => setForm(f => ({ ...f, correctAnswer: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                placeholder="Exact match" required />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Category</label>
              <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                placeholder="e.g. Science" />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Points</label>
              <input type="number" value={form.points} onChange={e => setForm(f => ({ ...f, points: parseInt(e.target.value) || 10 }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                min={1} max={1000} />
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-sm font-semibold transition-colors">
              {saving ? "Saving..." : "Save Question"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {loading ? <p className="text-gray-500">Loading...</p> : questions.length === 0 ? (
        <div className="text-center py-16 text-gray-500">No questions yet. Add your first one!</div>
      ) : (
        <div className="space-y-2">
          {questions.map(q => (
            <div key={q.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{q.questionText}</p>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {(q.options as string[]).map((o, i) => (
                    <span key={i} className={`text-xs px-2 py-0.5 rounded ${o.toLowerCase() === q.correctAnswer.toLowerCase() ? "bg-green-500/20 text-green-300" : "bg-gray-800 text-gray-400"}`}>{o}</span>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">{q.category ?? "No category"} · {q.points} pts</p>
              </div>
              <button onClick={() => deleteQuestion(q.id)} className="text-gray-600 hover:text-red-400 text-sm transition-colors shrink-0">Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
