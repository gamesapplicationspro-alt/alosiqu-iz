"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { secureRequest } from "../lib/session";

export default function JoinRoom() {
  const router = useRouter();
  const [name, setName] = useState(() => typeof window === "undefined" ? "" : localStorage.getItem("playerName") || "");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function join() {
    const cleanName = name.trim().replace(/\s+/g, " ");
    if (cleanName.length < 2 || code.length < 4) return setError("Συμπληρώστε nickname και έγκυρο κωδικό δωματίου.");
    setLoading(true); setError("");
    try {
      localStorage.setItem("playerName", cleanName);
      const result = await secureRequest("/api/rooms/join", { method: "POST", body: JSON.stringify({ name: cleanName, code }) });
      router.replace(`/room/${result.roomId}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Δεν ήταν δυνατή η είσοδος."); }
    finally { setLoading(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 via-purple-100 to-purple-200 p-4 dark:from-purple-950 dark:via-purple-900">
    <section className="w-full max-w-md rounded-2xl border-2 border-purple-700 bg-white p-6 shadow-2xl dark:bg-stone-950"><h1 className="text-center text-2xl font-black text-purple-900 dark:text-purple-100">Είσοδος σε δωμάτιο</h1><p className="mt-2 text-center text-sm text-purple-800 dark:text-purple-200">Μπείτε στο παιχνίδι του host με τον εξαψήφιο κωδικό.</p>
      <label className="mt-6 block text-sm font-bold">Nickname</label><input value={name} onChange={(event) => setName(event.target.value)} maxLength={20} autoComplete="nickname" className="mt-1 w-full rounded-xl border-2 border-purple-500 bg-purple-50 p-3 text-purple-950" placeholder="Το nickname σας" />
      <label className="mt-4 block text-sm font-bold">Κωδικός δωματίου</label><input value={code} onInput={(event) => setCode(event.currentTarget.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} inputMode="text" autoCapitalize="characters" spellCheck={false} maxLength={6} autoFocus className="mt-1 w-full rounded-xl border-2 border-purple-500 bg-purple-50 p-3 text-center font-mono text-xl tracking-[0.3em] text-purple-950" placeholder="ABC123" />
      {error && <p className="mt-4 rounded-lg bg-red-100 p-3 text-sm font-semibold text-red-800">{error}</p>}
      <button disabled={loading} onClick={() => void join()} className="mt-6 w-full rounded-xl bg-gradient-to-r from-purple-600 to-purple-800 p-4 text-lg font-black text-white disabled:opacity-60">{loading ? "Ασφαλής είσοδος…" : "Είσοδος στο παιχνίδι"}</button>
      <button onClick={() => router.push("/")} className="mt-4 w-full text-sm font-semibold text-purple-800 underline dark:text-purple-200">← Αρχική</button>
    </section>
  </main>;
}
