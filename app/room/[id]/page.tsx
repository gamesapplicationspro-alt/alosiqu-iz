"use client";

import React, { useEffect, useState } from "react";
import { ref, onValue, update, push, set, query, orderByChild, equalTo } from "firebase/database";
import { db } from "@/lib/firebase";
import { Room, Player, Question } from "@/types";
import QuestionCard from "@/quiz/components/QuestionCard";
import ProgressBar from "@/quiz/components/ProgressBar";
import ErrorBoundary from "@/quiz/components/ErrorBoundary";

interface RoomPageProps {
  params: { id: string };
  searchParams: { name?: string };
}

export default function RoomPage({ params, searchParams }: RoomPageProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [loading, setLoading] = useState(true);

  const roomId = params.id;
  const playerName = searchParams.name || "Anonymous";

  useEffect(() => {
    // Listen to room changes
    const roomRef = ref(db, `rooms/${roomId}`);
    const unsubscribeRoom = onValue(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const roomData = snapshot.val();
        setRoom({ id: snapshot.key!, ...roomData } as Room);
        setTimeLeft(roomData.timer || 30);
      } else {
        alert("Δωμάτιο δεν βρέθηκε");
      }
      setLoading(false);
    });

    // Listen to players in room using query
    const playersRef = ref(db, "players");
    const playersQuery = query(playersRef, orderByChild("roomId"), equalTo(roomId));
    const unsubscribePlayers = onValue(playersQuery, (snapshot) => {
      const playersData: Player[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          playersData.push({ id: child.key!, ...child.val() } as Player);
        });
      }
      setPlayers(playersData);
      const player = playersData.find(p => p.name === playerName);
      if (player) setCurrentPlayer(player);
    });

    return () => {
      unsubscribeRoom();
      unsubscribePlayers();
    };
  }, [roomId, playerName]);

  useEffect(() => {
    // Add player if not exists
    if (room && !currentPlayer) {
      const newPlayerRef = push(ref(db, "players"));
      const newPlayer: Omit<Player, 'id'> = {
        name: playerName,
        score: 0,
        roomId,
        answers: [],
      };
      set(newPlayerRef, newPlayer);
    }
  }, [room, currentPlayer, playerName, roomId]);

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
      await update(ref(db, `rooms/${roomId}`), { status: 'active' });
    }
  };

  const handleNext = async () => {
    if (!room || !currentPlayer) return;
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
