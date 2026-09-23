"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { secureRequest } from "../lib/session";

type Draft = { text: string; answers: string[]; correctAnswer: number };
const blank = (): Draft => ({ text: "", answers: ["", "", "", ""], correctAnswer: 0 });

export default function CreateQuiz() {
  const router = useRouter();
  const [name, setName] = useState(() => typeof window === "undefined" ? "" : localStorage.getItem("playerName") || "");
  const [drafts, setDrafts] = useState<Draft[]>([blank(), blank(), blank()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateQuestion(index: number, update: Partial<Draft>) {
    setDrafts((current) => current.map((draft, draftIndex) => draftIndex === index ? { ...draft, ...update } : draft));
  }

  function updateAnswer(questionIndex: number, answerIndex: number, value: string) {
    setDrafts((current) => current.map((draft, draftIndex) => draftIndex === questionIndex ? { ...draft, answers: draft.answers.map((answer, index) => index === answerIndex ? value : answer) } : draft));
  }

  async function createQuiz() {
    const cleanName = name.trim().replace(/\s+/g, " ");
    if (cleanName.length < 2) return setError("Το nickname χρειάζεται τουλάχιστον 2 χαρακτήρες.");
    if (drafts.some((draft) => draft.text.trim().length < 5 || draft.answers.some((answer) => !answer.trim()))) return setError("Συμπλήρωσε όλες τις ερωτήσεις και απαντήσεις.");
    setLoading(true); setError("");
    try {
      localStorage.setItem("playerName", cleanName);
      const result = await secureRequest("/api/rooms", { method: "POST", body: JSON.stringify({ name: cleanName, settings: { category: "Custom", questionCount: drafts.length }, customQuestions: drafts }) });
      router.replace(`/room/${result.roomId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Δεν δημιουργήθηκε το custom quiz.");
    } finally { setLoading(false); }
  }

  return <main className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-100 to-orange-100 p-4 dark:from-amber-950 dark:via-yellow-950"><section className="mx-auto max-w-4xl"><header className="rounded-2xl bg-amber-900 p-6 text-center text-white shadow-xl"><h1 className="text-3xl font-black">Δημιουργία custom quiz</h1><p className="mt-2">Ο host δημιουργεί ερωτήσεις με ιδιωτικό answer key.</p></header><section className="mt-5 rounded-2xl bg-white p-6 shadow-xl dark:bg-stone-900"><label className="block text-sm font-bold" htmlFor="custom-name">Nickname host</label><input id="custom-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={20} className="mt-1 w-full rounded-xl border-2 border-amber-500 p-3" />{drafts.map((draft, questionIndex) => <article key={questionIndex} className="mt-6 rounded-xl border-2 border-amber-200 p-4"><h2 className="font-black">Ερώτηση {questionIndex + 1}</h2><textarea value={draft.text} onChange={(event) => updateQuestion(questionIndex, { text: event.target.value })} maxLength={240} rows={2} placeholder="Γράψε την ερώτηση" className="mt-2 w-full rounded-xl border p-3" />{draft.answers.map((answer, answerIndex) => <div key={answerIndex} className="mt-2 flex items-center gap-2"><input type="radio" name={`correct-${questionIndex}`} checked={draft.correctAnswer === answerIndex} onChange={() => updateQuestion(questionIndex, { correctAnswer: answerIndex })} aria-label={`Σωστή απάντηση ${answerIndex + 1}`} /><input value={answer} onChange={(event) => updateAnswer(questionIndex, answerIndex, event.target.value)} maxLength={120} placeholder={`Απάντηση ${answerIndex + 1}`} className="w-full rounded-lg border p-2" /></div>)}</article>)}{error && <p className="mt-4 rounded-lg bg-red-100 p-3 font-semibold text-red-800">{error}</p>}<button disabled={loading} onClick={() => void createQuiz()} className="mt-6 w-full rounded-xl bg-green-700 p-4 font-black text-white disabled:opacity-50">{loading ? "Δημιουργία…" : "Δημιουργία δωματίου"}</button><button onClick={() => router.push("/")} className="mt-4 w-full text-sm font-bold text-amber-800 underline">Αρχική</button></section></section></main>;
}
