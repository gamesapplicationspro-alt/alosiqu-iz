"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState(() => typeof window === "undefined" ? "" : localStorage.getItem("playerName") || "");
  const [error, setError] = useState("");

  function go(path: string) {
    const clean = name.trim().replace(/\s+/g, " ");
    if (clean.length < 2 || clean.length > 20) {
      setError("Γράψτε nickname από 2 έως 20 χαρακτήρες.");
      return;
    }
    localStorage.setItem("playerName", clean);
    router.push(path);
  }

  return <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-100 via-yellow-50 to-orange-100 p-4 dark:from-amber-950 dark:via-yellow-950 dark:to-orange-950">
    <section className="w-full max-w-2xl rounded-2xl border-2 border-amber-300 bg-white/90 p-6 text-center shadow-2xl backdrop-blur sm:p-10 dark:border-amber-800 dark:bg-stone-950/90">
      <div className="mb-3 text-6xl">🏰</div>
      <h1 className="text-3xl font-black tracking-tight text-amber-900 sm:text-5xl dark:text-amber-100">Quiz της Άλωσης</h1>
      <p className="mx-auto mt-4 max-w-xl text-amber-800 dark:text-amber-200">Γρήγορο ζωντανό quiz για την Άλωση της Κωνσταντινούπολης.</p>
      <label className="mx-auto mt-8 block max-w-md text-left text-sm font-bold text-amber-900 dark:text-amber-100" htmlFor="nickname">Το nickname σας</label>
      <input id="nickname" value={name} onChange={(event) => { setName(event.target.value); setError(""); }} maxLength={20} autoComplete="nickname" placeholder="π.χ. Ιστοριοδίφης" className="mx-auto mt-2 block w-full max-w-md rounded-xl border-2 border-amber-500 bg-amber-50 px-4 py-3 text-lg text-amber-950 outline-none focus:ring-4 focus:ring-amber-300" />
      {error && <p className="mx-auto mt-2 max-w-md text-left text-sm font-semibold text-red-700">{error}</p>}
      <div className="mx-auto mt-6 grid max-w-md gap-3">
        <button onClick={() => go("/quiz")} className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-4 text-lg font-bold text-white shadow-lg transition hover:scale-[1.02]">🏆 Μοναχικό παιχνίδι</button>
        <button onClick={() => go("/create-room")} className="rounded-xl bg-gradient-to-r from-green-600 to-green-800 px-6 py-4 text-lg font-bold text-white shadow-lg transition hover:scale-[1.02]">👥 Δημιουργία δωματίου</button>
        <button onClick={() => go("/join-room")} className="rounded-xl bg-gradient-to-r from-purple-600 to-purple-800 px-6 py-4 text-lg font-bold text-white shadow-lg transition hover:scale-[1.02]">🔑 Είσοδος με κωδικό</button>
      </div>
    </section>
  </main>;
}
