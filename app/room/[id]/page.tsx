"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { getDatabase, onValue, ref } from "firebase/database";
import { getSession, secureRequest } from "../../lib/session";

type Answer = { id: string; text: string };
type Question = { id: string; text: string; answers: Answer[] };
type Room = {
  id: string; code: string; status: "waiting" | "active" | "finished";
  currentQuestionIndex: number; questions: Question[]; expiresAt: number;
  questionDeadlineAt: number | null;
};
type Player = { name: string; score: number; answeredQuestionIndex: number };

export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const observing = pathname.endsWith("/observe");
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [role, setRole] = useState<"host" | "player" | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(15);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const advancing = useRef(false);

  useEffect(() => {
    let stopRoom: (() => void) | undefined;
    let stopPlayers: (() => void) | undefined;
    let stopMember: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      try {
        const session = await getSession();
        if (cancelled) return;
        setUid(session.uid);
        const db = getDatabase(session.firebaseApp);
        stopRoom = onValue(ref(db, `v2/rooms/${id}`), (snapshot) => {
          const value = snapshot.val() as Room | null;
          if (!value) setError("Το δωμάτιο δεν βρέθηκε ή έχει λήξει.");
          setRoom(value);
        }, () => setError("Δεν έχετε πρόσβαση σε αυτό το δωμάτιο."));
        stopPlayers = onValue(ref(db, `v2/players/${id}`), (snapshot) => setPlayers(snapshot.val() || {}));
        stopMember = onValue(ref(db, `v2/members/${id}/${session.uid}`), (snapshot) => {
          setRole(snapshot.val()?.role || null);
          if (!snapshot.exists()) setError("Δεν είστε μέλος αυτού του δωματίου.");
        });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Αδυναμία ασφαλούς σύνδεσης.");
      }
    })();
    return () => { cancelled = true; stopRoom?.(); stopPlayers?.(); stopMember?.(); };
  }, [id]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!room?.questionDeadlineAt) return;
      setSeconds(Math.max(0, Math.ceil((room.questionDeadlineAt - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(timer);
  }, [room?.questionDeadlineAt]);

  useEffect(() => {
    setSelected(null);
    advancing.current = false;
  }, [room?.currentQuestionIndex]);

  useEffect(() => {
    if (role !== "host" || room?.status !== "active" || seconds > 0 || advancing.current) return;
    advancing.current = true;
    void secureRequest(`/api/rooms/${id}/advance`, { method: "POST", body: "{}" })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Αδυναμία συνέχισης παιχνιδιού."))
      .finally(() => { advancing.current = false; });
  }, [id, role, room?.status, seconds]);

  const orderedPlayers = useMemo(() => Object.entries(players)
    .sort(([, a], [, b]) => b.score - a.score), [players]);
  const currentQuestion = room?.questions[room.currentQuestionIndex];
  const currentPlayer = uid ? players[uid] : undefined;

  async function action(path: string, body: unknown = {}) {
    setBusy(true); setError(null);
    try { await secureRequest(path, { method: "POST", body: JSON.stringify(body) }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Η ενέργεια απέτυχε."); }
    finally { setBusy(false); }
  }

  async function submitAnswer(answerId: string) {
    if (observing || !room || selected || currentPlayer?.answeredQuestionIndex === room.currentQuestionIndex) return;
    setSelected(answerId);
    await action(`/api/rooms/${id}/answer`, { answerId });
  }

  if (error && !room) return <main className="min-h-screen pattern-greek-key grid place-items-center p-6"><div className="error-parchment p-6 text-center"><p>{error}</p><button className="bronze-button mt-4 px-4 py-2" onClick={() => router.push("/join-room")}>Επιστροφή</button></div></main>;
  if (!room || !role) return <main className="min-h-screen pattern-greek-key grid place-items-center"><p className="greek-subtitle">Ασφαλής σύνδεση στο δωμάτιο…</p></main>;

  return (
    <main className="min-h-screen pattern-greek-key p-4 md:p-8">
      <section className="max-w-5xl mx-auto">
        <header className="marble-bg p-5 md:p-7 text-center">
          <p className="greek-subtitle">{observing ? "ΛΕΙΤΟΥΡΓΙΑ ΠΑΡΑΤΗΡΗΣΗΣ" : "ΑΙΘΟΥΣΑ ΑΓΩΝΑ"}</p>
          <h1 className="greek-title text-3xl md:text-5xl mt-2">Κωδικός: {room.code}</h1>
          <p className="mt-3 text-sm">Το δωμάτιο διαγράφεται αυτόματα σε λιγότερο από 24 ώρες.</p>
          {error && <p className="error-parchment mt-3 p-2">{error}</p>}
        </header>

        {room.status === "waiting" && <section className="parchment-bg p-6 mt-6 text-center">
          <h2 className="greek-title text-2xl">Αναμονή παικτών</h2>
          <p className="my-4">Μοιράσου τον κωδικό με την τάξη. Οι μαθητές εισέρχονται από την αρχική σελίδα.</p>
          {role === "host" && <button disabled={busy} onClick={() => void action(`/api/rooms/${id}/start`)} className="gold-button px-8 py-4 disabled:opacity-50">Έναρξη παιχνιδιού</button>}
          {role !== "host" && <p className="greek-subtitle">Περιμένετε τον host να ξεκινήσει.</p>}
        </section>}

        {room.status === "active" && currentQuestion && <section className="parchment-bg p-6 mt-6">
          <div className="flex justify-between gap-4 text-lg font-bold"><span>Ερώτηση {room.currentQuestionIndex + 1}/{room.questions.length}</span><span>⏳ {seconds}s</span></div>
          <h2 className="text-xl md:text-3xl font-bold my-6">{currentQuestion.text}</h2>
          {observing ? <p className="greek-subtitle text-center">Παρατηρείτε ζωντανά — οι απαντήσεις παραμένουν κρυφές.</p> : <div className="grid gap-3 md:grid-cols-2">
            {currentQuestion.answers.map((answer) => <button key={answer.id} disabled={busy || Boolean(selected) || currentPlayer?.answeredQuestionIndex === room.currentQuestionIndex} onClick={() => void submitAnswer(answer.id)} className={`bronze-button p-4 text-left disabled:opacity-60 ${selected === answer.id ? "ring-4 ring-gold" : ""}`}>{answer.text}</button>)}
          </div>}
          {!observing && (selected || currentPlayer?.answeredQuestionIndex === room.currentQuestionIndex) && <p className="mt-5 text-center">Η απάντησή σας καταχωρίστηκε.</p>}
        </section>}

        {room.status === "finished" && <section className="parchment-bg p-6 mt-6 text-center">
          <h2 className="greek-title text-3xl">Ο αγώνας ολοκληρώθηκε</h2>
          <p className="mt-3">Δείτε το προσωπικό σας αποτέλεσμα στο Ιστορικό για τις επόμενες 24 ώρες.</p>
          <button className="gold-button px-6 py-3 mt-5" onClick={() => router.push("/history")}>Προσωπικό ιστορικό</button>
        </section>}

        <section className="marble-bg p-6 mt-6">
          <h2 className="greek-title text-2xl text-center mb-4">Ζωντανή κατάταξη</h2>
          <ol className="space-y-2">{orderedPlayers.map(([playerId, player], index) => <li key={playerId} className="flex justify-between border-b border-stone/30 pb-2"><span>{index + 1}. {player.name}{playerId === uid ? " (εσύ)" : ""}</span><strong>{player.score}</strong></li>)}</ol>
        </section>
      </section>
    </main>
  );
}
