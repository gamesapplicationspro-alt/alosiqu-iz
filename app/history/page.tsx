"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { secureRequest } from "../lib/session";

type HistoryEntry = { id: string; playerName: string; score: number; totalQuestions: number; percentage: number; date: number; roomCode: string; expiresAt: number };

export default function HistoryPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void secureRequest("/api/history")
      .then((result) => setEntries(result.entries || []))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Αδυναμία φόρτωσης ιστορικού."))
      .finally(() => setLoading(false));
  }, []);

  return <main className="min-h-screen pattern-greek-key p-4 md:p-8">
    <section className="max-w-3xl mx-auto">
      <header className="marble-bg text-center p-6"><h1 className="greek-title text-3xl md:text-5xl">ΠΡΟΣΩΠΙΚΟ ΙΣΤΟΡΙΚΟ</h1><p className="mt-3">Τα αποτελέσματά σας διατηρούνται για 24 ώρες.</p></header>
      <section className="parchment-bg p-6 mt-6">
        {loading && <p className="text-center">Ασφαλής φόρτωση…</p>}
        {error && <p className="error-parchment p-3">{error}</p>}
        {!loading && !error && entries.length === 0 && <p className="text-center">Δεν υπάρχουν πρόσφατα αποτελέσματα.</p>}
        <div className="space-y-3">{entries.map((entry) => <article key={entry.id} className="border-b border-stone/30 pb-3 flex justify-between gap-4"><div><strong>{entry.playerName}</strong><p className="text-sm">Δωμάτιο {entry.roomCode} · {new Date(entry.date).toLocaleString("el-GR")}</p></div><div className="text-right"><strong>{entry.score}/{entry.totalQuestions}</strong><p>{entry.percentage}%</p></div></article>)}</div>
      </section>
      <div className="text-center mt-6"><button className="bronze-button px-6 py-3" onClick={() => router.push("/")}>Νέος αγώνας</button></div>
    </section>
  </main>;
}
