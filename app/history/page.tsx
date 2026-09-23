"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { secureRequest } from "../lib/session";

type HistoryEntry = { id: string; playerName: string; score: number; totalQuestions: number; percentage: number; date: number; roomCode: string; expiresAt: number; mode?: "solo" | "multiplayer" };

export default function HistoryPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<HistoryEntry[]>(() => {
    if (typeof window === "undefined") return [];
    const localEntries = JSON.parse(localStorage.getItem("soloQuizHistory") || "[]") as HistoryEntry[];
    return localEntries.filter((entry) => entry.expiresAt > Date.now());
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const localEntries = JSON.parse(localStorage.getItem("soloQuizHistory") || "[]") as HistoryEntry[];
    void secureRequest("/api/history")
      .then((result) => {
        const remoteEntries = (result.entries || []) as HistoryEntry[];
        setEntries([...localEntries, ...remoteEntries].filter((entry, index, all) => all.findIndex((candidate) => candidate.id === entry.id) === index).sort((a, b) => b.date - a.date));
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const completedGames = entries.length;
  const bestScore = entries.reduce((best, entry) => Math.max(best, entry.percentage), 0);
  const badges = [
    completedGames >= 1 ? "Πρώτος αγώνας" : null,
    completedGames >= 5 ? "Σταθερός παίκτης" : null,
    bestScore >= 80 ? "Ιστορικός γνώστης" : null,
    bestScore === 100 ? "Άριστος" : null,
  ].filter(Boolean);

  return <main className="min-h-screen pattern-greek-key p-4 md:p-8">
    <section className="max-w-3xl mx-auto">
      <header className="marble-bg text-center p-6"><h1 className="greek-title text-3xl md:text-5xl">ΠΡΟΣΩΠΙΚΟ ΙΣΤΟΡΙΚΟ</h1><p className="mt-3">Τα αποτελέσματά σας διατηρούνται για 24 ώρες.</p></header>
      <section className="parchment-bg p-6 mt-6">
        {loading && <p className="text-center">Ασφαλής φόρτωση…</p>}
        {!loading && <div className="mb-6 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-amber-100 p-3 text-center"><b className="block text-2xl">{completedGames}</b><span className="text-sm">αγώνες</span></div><div className="rounded-xl bg-amber-100 p-3 text-center"><b className="block text-2xl">{bestScore}%</b><span className="text-sm">καλύτερο σκορ</span></div><div className="rounded-xl bg-amber-100 p-3 text-center"><b className="block text-2xl">{badges.length}</b><span className="text-sm">badges</span></div></div>}
        {!loading && badges.length > 0 && <div className="mb-6 flex flex-wrap justify-center gap-2">{badges.map((badge) => <span key={badge} className="rounded-full bg-purple-100 px-3 py-1 text-sm font-bold text-purple-900">🏅 {badge}</span>)}</div>}
        {!loading && entries.length === 0 && <p className="text-center">Δεν υπάρχουν πρόσφατα αποτελέσματα.</p>}
        <div className="space-y-3">{entries.map((entry) => <article key={entry.id} className="border-b border-stone/30 pb-3 flex justify-between gap-4"><div><strong>{entry.playerName}</strong><p className="text-sm">{entry.mode === "solo" ? "Μοναχικό παιχνίδι" : `Δωμάτιο ${entry.roomCode}`} · {new Date(entry.date).toLocaleString("el-GR")}</p></div><div className="text-right"><strong>{entry.score}/{entry.totalQuestions}</strong><p>{entry.percentage}%</p></div></article>)}</div>
      </section>
      <div className="text-center mt-6"><button className="bronze-button px-6 py-3" onClick={() => router.push("/")}>Νέος αγώνας</button></div>
    </section>
  </main>;
}
