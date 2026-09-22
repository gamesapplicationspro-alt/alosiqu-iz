"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { secureRequest } from "../lib/session";

export default function CreateRoom() {
  const router = useRouter();
  const [name, setName] = useState(() => typeof window === "undefined" ? "" : localStorage.getItem("playerName") || "");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function createRoom() {
    const cleanName = name.trim().replace(/\s+/g, " ");
    if (cleanName.length < 2) return setError("Το nickname χρειάζεται τουλάχιστον 2 χαρακτήρες.");
    setLoading(true); setError("");
    try {
      localStorage.setItem("playerName", cleanName);
      const result = await secureRequest("/api/rooms", { method: "POST", body: JSON.stringify({ name: cleanName, code: code || undefined }) });
      router.replace(`/room/${result.roomId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Δεν δημιουργήθηκε το δωμάτιο.");
    } finally { setLoading(false); }
  }

  return <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 via-yellow-100 to-orange-100 p-4 dark:from-amber-950 dark:via-yellow-950">
    <section className="w-full max-w-md rounded-2xl border-2 border-amber-700 bg-amber-50 p-6 shadow-2xl dark:bg-stone-950"><h1 className="text-center text-2xl font-black text-amber-900 dark:text-amber-100">Δημιουργία δωματίου</h1><p className="mt-2 text-center text-sm text-amber-800 dark:text-amber-200">Θα γίνετε host και μπορείτε να παίξετε ή να παρατηρείτε.</p>
      <label className="mt-6 block text-sm font-bold">Nickname</label><input value={name} onChange={(event) => setName(event.target.value)} maxLength={20} autoComplete="nickname" className="mt-1 w-full rounded-xl border-2 border-amber-500 bg-white p-3 text-amber-950" placeholder="Το nickname σας" />
      <label className="mt-4 block text-sm font-bold">Κωδικός δωματίου <span className="font-normal">(προαιρετικός)</span></label><div className="mt-1 flex gap-2"><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} maxLength={6} className="min-w-0 flex-1 rounded-xl border-2 border-amber-500 bg-white p-3 text-center font-mono text-lg tracking-widest text-amber-950" placeholder="ABC123" /><button onClick={() => setCode(Math.random().toString(36).slice(2, 8).toUpperCase())} className="rounded-xl bg-amber-700 px-3 font-bold text-white">Νέος</button></div>
      {error && <p className="mt-4 rounded-lg bg-red-100 p-3 text-sm font-semibold text-red-800">{error}</p>}
      <button disabled={loading} onClick={() => void createRoom()} className="mt-6 w-full rounded-xl bg-gradient-to-r from-green-600 to-green-800 p-4 text-lg font-black text-white disabled:opacity-60">{loading ? "Ασφαλής δημιουργία…" : "Δημιουργία δωματίου"}</button>
      <button onClick={() => router.push("/")} className="mt-4 w-full text-sm font-semibold text-amber-800 underline dark:text-amber-200">← Αρχική</button>
    </section>
  </main>;
}
