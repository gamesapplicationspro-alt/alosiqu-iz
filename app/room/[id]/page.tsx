"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { getDatabase, onValue, ref } from "firebase/database";
import type { GamePhase } from "../../lib/game-phases";
import { getSession, secureRequest } from "../../lib/session";

type Answer = { id: string; text: string };
type Room = { id: string; code: string; phase: GamePhase; questionIndex: number; round: number; version: number; questions: { id: string; text: string; answers: Answer[] }[]; phaseEndsAt: number | null; revealCorrectAnswerId: string | null };
type Player = { name: string; score: number; participates: boolean; joinedAt: number; answeredRound: number; lastScoredRound: number };

const phaseTitle: Record<GamePhase, string> = { lobby: "Αναμονή", question: "Ερώτηση", reveal: "Αποκάλυψη", scoreboard: "Κατάταξη", finished: "Τελικό αποτέλεσμα" };

export default function RoomPage() {
  const { id: roomId } = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const forcedObserve = pathname.endsWith("/observe");
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [uid, setUid] = useState<string | null>(null);
  const [role, setRole] = useState<"host" | "player" | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const advancedVersion = useRef<number | null>(null);

  useEffect(() => {
    let stopRoom: (() => void) | undefined;
    let stopPlayers: (() => void) | undefined;
    let stopMember: (() => void) | undefined;
    void (async () => {
      try {
        const session = await getSession();
        setUid(session.uid);
        const db = getDatabase(session.firebaseApp);
        stopRoom = onValue(ref(db, `v3/rooms/${roomId}`), (snapshot) => {
          const value = snapshot.val() as Room | null;
          if (!value) setError("Το δωμάτιο δεν βρέθηκε ή έχει λήξει.");
          setRoom(value);
        }, () => setError("Δεν έχετε πρόσβαση σε αυτό το δωμάτιο."));
        stopPlayers = onValue(ref(db, `v3/players/${roomId}`), (snapshot) => setPlayers(snapshot.val() || {}), () => setError("Δεν φορτώθηκαν οι παίκτες."));
        stopMember = onValue(ref(db, `v3/members/${roomId}/${session.uid}`), (snapshot) => {
          const value = snapshot.val();
          setRole(value?.role || null);
          if (!snapshot.exists()) setError("Δεν είστε μέλος αυτού του δωματίου.");
        });
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Αδυναμία ασφαλούς σύνδεσης."); }
    })();
    return () => { stopRoom?.(); stopPlayers?.(); stopMember?.(); };
  }, [roomId]);

  // Firebase listeners give instant updates; this authenticated no-cache sync is
  // the reliability backstop for browsers that suspend or lose a websocket.
  useEffect(() => {
    let cancelled = false;
    async function refreshState() {
      try {
        const state = await secureRequest(`/api/rooms/${roomId}/state`, { method: "GET" });
        if (cancelled) return;
        setRoom(state.room as Room);
        setPlayers(state.players as Record<string, Player>);
        setRole(state.role as "host" | "player");
      } catch (cause) {
        if (cancelled) return;
        const message = cause instanceof Error ? cause.message : "Αδυναμία συγχρονισμού παιχνιδιού.";
        if (message.includes("δεν βρέθηκε") || message.includes("έχει λήξει")) setRoom(null);
        setError(message);
      }
    }
    void refreshState();
    const interval = window.setInterval(() => void refreshState(), 2_000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [roomId]);

  useEffect(() => {
    const tick = () => setSeconds(room?.phaseEndsAt ? Math.max(0, Math.ceil((room.phaseEndsAt - Date.now()) / 1000)) : 0);
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [room?.phaseEndsAt]);

  useEffect(() => { setSelected(null); advancedVersion.current = null; }, [room?.round]);

  useEffect(() => {
    if (!room?.phaseEndsAt || room.phase === "lobby" || room.phase === "finished" || seconds > 0 || Date.now() < room.phaseEndsAt + 750 || advancedVersion.current === room.version) return;
    advancedVersion.current = room.version;
    void secureRequest(`/api/rooms/${roomId}/advance`, { method: "POST", body: JSON.stringify({ expectedVersion: room.version }) })
      .then((result) => {
        if (!result.advanced) window.setTimeout(() => { if (advancedVersion.current === room.version) advancedVersion.current = null; }, 1000);
      })
      .catch((cause) => {
        const message = cause instanceof Error ? cause.message : "Δεν έγινε η μετάβαση φάσης.";
        if (message.includes("δεν βρέθηκε") || message.includes("έχει λήξει")) setRoom(null);
        setError(message);
      });
  }, [room, roomId, seconds]);

  const list = useMemo(() => Object.entries(players).map(([id, player]) => ({ id, ...player })), [players]);
  const ranking = useMemo(() => [...list].filter((player) => player.participates).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "el")), [list]);
  const me = uid ? players[uid] : undefined;
  const question = room?.questions[room.questionIndex];
  const isObserver = forcedObserve || !me?.participates;
  const answered = list.filter((player) => player.participates && player.answeredRound === room?.round).length;
  const participants = list.filter((player) => player.participates);
  const myAnswered = Boolean(me && room && me.answeredRound === room.round);

  async function action(path: string, body: unknown = {}) {
    setBusy(true); setError("");
    try { return await secureRequest(path, { method: "POST", body: JSON.stringify(body) }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Η ενέργεια απέτυχε."); return null; }
    finally { setBusy(false); }
  }

  async function submitAnswer(answerId: string) {
    if (!room || isObserver || busy || selected || myAnswered) return;
    setSelected(answerId);
    const result = await action(`/api/rooms/${roomId}/answer`, { answerId });
    if (!result) { setSelected(null); return; }
    // The last answer may end the question early; the server verifies this.
    void secureRequest(`/api/rooms/${roomId}/advance`, { method: "POST", body: JSON.stringify({ expectedVersion: room.version }) }).catch(() => undefined);
  }

  async function copyCode() {
    if (!room) return;
    try { await navigator.clipboard.writeText(room.code); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }
    catch { setError("Δεν αντιγράφηκε ο κωδικός. Επιλέξτε τον χειροκίνητα."); }
  }

  if (error && !room) return <main className="flex min-h-screen items-center justify-center bg-amber-50 p-4"><section className="max-w-md rounded-2xl bg-white p-6 text-center shadow-xl"><p className="font-semibold text-red-700">{error}</p><button onClick={() => router.push("/join-room")} className="mt-5 rounded-xl bg-purple-700 px-5 py-3 font-bold text-white">Είσοδος σε δωμάτιο</button></section></main>;
  if (!room || !role) return <main className="flex min-h-screen items-center justify-center bg-amber-50 text-xl font-bold text-amber-900">Ασφαλής φόρτωση…</main>;

  const purple = isObserver;
  const shell = purple ? "from-purple-50 via-purple-100 to-indigo-100 dark:from-purple-950 dark:via-purple-900" : "from-amber-50 via-yellow-100 to-orange-100 dark:from-amber-950 dark:via-yellow-950";
  const headerColor = purple ? "bg-purple-800" : "bg-amber-800";
  const questionColors = ["bg-red-600 hover:bg-red-700", "bg-blue-600 hover:bg-blue-700", "bg-yellow-500 hover:bg-yellow-600", "bg-green-600 hover:bg-green-700"];

  return <main className={`min-h-screen bg-gradient-to-br ${shell}`}>
    <header className={`sticky top-0 z-10 ${headerColor} p-4 text-white shadow-lg`}><div className="mx-auto flex max-w-6xl items-center justify-between gap-4"><div><h1 className="text-lg font-black sm:text-2xl">{isObserver ? "👁️ Λειτουργία παρατήρησης host" : "🏰 Quiz της Άλωσης"}</h1><p className="text-xs opacity-90">Δωμάτιο {room.code} · {phaseTitle[room.phase]}</p></div>{room.phaseEndsAt && <div className="rounded-xl bg-white/15 px-4 py-2 text-center"><b className="text-2xl tabular-nums">{seconds}</b><span className="ml-1 text-sm">δευτ.</span></div>}</div></header>
    <section className="mx-auto max-w-5xl p-4 pb-10 sm:p-6">
      {error && <p className="mb-4 rounded-xl border border-red-400 bg-red-100 p-3 font-semibold text-red-800">{error}</p>}
      {room.phase === "lobby" && <section className="mx-auto max-w-2xl text-center"><div className="text-6xl">⏳</div><h2 className="mt-3 text-3xl font-black text-amber-950 dark:text-amber-100">Έτοιμοι για το παιχνίδι;</h2><p className="mt-2 text-amber-900 dark:text-amber-200">Δώστε τον κωδικό στους παίκτες και ξεκινήστε όταν είστε έτοιμοι.</p><button onClick={() => void copyCode()} className="mt-5 rounded-2xl border-2 border-amber-700 bg-amber-100 px-8 py-4 font-mono text-4xl font-black tracking-[0.2em] text-amber-950 shadow-lg">{copied ? "ΑΝΤΙΓΡΑΦΗΚΕ" : room.code}</button>
        <div className="mt-6 rounded-2xl bg-white p-5 text-left shadow-xl dark:bg-stone-900"><h3 className="text-lg font-black">Παίκτες ({list.length})</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{list.map((player) => <div key={player.id} className="flex items-center justify-between rounded-xl bg-amber-100 p-3 text-amber-950"><span>{player.name}{player.id === uid ? " (εσύ)" : ""}</span><b className="text-xs">{player.id === uid && role === "host" ? "HOST" : player.participates ? "ΠΑΙΖΕΙ" : "ΠΑΡΑΤΗΡΕΙ"}</b></div>)}</div></div>
        {role === "host" && <div className="mt-6 rounded-2xl bg-white p-5 shadow-xl dark:bg-stone-900"><h3 className="font-black">Ρυθμίσεις host</h3><button disabled={busy} onClick={() => void action(`/api/rooms/${roomId}/participation`, { participates: !me?.participates })} className="mt-3 rounded-xl bg-purple-700 px-5 py-3 font-bold text-white">{me?.participates ? "👁️ Παρατήρηση αντί για συμμετοχή" : "🎮 Συμμετοχή στο παιχνίδι"}</button><p className="mt-3 text-sm">{participants.length ? `${participants.length} ενεργός παίκτης${participants.length === 1 ? "" : "ες"}.` : "Επίλεξε συμμετοχή ή περίμενε παίκτη."}</p><button disabled={busy || !participants.length} onClick={() => void action(`/api/rooms/${roomId}/start`)} className="mt-4 w-full rounded-xl bg-gradient-to-r from-green-600 to-green-800 p-4 text-lg font-black text-white disabled:opacity-50">🚀 Έναρξη παιχνιδιού</button><button onClick={() => router.push(forcedObserve ? `/room/${roomId}` : `/room/${roomId}/observe`)} className="mt-4 text-sm font-bold text-purple-700 underline">{forcedObserve ? "Λειτουργία συμμετοχής" : "Λειτουργία παρατήρησης"}</button></div>}
      </section>}
      {room.phase === "question" && question && <section className="mx-auto max-w-4xl"><div className="mb-5 flex items-center justify-between"><span className="rounded-full bg-white px-4 py-2 font-black shadow">Ερώτηση {room.questionIndex + 1}/{room.questions.length}</span><span className="font-bold">{answered}/{participants.length} απάντησαν</span></div><article className="rounded-3xl bg-white p-5 shadow-2xl sm:p-8 dark:bg-stone-900"><h2 className="text-center text-2xl font-black text-stone-900 sm:text-3xl dark:text-white">{question.text}</h2><div className="mt-7 grid gap-3 md:grid-cols-2">{question.answers.map((answer, index) => <button key={answer.id} disabled={isObserver || busy || Boolean(selected) || myAnswered} onClick={() => void submitAnswer(answer.id)} className={`${questionColors[index % questionColors.length]} min-h-28 rounded-2xl p-5 text-left text-lg font-black text-white shadow-lg transition disabled:cursor-default disabled:opacity-60 ${selected === answer.id ? "ring-4 ring-white" : ""}`}><span className="mr-3 text-2xl opacity-80">{["▲", "◆", "●", "■"][index]}</span>{answer.text}</button>)}</div>{isObserver ? <p className="mt-6 text-center font-bold text-purple-700">Λειτουργία παρατήρησης: οι απαντήσεις είναι κλειδωμένες.</p> : myAnswered || selected ? <p className="mt-6 text-center font-bold text-green-700">✓ Η απάντησή σας καταχωρίστηκε. Οι ταχύτερες σωστές απαντήσεις δίνουν περισσότερους πόντους.</p> : <p className="mt-6 text-center text-sm text-stone-600">Διαλέξτε μία απάντηση πριν μηδενίσει ο χρόνος.</p>}</article><section className="mt-5 rounded-2xl bg-white p-5 shadow-xl dark:bg-stone-900"><div className="flex items-center justify-between"><h3 className="font-black">⚡ Ζωντανή κατάσταση</h3><span className="text-sm font-bold">{answered}/{participants.length}</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{ranking.map((player, index) => <div key={player.id} className={`flex items-center justify-between rounded-xl p-3 ${index === 0 ? "bg-yellow-200 text-amber-950" : "bg-stone-100 text-stone-900"}`}><span><b className="mr-2">{index + 1}</b>{player.name}</span><span className="font-black">{player.score.toLocaleString("el-GR")} pts {player.answeredRound === room.round ? "✓" : "…"}</span></div>)}</div></section></section>}
      {room.phase === "reveal" && question && <section className="mx-auto max-w-3xl text-center"><p className="font-bold text-purple-800">Η σωστή απάντηση είναι:</p><h2 className="mt-3 text-3xl font-black">{question.text}</h2><div className="mt-6 grid gap-3">{question.answers.map((answer) => <div key={answer.id} className={`rounded-2xl p-5 text-left text-lg font-bold shadow ${answer.id === room.revealCorrectAnswerId ? "bg-green-600 text-white" : "bg-white text-stone-500"}`}>{answer.id === room.revealCorrectAnswerId ? "✓ " : ""}{answer.text}</div>)}</div></section>}
      {(room.phase === "scoreboard" || room.phase === "finished") && <section className="mx-auto max-w-2xl text-center"><div className="text-6xl">{room.phase === "finished" ? "🏆" : "📜"}</div><h2 className="mt-3 text-3xl font-black">{room.phase === "finished" ? "Τελική κατάταξη" : "Κατάταξη γύρου"}</h2><div className="mt-6 space-y-3">{ranking.map((player, index) => <div key={player.id} className={`flex items-center justify-between rounded-2xl p-4 text-left shadow ${index === 0 ? "bg-yellow-300" : "bg-white"}`}><span><b className="mr-3 text-xl">{index + 1}</b>{player.name}</span><b>{player.score.toLocaleString("el-GR")} pts</b></div>)}</div>{room.phase === "finished" && <button onClick={() => router.push("/")} className="mt-7 rounded-xl bg-amber-700 px-6 py-4 font-black text-white">Νέο παιχνίδι</button>}</section>}
    </section>
  </main>;
}
