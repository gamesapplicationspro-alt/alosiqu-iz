"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import type { GamePhase } from "../../lib/game-phases";
import { getSession, secureRequest } from "../../lib/session";

type Answer = { id: string; text: string };
type Room = { id: string; code: string; phase: GamePhase; questionIndex: number; round: number; version: number; questions: { id: string; text: string; answers: Answer[] }[]; phaseEndsAt: number | null; revealCorrectAnswerId: string | null; paused?: boolean; pausedRemainingMs?: number | null };
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
  const [lockedAnswer, setLockedAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const advancedVersion = useRef<number | null>(null);
  const selectedAnswerRef = useRef<string | null>(null);
  const submittingAnswerRef = useRef(false);
  const uidRef = useRef<string | null>(null);
  const acknowledgedRoundRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getSession()
      .then((session) => {
        if (cancelled) return;
        uidRef.current = session.uid;
        setUid(session.uid);
      })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Αδυναμία ασφαλούς σύνδεσης."); });
    return () => { cancelled = true; };
  }, []);

  // One sequenced, authenticated read loop is more reliable than mixing a
  // websocket listener with polling: stale responses can never overwrite state.
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let inFlight = false;
    async function refreshState() {
      if (inFlight) return;
      inFlight = true;
      try {
        const state = await secureRequest(`/api/rooms/${roomId}/state?at=${Date.now()}`, { method: "GET", cache: "no-store" });
        if (cancelled) return;
        const nextRoom = state.room as Room;
        const nextPlayers = { ...(state.players as Record<string, Player>) };
        const acknowledgedRound = acknowledgedRoundRef.current;
        const currentUid = uidRef.current;
        if (acknowledgedRound !== null && currentUid && nextRoom.round === acknowledgedRound) {
          const incoming = nextPlayers[currentUid];
          if (incoming?.answeredRound === acknowledgedRound) acknowledgedRoundRef.current = null;
          else if (incoming) nextPlayers[currentUid] = { ...incoming, answeredRound: acknowledgedRound };
        }
        setRoom(nextRoom);
        setPlayers(nextPlayers);
        setRole(state.role as "host" | "player");
      } catch (cause) {
        if (cancelled) return;
        const message = cause instanceof Error ? cause.message : "Αδυναμία συγχρονισμού παιχνιδιού.";
        if (message.includes("δεν βρέθηκε") || message.includes("έχει λήξει")) setRoom(null);
        setError(message);
      } finally {
        inFlight = false;
        if (!cancelled) timer = window.setTimeout(refreshState, 1_000);
      }
    }
    void refreshState();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [roomId]);

  useEffect(() => {
    const tick = () => setSeconds(room?.paused ? 0 : room?.phaseEndsAt ? Math.max(0, Math.ceil((room.phaseEndsAt - Date.now()) / 1000)) : 0);
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [room?.phaseEndsAt, room?.paused]);

  useEffect(() => {
    setSelected(null);
    setLockedAnswer(null);
    selectedAnswerRef.current = null;
    submittingAnswerRef.current = false;
    acknowledgedRoundRef.current = null;
    advancedVersion.current = null;
  }, [room?.round]);

  useEffect(() => {
    if (room?.paused || !room?.phaseEndsAt || room.phase === "lobby" || room.phase === "finished" || seconds > 0 || Date.now() < room.phaseEndsAt + 750 || advancedVersion.current === room.version) return;
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
  const winner = ranking[0];
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
    if (!room || isObserver || busy || submittingAnswerRef.current || selectedAnswerRef.current !== answerId || myAnswered) return;
    submittingAnswerRef.current = true;
    try {
      const result = await action(`/api/rooms/${roomId}/answer`, { answerId });
      if (!result) { setSelected(null); selectedAnswerRef.current = null; return; }
      if (!result.accepted) {
        setSelected(null);
        selectedAnswerRef.current = null;
        setError("Ο χρόνος της ερώτησης έληξε. Πάμε στην αποκάλυψη.");
        return;
      }
      setLockedAnswer(answerId);
      acknowledgedRoundRef.current = room.round;
      if (uid) {
        setPlayers((current) => current[uid]
          ? { ...current, [uid]: { ...current[uid], answeredRound: result.answeredRound } }
          : current);
      }
      // The last answer may end the question early; the server verifies this.
      void secureRequest(`/api/rooms/${roomId}/advance`, { method: "POST", body: JSON.stringify({ expectedVersion: room.version }) }).catch(() => undefined);
    } finally {
      submittingAnswerRef.current = false;
    }
  }

  function selectOrSubmitAnswer(answerId: string) {
    if (!room || isObserver || busy || submittingAnswerRef.current || myAnswered) return;
    if (selectedAnswerRef.current !== answerId) {
      selectedAnswerRef.current = answerId;
      setSelected(answerId);
      setError("");
      return;
    }
    selectedAnswerRef.current = answerId;
    void submitAnswer(answerId);
  }

  async function copyCode() {
    if (!room) return;
    try { await navigator.clipboard.writeText(room.code); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }
    catch { setError("Δεν αντιγράφηκε ο κωδικός. Επιλέξτε τον χειροκίνητα."); }
  }

  async function togglePause() {
    if (!room) return;
    await action(`/api/rooms/${roomId}/pause`, { paused: !room.paused, expectedVersion: room.version });
  }

  if (error && !room) return <main className="flex min-h-screen items-center justify-center bg-amber-50 p-4"><section className="max-w-md rounded-2xl bg-white p-6 text-center shadow-xl"><p className="font-semibold text-red-700">{error}</p><button onClick={() => router.push("/join-room")} className="mt-5 rounded-xl bg-purple-700 px-5 py-3 font-bold text-white">Είσοδος σε δωμάτιο</button></section></main>;
  if (!room || !role) return <main className="flex min-h-screen items-center justify-center bg-amber-50 text-xl font-bold text-amber-900">Ασφαλής φόρτωση…</main>;

  const purple = isObserver;
  const shell = purple ? "from-purple-50 via-purple-100 to-indigo-100 dark:from-purple-950 dark:via-purple-900" : "from-amber-50 via-yellow-100 to-orange-100 dark:from-amber-950 dark:via-yellow-950";
  const headerColor = purple ? "bg-purple-800" : "bg-amber-800";
  const questionColors = ["bg-red-600 hover:bg-red-700", "bg-blue-600 hover:bg-blue-700", "bg-yellow-500 hover:bg-yellow-600", "bg-green-600 hover:bg-green-700"];

  return <main className={`min-h-screen bg-gradient-to-br ${shell}`}>
    <header className={`sticky top-0 z-10 ${headerColor} p-4 text-white shadow-lg`}><div className="mx-auto flex max-w-6xl items-center justify-between gap-4"><div><h1 className="text-lg font-black sm:text-2xl">{isObserver ? "👁️ Λειτουργία παρατήρησης host" : "🏰 Quiz Ιστορίας"}</h1><p className="text-xs opacity-90">Δωμάτιο {room.code} · {phaseTitle[room.phase]}{room.paused ? " · Παύση" : ""}</p></div><div className="flex items-center gap-2"><div className="rounded-xl bg-white/15 px-3 py-2 text-center"><b className="block text-lg tabular-nums sm:text-2xl">{(me?.score ?? 0).toLocaleString("el-GR")}</b><span className="text-xs">πόντοι</span></div>{room.phaseEndsAt && !room.paused && <div className="rounded-xl bg-white/15 px-4 py-2 text-center"><b className="text-2xl tabular-nums">{seconds}</b><span className="ml-1 text-sm">δευτ.</span></div>}</div></div></header>
    <section className="mx-auto max-w-5xl p-4 pb-10 sm:p-6">
      {error && <p className="mb-4 rounded-xl border border-red-400 bg-red-100 p-3 font-semibold text-red-800">{error}</p>}
      {role === "host" && (room.phase === "reveal" || room.phase === "scoreboard") && <div className="mb-4 flex justify-end"><button disabled={busy} onClick={() => void togglePause()} className="rounded-xl bg-stone-900 px-4 py-2 font-bold text-white shadow disabled:opacity-50">{room.paused ? "▶ Συνέχιση" : "Ⅱ Παύση παιχνιδιού"}</button></div>}
      {room.phase === "lobby" && <section className="mx-auto max-w-2xl text-center"><div className="text-6xl">⏳</div><h2 className="mt-3 text-3xl font-black text-amber-950 dark:text-amber-100">Έτοιμοι για το παιχνίδι;</h2><p className="mt-2 text-amber-900 dark:text-amber-200">Δώστε τον κωδικό στους παίκτες και ξεκινήστε όταν είστε έτοιμοι.</p><button onClick={() => void copyCode()} className="mt-5 rounded-2xl border-2 border-amber-700 bg-amber-100 px-8 py-4 font-mono text-4xl font-black tracking-[0.2em] text-amber-950 shadow-lg">{copied ? "ΑΝΤΙΓΡΑΦΗΚΕ" : room.code}</button>
        <div className="mt-6 rounded-2xl bg-white p-5 text-left shadow-xl dark:bg-stone-900"><h3 className="text-lg font-black">Παίκτες ({list.length})</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{list.map((player) => <div key={player.id} className="flex items-center justify-between rounded-xl bg-amber-100 p-3 text-amber-950"><span>{player.name}{player.id === uid ? " (εσύ)" : ""}</span><b className="text-xs">{player.id === uid && role === "host" ? "HOST" : player.participates ? "ΠΑΙΖΕΙ" : "ΠΑΡΑΤΗΡΕΙ"}</b></div>)}</div></div>
        {role === "host" && <div className="mt-6 rounded-2xl bg-white p-5 shadow-xl dark:bg-stone-900"><h3 className="font-black">Ρυθμίσεις host</h3><button disabled={busy} onClick={() => void action(`/api/rooms/${roomId}/participation`, { participates: !me?.participates })} className="mt-3 rounded-xl bg-purple-700 px-5 py-3 font-bold text-white">{me?.participates ? "👁️ Παρατήρηση αντί για συμμετοχή" : "🎮 Συμμετοχή στο παιχνίδι"}</button><p className="mt-3 text-sm">{participants.length ? `${participants.length} ενεργός παίκτης${participants.length === 1 ? "" : "ες"}.` : "Επίλεξε συμμετοχή ή περίμενε παίκτη."}</p><button disabled={busy || !participants.length} onClick={() => void action(`/api/rooms/${roomId}/start`)} className="mt-4 w-full rounded-xl bg-gradient-to-r from-green-600 to-green-800 p-4 text-lg font-black text-white disabled:opacity-50">🚀 Έναρξη παιχνιδιού</button><button onClick={() => router.push(forcedObserve ? `/room/${roomId}` : `/room/${roomId}/observe`)} className="mt-4 text-sm font-bold text-purple-700 underline">{forcedObserve ? "Λειτουργία συμμετοχής" : "Λειτουργία παρατήρησης"}</button></div>}
      </section>}
      {room.phase === "question" && question && <section className="mx-auto max-w-4xl"><div className="mb-5 flex items-center justify-between gap-3"><span className="rounded-full bg-white px-4 py-2 font-black shadow">Ερώτηση {room.questionIndex + 1}/{room.questions.length}</span><span aria-live="polite" className="rounded-full bg-amber-900 px-4 py-2 text-sm font-black text-white shadow">Απάντησαν {answered} από {participants.length}</span></div><article className="rounded-3xl bg-white p-5 shadow-2xl sm:p-8 dark:bg-stone-900"><h2 className="text-center text-2xl font-black text-stone-900 sm:text-3xl dark:text-white">{question.text}</h2><div className="mt-7 grid gap-3 md:grid-cols-2">{question.answers.map((answer, index) => { const isSelected = selected === answer.id; const isLocked = lockedAnswer === answer.id || (myAnswered && isSelected); return <button key={answer.id} disabled={isObserver || busy || myAnswered} onClick={() => selectOrSubmitAnswer(answer.id)} className={`${questionColors[index % questionColors.length]} relative min-h-28 rounded-2xl p-5 text-left text-lg font-black text-white shadow-lg transition disabled:cursor-default disabled:opacity-60 ${isSelected ? "ring-4 ring-white ring-offset-4" : ""}`}><span className="mr-3 text-2xl opacity-80">{["▲", "◆", "●", "■"][index]}</span>{answer.text}{isSelected && <span className={`absolute right-3 top-3 rounded-lg border-2 border-white px-3 py-1 text-xs font-black tracking-wide shadow ${isLocked ? "bg-green-700" : "bg-black/30"}`}>{isLocked ? "ΚΛΕΙΔΩΘΗΚΕ" : "ΠΑΤΗΣΕ ΞΑΝΑ ΓΙΑ ΚΛΕΙΔΩΜΑ"}</span>}</button>; })}</div>{selected && !myAnswered && !isObserver && <p className="mt-6 text-center font-bold text-amber-800">Επιλεγμένη απάντηση: πάτησε ξανά την ίδια επιλογή για κλείδωμα.</p>}{myAnswered && <p className="mt-6 text-center font-black text-green-700">Η απάντησή σου κλειδώθηκε. Περιμένουμε τους υπόλοιπους παίκτες.</p>}{isObserver && <p className="mt-6 text-center font-bold text-purple-700">Λειτουργία παρατήρησης: οι απαντήσεις είναι κλειδωμένες.</p>}</article></section>}
      {room.phase === "reveal" && question && <section className="mx-auto max-w-3xl text-center"><p className="font-bold text-purple-800">Η σωστή απάντηση είναι:</p><h2 className="mt-3 text-3xl font-black">{question.text}</h2><div className="mt-6 grid gap-3">{question.answers.map((answer) => <div key={answer.id} className={`rounded-2xl p-5 text-left text-lg font-bold shadow ${answer.id === room.revealCorrectAnswerId ? "bg-green-600 text-white" : "bg-white text-stone-500"}`}>{answer.id === room.revealCorrectAnswerId ? "✓ " : ""}{answer.text}</div>)}</div></section>}
      {(room.phase === "scoreboard" || room.phase === "finished") && <section className="mx-auto max-w-2xl text-center"><div className="text-6xl">{room.phase === "finished" ? "🏆" : "📜"}</div>{room.phase === "finished" && winner && <div className="mt-4 rounded-3xl bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-300 p-6 text-amber-950 shadow-2xl"><p className="text-sm font-black uppercase tracking-widest">Ο νικητής είναι</p><h2 className="mt-2 text-4xl font-black sm:text-5xl">🎉 {winner.name}! 🎉</h2><p className="mt-2 text-lg font-bold">Με {winner.score.toLocaleString("el-GR")} πόντους</p></div>}<h2 className="mt-5 text-3xl font-black">{room.phase === "finished" ? "Τελική κατάταξη" : "Κατάταξη γύρου"}</h2><div className="mt-6 space-y-3">{ranking.map((player, index) => <div key={player.id} className={`flex items-center justify-between rounded-2xl p-4 text-left shadow ${index === 0 ? "bg-yellow-300" : "bg-white"}`}><span><b className="mr-3 text-xl">{index + 1}</b>{player.name}</span><b>{player.score.toLocaleString("el-GR")} pts</b></div>)}</div>{room.phase === "finished" && <button onClick={() => router.push("/")} className="mt-7 rounded-xl bg-amber-700 px-6 py-4 font-black text-white">Νέο παιχνίδι</button>}</section>}
    </section>
  </main>;
}
