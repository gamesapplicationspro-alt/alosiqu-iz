"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { QUESTIONS } from "../lib/questions";
import { QUESTION_DURATION_MS, REVEAL_DURATION_MS, SCOREBOARD_DURATION_MS, scoreForAnswer, type GamePhase } from "../lib/game-phases";

function shuffledQuestions() {
  return [...QUESTIONS].sort(() => Math.random() - 0.5).map((question) => ({ ...question, answers: [...question.answers].sort(() => Math.random() - 0.5) }));
}

type RoundResult = { questionId: string; correct: boolean; points: number; responseMs: number };

export default function SoloQuiz() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [questions, setQuestions] = useState(QUESTIONS);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<GamePhase>("question");
  const [deadline, setDeadline] = useState(0);
  const [seconds, setSeconds] = useState(20);
  const [now, setNow] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [locked, setLocked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuestions(shuffledQuestions());
      sessionStorage.setItem("soloQuizStartedAt", String(Date.now()));
      setName(localStorage.getItem("playerName") || "Παίκτης");
      setDeadline(Date.now() + QUESTION_DURATION_MS);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const tick = () => { const currentTime = Date.now(); setNow(currentTime); setSeconds(deadline ? Math.max(0, Math.ceil((deadline - currentTime) / 1000)) : QUESTION_DURATION_MS / 1000); };
    tick(); const interval = window.setInterval(tick, 200); return () => window.clearInterval(interval);
  }, [deadline]);
  const question = questions[index];
  const correct = question?.correctAnswerId;
  const finished = phase === "finished";

  function move(nextPhase: GamePhase) {
    setPhase(nextPhase);
    const duration = nextPhase === "reveal" ? REVEAL_DURATION_MS : nextPhase === "scoreboard" ? SCOREBOARD_DURATION_MS : QUESTION_DURATION_MS;
    setDeadline(Date.now() + duration);
  }
  useEffect(() => {
    if (!deadline || seconds > 0 || finished) return;
    const timer = window.setTimeout(() => {
      if (phase === "question") {
        if (!results.some((result) => result.questionId === question?.id) && question) {
          setResults((current) => [...current, { questionId: question.id, correct: false, points: 0, responseMs: QUESTION_DURATION_MS }]);
        }
        move("reveal");
      }
      else if (phase === "reveal") move("scoreboard");
      else if (phase === "scoreboard") {
        if (index + 1 >= questions.length) setPhase("finished");
        else { setIndex((value) => value + 1); setSelected(null); setLocked(null); move("question"); }
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [seconds, phase, deadline, finished, index, questions.length, question, results]);

  useEffect(() => {
    if (!finished || !name || results.length !== questions.length) return;
    const history = JSON.parse(localStorage.getItem("soloQuizHistory") || "[]") as Array<Record<string, unknown>>;
    const sessionId = sessionStorage.getItem("soloQuizStartedAt");
    const alreadySaved = history.some((entry) => entry.sessionId === sessionId);
    if (alreadySaved) return;
    history.unshift({ id: crypto.randomUUID(), sessionId, playerName: name, score, totalQuestions: questions.length, percentage: Math.round((score / (questions.length * 1500)) * 100), date: Date.now(), roomCode: "SOLO", expiresAt: Date.now() + 24 * 60 * 60 * 1000, mode: "solo", results });
    localStorage.setItem("soloQuizHistory", JSON.stringify(history.slice(0, 20)));
  }, [finished, name, questions.length, results, score]);

  const resultText = useMemo(() => `${score.toLocaleString("el-GR")} pts`, [score]);
  function select(answerId: string) {
    if (phase !== "question" || locked) return;
    if (selected !== answerId) {
      setSelected(answerId);
      return;
    }
    const responseMs = Math.min(QUESTION_DURATION_MS, Math.max(0, QUESTION_DURATION_MS - Math.max(0, deadline - now)));
    const points = answerId === correct ? scoreForAnswer(QUESTION_DURATION_MS - responseMs) : 0;
    setResults((current) => [...current, { questionId: question.id, correct: answerId === correct, points, responseMs }]);
    setScore((value) => value + points);
    setLocked(answerId);
  }
  function restart() { sessionStorage.setItem("soloQuizStartedAt", String(Date.now())); setQuestions(shuffledQuestions()); setIndex(0); setSelected(null); setLocked(null); setScore(0); setResults([]); move("question"); }
  const colors = ["bg-red-600", "bg-blue-600", "bg-yellow-500", "bg-green-600"];

  if (finished) return <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-100 via-yellow-50 to-orange-100 p-4"><section className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-2xl"><div className="text-7xl">🏆</div><h1 className="mt-4 text-4xl font-black text-amber-900">Μπράβο, {name}!</h1><p className="mt-3 text-xl">Τελικό σκορ: <b>{resultText}</b></p><div className="mt-6 space-y-2 text-left">{results.map((result, resultIndex) => <div key={result.questionId} className="flex items-center justify-between rounded-xl bg-amber-50 p-3"><span>Ερώτηση {resultIndex + 1} · {result.correct ? "Σωστή" : "Λάθος"}</span><b>{result.points} pts</b></div>)}</div><button onClick={restart} className="mt-7 rounded-xl bg-amber-700 px-6 py-4 font-black text-white">Νέα πρόκληση</button><button onClick={() => router.push("/")} className="ml-3 mt-7 font-bold text-amber-800 underline">Αρχική</button></section></main>;
  return <main className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-100 to-orange-100 p-4 sm:p-8"><section className="mx-auto max-w-4xl"><header className="flex items-center justify-between gap-4 rounded-2xl bg-amber-900 p-4 text-white shadow-lg"><div><p className="text-sm opacity-80">Μοναχική πρόκληση</p><h1 className="text-xl font-black">{name}</h1></div><div className="text-right"><b className="text-3xl tabular-nums">{seconds}</b><span> δευτ.</span></div></header><div className="mt-5 flex justify-between font-bold text-amber-900"><span>Ερώτηση {index + 1}/{questions.length}</span><span>{phase === "question" ? "Διάλεξε απάντηση" : phase === "reveal" ? "Αποκάλυψη απάντησης" : resultText}</span></div>
    {phase === "question" && question && <article className="mt-5 rounded-3xl bg-white p-6 shadow-2xl sm:p-10"><h2 className="text-center text-2xl font-black sm:text-3xl">{question.text}</h2><div className="mt-8 grid gap-3 md:grid-cols-2">{question.answers.map((answer, answerIndex) => <button key={answer.id} disabled={Boolean(locked)} onClick={() => select(answer.id)} className={`${colors[answerIndex]} min-h-28 rounded-2xl p-5 text-left text-lg font-black text-white shadow-lg transition hover:brightness-110 disabled:opacity-60 ${selected === answer.id ? "ring-4 ring-white ring-offset-4" : ""}`}><span className="mr-3 text-2xl">{["▲", "◆", "●", "■"][answerIndex]}</span>{answer.text}{selected === answer.id && <span className={`float-right rounded-lg px-2 py-1 text-xs ${locked ? "bg-green-700" : "bg-black/30"}`}>{locked ? "ΚΛΕΙΔΩΘΗΚΕ" : "ΠΑΤΗΣΕ ΞΑΝΑ ΓΙΑ ΚΛΕΙΔΩΜΑ"}</span>}</button>)}</div>{locked ? <p aria-live="polite" className="mt-6 text-center font-black text-green-700">✓ Η απάντηση κλειδώθηκε.</p> : selected && <p className="mt-6 text-center font-bold text-amber-800">Επιλεγμένη απάντηση: πάτησε ξανά για κλείδωμα.</p>}</article>}
    {phase === "reveal" && question && <article className="mt-5 rounded-3xl bg-white p-6 text-center shadow-2xl"><p className="font-bold text-purple-700">Η σωστή απάντηση</p><h2 className="mt-3 text-2xl font-black">{question.text}</h2><div className="mt-6 space-y-3">{question.answers.map((answer) => <div key={answer.id} className={`rounded-2xl p-4 text-left font-bold ${answer.id === correct ? "bg-green-600 text-white" : "bg-stone-100 text-stone-500"}`}>{answer.id === correct ? "✓ " : ""}{answer.text}</div>)}</div></article>}
    {phase === "scoreboard" && <article className="mt-5 rounded-3xl bg-white p-8 text-center shadow-2xl"><div className="text-6xl">📜</div><h2 className="mt-3 text-3xl font-black">{resultText}</h2><p className="mt-2">Ετοιμαστείτε για την επόμενη ερώτηση…</p></article>}
  </section></main>;
}
