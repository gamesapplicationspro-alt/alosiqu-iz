"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { getDatabase, onValue, ref } from "firebase/database";
import { getSession, secureRequest } from "../../lib/session";

type Answer = { id: string; text: string };
type Question = { id: string; text: string; answers: Answer[] };
type Room = { id: string; code: string; status: "waiting" | "active" | "finished"; currentQuestionIndex: number; questions: Question[]; questionDeadlineAt: number | null };
type Player = { name: string; score: number; answeredQuestionIndex: number };

export default function RoomPage() {
  const { id: roomId } = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const observing = pathname.endsWith("/observe");
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [role, setRole] = useState<"host" | "player" | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(15);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const advancing = useRef(false);

  useEffect(() => {
    let stopRoom: (() => void) | undefined;
    let stopPlayers: (() => void) | undefined;
    let stopMember: (() => void) | undefined;
    void (async () => {
      try {
        const session = await getSession();
        setUid(session.uid);
        const db = getDatabase(session.firebaseApp);
        stopRoom = onValue(ref(db, "v2/rooms/" + roomId), (snapshot) => {
          const value = snapshot.val() as Room | null;
          if (!value) setError("Δωμάτιο δεν βρέθηκε ή έχει λήξει.");
          setRoom(value);
        }, () => setError("Δεν έχετε πρόσβαση σε αυτό το δωμάτιο."));
        stopPlayers = onValue(ref(db, "v2/players/" + roomId), (snapshot) => setPlayers(snapshot.val() || {}));
        stopMember = onValue(ref(db, "v2/members/" + roomId + "/" + session.uid), (snapshot) => {
          setRole(snapshot.val()?.role || null);
          if (!snapshot.exists()) setError("Δεν είστε μέλος αυτού του δωματίου.");
        });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Αδυναμία ασφαλούς σύνδεσης.");
      }
    })();
    return () => { stopRoom?.(); stopPlayers?.(); stopMember?.(); };
  }, [roomId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (room?.questionDeadlineAt) setSeconds(Math.max(0, Math.ceil((room.questionDeadlineAt - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(interval);
  }, [room?.questionDeadlineAt]);

  useEffect(() => { setSelectedAnswer(null); advancing.current = false; }, [room?.currentQuestionIndex]);

  useEffect(() => {
    if (role !== "host" || room?.status !== "active" || seconds > 0 || advancing.current) return;
    advancing.current = true;
    void secureRequest("/api/rooms/" + roomId + "/advance", { method: "POST", body: "{}" })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Αδυναμία συνέχισης παιχνιδιού."))
      .finally(() => { advancing.current = false; });
  }, [roomId, role, room?.status, seconds]);

  const playerList = useMemo(() => Object.entries(players).map(([id, player]) => ({ id, ...player })), [players]);
  const ranking = useMemo(() => [...playerList].sort((a, b) => b.score - a.score), [playerList]);
  const currentPlayer = uid ? players[uid] : undefined;
  const question = room?.questions[room.currentQuestionIndex];
  const nonHostPlayers = playerList.filter((player) => !(player.id === uid && role === "host"));
  const answered = playerList.filter((player) => player.answeredQuestionIndex === room?.currentQuestionIndex).length;

  async function action(path: string, body: unknown = {}) {
    setBusy(true); setError(null);
    try { await secureRequest(path, { method: "POST", body: JSON.stringify(body) }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Η ενέργεια απέτυχε."); }
    finally { setBusy(false); }
  }

  async function submit(answerId: string) {
    if (!room || observing || selectedAnswer || currentPlayer?.answeredQuestionIndex === room.currentQuestionIndex) return;
    setSelectedAnswer(answerId);
    await action("/api/rooms/" + roomId + "/answer", { answerId });
  }

  if (error && !room) return <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 via-yellow-100 to-orange-50 p-4"><div className="parchment-bg rounded-lg p-6 text-center"><p className="text-red-700">{error}</p><button onClick={() => router.push("/join-room")} className="mt-4 rounded-lg bg-purple-700 px-4 py-2 text-white">Επιστροφή</button></div></div>;
  if (!room || !role) return <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 via-yellow-100 to-orange-50"><p className="text-xl text-amber-900">Φόρτωση...</p></div>;

  const shell = observing ? "bg-gradient-to-br from-purple-50 via-purple-100 to-purple-50 dark:from-purple-900 dark:via-purple-900 dark:to-purple-900" : "bg-gradient-to-br from-amber-50 via-yellow-100 to-orange-50 dark:from-amber-900 dark:via-yellow-900 dark:to-orange-900";
  const header = observing ? "bg-purple-800 dark:bg-purple-950" : "bg-amber-800 dark:bg-amber-950";
  return <div className={"flex min-h-screen flex-col " + shell}>
    <header className={header + " p-4 text-white shadow-lg"}><div className="mx-auto flex max-w-6xl items-center justify-between"><div><h1 className="text-xl font-bold">{observing ? "👁️ Λειτουργία Παρατήρησης Host" : "🏰 Quiz της Άλωσης"}</h1><p className="text-sm opacity-80">Δωμάτιο: {room.code}</p></div><div className="text-center"><div className="text-2xl font-bold">{room.status === "active" ? seconds + "s" : "⏳"}</div><div className="text-xs">{room.status === "active" ? "Χρόνος" : "Αναμονή"}</div></div></div></header>
    <main className="flex-1 p-4 sm:p-6 lg:p-8">
      {error && <div className="mx-auto mb-5 max-w-4xl rounded-lg border border-red-400 bg-red-100 p-3 text-red-700">{error}</div>}
      {room.status === "waiting" && <section className="mx-auto max-w-3xl text-center"><div className="mb-4 text-6xl animate-pulse">⏳</div><h2 className="mb-4 text-2xl font-bold text-amber-900 dark:text-amber-100">Αναμονή Έναρξης Παιχνιδιού</h2><div className="parchment-bg mb-6 rounded-lg p-6 shadow-xl"><p className="mb-3 text-amber-900 dark:text-amber-100">Κωδικός δωματίου</p><div className="text-3xl font-bold tracking-widest text-amber-900 dark:text-amber-100">{room.code}</div></div><div className="rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"><h3 className="mb-4 text-lg font-bold text-amber-900 dark:text-amber-100">Παίκτες στο Δωμάτιο ({playerList.length})</h3><div className="space-y-2">{playerList.map((player) => <div key={player.id} className="flex items-center justify-between rounded-lg bg-amber-100 p-3 dark:bg-amber-900"><span className="font-medium">{player.name}{player.id === uid && " (εσύ)"}</span><span className="rounded-full bg-amber-700 px-2 py-1 text-xs text-white">{player.id === uid && role === "host" ? "HOST" : "Παίκτης"}</span></div>)}</div></div>
        {role === "host" && <div className="mt-6 space-y-4"><p className="text-sm text-amber-800 dark:text-amber-200">{nonHostPlayers.length >= 2 ? "✅ Έτοιμοι για παιχνίδι!" : "⏳ Χρειάζονται " + (2 - nonHostPlayers.length) + " ακόμη παίκτες"}</p><button disabled={busy || nonHostPlayers.length < 2} onClick={() => void action("/api/rooms/" + roomId + "/start")} className="rounded-lg bg-gradient-to-r from-green-600 to-green-800 px-8 py-4 text-lg font-bold text-white shadow-lg transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50">🚀 Ξεκίνα Παιχνίδι</button><div><button onClick={() => router.push(observing ? "/room/" + roomId : "/room/" + roomId + "/observe")} className="text-purple-700 underline">{observing ? "← Participate Mode" : "👁️ Observe Mode"}</button></div></div>}
      </section>}
      {room.status === "active" && question && <section className="mx-auto max-w-4xl"><div className={(observing ? "bg-purple-200 dark:bg-purple-800" : "parchment-bg") + " mb-6 rounded-xl p-6 shadow-xl"}><div className="mb-6 text-center"><span className={(observing ? "bg-purple-600" : "bg-amber-700") + " rounded-full px-4 py-2 text-sm font-bold text-white"}>Ερώτηση {room.currentQuestionIndex + 1} / {room.questions.length}</span></div><h2 className="mb-8 text-center text-xl font-bold text-amber-900 dark:text-amber-100 sm:text-2xl">{question.text}</h2><div className="grid grid-cols-1 gap-4 md:grid-cols-2">{question.answers.map((answer, index) => <button key={answer.id} disabled={observing || busy || Boolean(selectedAnswer) || currentPlayer?.answeredQuestionIndex === room.currentQuestionIndex} onClick={() => void submit(answer.id)} className={(selectedAnswer === answer.id ? "border-green-500 bg-green-100" : "border-amber-300 bg-white hover:border-amber-600 hover:bg-amber-50") + " rounded-lg border-2 p-4 text-left text-lg font-medium shadow transition disabled:cursor-default disabled:opacity-70"}><b>{String.fromCharCode(65 + index)}.</b> {answer.text}</button>)}</div>{!observing && (selectedAnswer || currentPlayer?.answeredQuestionIndex === room.currentQuestionIndex) && <p className="mt-5 text-center font-semibold text-green-700">✓ Η απάντησή σας καταχωρίστηκε.</p>}</div>
        {observing && <div className="rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800"><h3 className="mb-4 text-lg font-bold text-purple-900 dark:text-purple-100">Κατάσταση Παικτών</h3><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{playerList.map((player) => { const answeredPlayer = player.answeredQuestionIndex === room.currentQuestionIndex; return <div key={player.id} className={(answeredPlayer ? "border-green-500 bg-green-100" : "border-gray-300 bg-gray-100") + " rounded-lg border-2 p-4"}><div className="flex justify-between"><span>{player.name}</span><span className={(answeredPlayer ? "bg-green-600" : "bg-yellow-600") + " rounded-full px-2 py-1 text-xs font-bold text-white"}>{answeredPlayer ? "Απάντησε" : "Σκέφτεται"}</span></div></div>})}</div><div className="mt-6 grid grid-cols-3 gap-4 rounded-lg bg-purple-100 p-4 text-center dark:bg-purple-900"><div><b>{playerList.length}</b><p className="text-sm">Παίκτες</p></div><div><b>{answered}</b><p className="text-sm">Απάντησαν</p></div><div><b>{playerList.length ? Math.round((answered / playerList.length) * 100) : 0}%</b><p className="text-sm">Πρόοδος</p></div></div></div>}
      </section>}
      {room.status === "finished" && <section className="mx-auto max-w-2xl py-8 text-center"><div className="mb-4 text-6xl">🏆</div><h2 className="mb-6 text-3xl font-bold text-amber-900 dark:text-amber-100">Το Παιχνίδι Ολοκληρώθηκε!</h2><div className="rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800"><h3 className="mb-5 text-xl font-bold">Τελική Κατάταξη</h3><div className="space-y-3">{ranking.map((player, index) => <div key={player.id} className={(index === 0 ? "bg-yellow-200" : index === 1 ? "bg-gray-200" : index === 2 ? "bg-orange-200" : "bg-amber-50") + " flex items-center justify-between rounded-lg p-4"}><span><b className="mr-3">{index + 1}</b>{player.name}</span><b>{player.score} pts</b></div>)}</div></div></section>}
    </main>
    <footer className={header + " p-4 text-center text-sm text-white"}>{observing ? "🔍 Λειτουργία Παρατήρησης - Ο Host δεν συμμετέχει ενεργά στο παιχνίδι" : "Quiz της Άλωσης της Κωνσταντινούπολης"}</footer>
  </div>;
}
