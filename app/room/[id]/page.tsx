"use client";

import React, { useEffect, useState } from "react";
import { ref, onValue, update, push, set, query, orderByChild, equalTo } from "firebase/database";
import { getDb } from "@/lib/firebase";
import { Room, Player, Question } from "@/types";
import QuestionCard from "@/quiz/components/QuestionCard";
import ProgressBar from "@/quiz/components/ProgressBar";
import ErrorBoundary from "@/quiz/components/ErrorBoundary";

interface RoomPageProps {
  params: { id: string };
  searchParams: { name?: string; playerId?: string };
}

export default function RoomPage({ params, searchParams }: RoomPageProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const roomId = params.id;
  const playerId = searchParams.playerId;
  const playerName = searchParams.name || "Anonymous";

  useEffect(() => {
    if (!roomId || typeof roomId !== "string") return;
    if (playerId) return;

    try {
      const recovered = localStorage.getItem(`roomPlayerId:${roomId}`);
      if (recovered) {
        window.location.replace(`/room/${roomId}?playerId=${encodeURIComponent(recovered)}`);
        return;
      }
    } catch {
      // ignore
    }

    setLoading(false);
    setLoadError("Λείπει το playerId. Μπες ξανά στο δωμάτιο από το Join Room (ή δημιούργησε νέο δωμάτιο).");
  }, [roomId, playerId]);

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => {
      setLoading(false);
      setLoadError((prev) =>
        prev || "Η φόρτωση καθυστέρησε πολύ. Έλεγξε Firebase RTDB Rules (indexes .indexOn) και Vercel env vars."
      );
    }, 8000);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    if (!roomId || typeof roomId !== "string") return;

    let db;
    try {
      db = getDb();
    } catch (err) {
      console.error("Unable to initialize Firebase:", err);
      setLoadError("Λείπουν Firebase env vars στο Vercel ή στο .env.local");
      setLoading(false);
      return;
    }

    // Listen to room changes
    const roomRef = ref(db, `rooms/${roomId}`);
    const unsubscribeRoom = onValue(
      roomRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const roomData = snapshot.val();
          setRoom({ id: snapshot.key!, ...roomData } as Room);
          setTimeLeft(roomData.timer || 30);
        } else {
          alert("Δωμάτιο δεν βρέθηκε");
        }
        setLoading(false);
      },
      (err) => {
        console.error("Room listener error:", err);
        setLoadError("Σφάλμα φόρτωσης δωματίου. Έλεγξε Firebase Rules + indexes (.indexOn). ");
        setLoading(false);
      }
    );

    // Listen to players in room using query
    const playersRef = ref(db, "players");
    const playersQuery = query(playersRef, orderByChild("roomId"), equalTo(roomId));
    const unsubscribePlayers = onValue(
      playersQuery,
      (snapshot) => {
        const playersData: Player[] = [];
        if (snapshot.exists()) {
          snapshot.forEach((child) => {
            playersData.push({ id: child.key!, ...child.val() } as Player);
          });
        }
        setPlayers(playersData);

        if (playerId) {
          const player = playersData.find((p) => p.id === playerId);
          if (player) setCurrentPlayer(player);
        }
      },
      (err) => {
        console.error("Players listener error:", err);
        setLoadError("Σφάλμα φόρτωσης παικτών. Έλεγξε Firebase Rules + indexes (.indexOn). ");
        setLoading(false);
      }
    );

    return () => {
      unsubscribeRoom();
      unsubscribePlayers();
    };
  }, [roomId, playerId]);

  useEffect(() => {
    if (!room) return;
    if (playerId && currentPlayer) return;

    // If someone opened the room URL without playerId, don't crash.
    // We keep the page usable (they can re-join properly from /join-room).
    if (!playerId) return;
  }, [room, playerId, currentPlayer]);

  useEffect(() => {
    // Timer countdown
    if (room?.status === 'active' && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && room?.status === 'active') {
      // Auto-submit or move to next
      handleNext();
    }
  }, [timeLeft, room]);

  const handleSelect = (answerId: string) => {
    setSelectedAnswer(answerId);
  };

  const startGame = async () => {
    if (room && room.hostId === currentPlayer?.id) {
      const db = getDb();
      await update(ref(db, `rooms/${roomId}`), { status: 'active' });
    }
  };

  const handleNext = async () => {
    if (!room || !currentPlayer) return;
    const db = getDb();
    const currentQ = room.questions[room.currentQuestionIndex];
    const isCorrect = selectedAnswer === currentQ.correctAnswerId;
    const newScore = currentPlayer.score + (isCorrect ? 1 : 0);

    // Update player answer and score
    const playerRef = ref(db, `players/${currentPlayer.id}`);
    await update(playerRef, {
      score: newScore,
      answers: [...currentPlayer.answers, {
        questionId: currentQ.id,
        answerId: selectedAnswer || "",
        time: 30 - timeLeft,
      }],
    });

    // Move to next question or finish
    const nextIndex = room.currentQuestionIndex + 1;
    if (nextIndex >= room.questions.length) {
      await update(ref(db, `rooms/${roomId}`), { status: 'finished' });
    } else {
      await update(ref(db, `rooms/${roomId}`), {
        currentQuestionIndex: nextIndex,
        timer: 30,
      });
    }
    setSelectedAnswer(null);
  };

  if (loading) return <div className="flex justify-center items-center min-h-screen">Φόρτωση...</div>;

  if (loadError) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen p-6 text-center">
        <div className="max-w-xl">
          <h1 className="text-2xl font-bold mb-3">Δεν μπόρεσε να φορτώσει το δωμάτιο</h1>
          <p className="mb-3">{loadError}</p>
          <p className="opacity-80 mb-1">roomId: {roomId}</p>
          <p className="opacity-80 mb-6">playerId: {playerId || "(λείπει)"}</p>
          <a className="underline" href="/join-room">Πήγαινε στο Join Room</a>
        </div>
      </div>
    );
  }

  if (!room) return <div>Δωμάτιο δεν βρέθηκε</div>;

  const currentQuestion = room.questions[room.currentQuestionIndex];
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-50 dark:bg-black py-12 px-4">
        <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quiz Section */}
          <div className="lg:col-span-2">
            {room.status === 'waiting' && (
              <div className="text-center p-8">
                <h1 className="text-2xl font-bold mb-4">Αναμονή για έναρξη</h1>
                <p>Κωδικός: {room.code}</p>
                <p>Παίκτες: {players.length}</p>
                {room.hostId === currentPlayer?.id && (
                  <button
                    onClick={startGame}
                    className="mt-4 bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600"
                  >
                    Ξεκίνα Παιχνίδι
                  </button>
                )}
              </div>
            )}
            {room.status === 'active' && currentQuestion && (
              <>
                <ProgressBar current={room.currentQuestionIndex + 1} total={room.questions.length} />
                <div className="text-center mb-4">
                  <p className="text-xl font-semibold">Χρόνος: {timeLeft}s</p>
                </div>
                <QuestionCard
                  question={currentQuestion}
                  onSelect={handleSelect}
                  selectedAnswerId={selectedAnswer}
                />
                <div className="mt-6 flex justify-end">
                  <button
                    className="rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600 disabled:opacity-50"
                    disabled={selectedAnswer === null}
                    onClick={handleNext}
                  >
                    Επόμενο
                  </button>
                </div>
              </>
            )}
            {room.status === 'finished' && (
              <div className="text-center p-8">
                <h1 className="text-3xl font-bold">Τέλος!</h1>
                <p>Το σκορ σου: {currentPlayer?.score || 0}</p>
              </div>
            )}
          </div>

          {/* Leaderboard */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4">Leaderboard</h2>
            <ul>
              {sortedPlayers.map((player, index) => (
                <li key={player.id} className="flex justify-between py-2 border-b">
                  <span>{index + 1}. {player.name}</span>
                  <span>{player.score}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
