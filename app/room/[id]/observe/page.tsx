"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ref, onValue, query, orderByChild, equalTo, update, off } from "firebase/database";
import { getDb } from "@/lib/firebase";
import { Room, Player, Question } from "@/types";

export default function ObservePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params.id as string;
  const playerId = searchParams.get("playerId") || undefined;

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [timeLeft, setTimeLeft] = useState(15);
  const [loading, setLoading] = useState(true);
  const [revealAnswer, setRevealAnswer] = useState(false);
  const [countdownToNext, setCountdownToNext] = useState(0);

  // Start game function
  const startGame = async () => {
    if (!room || !currentPlayer?.isHost) return;
    
    try {
      const db = await getDb();
      const roomRef = ref(db, `rooms/${roomId}`);
      
      // Reset all players' hasAnswered status
      const playersRef = ref(db, "players");
      const playersQuery = query(playersRef, orderByChild("roomId"), equalTo(roomId));
      
      onValue(playersQuery, (snapshot) => {
        if (snapshot.exists()) {
          snapshot.forEach((child) => {
            update(ref(db, `players/${child.key}`), { hasAnswered: false });
          });
        }
      }, { onlyOnce: true });

      // Start the game
      await update(roomRef, { status: "active" });
    } catch (error) {
      console.error("Error starting game:", error);
    }
  };

  useEffect(() => {
    if (!roomId || typeof roomId !== "string") return;
    if (!playerId) return;

    let db;
    let roomUnsubscribe: (() => void) | null = null;
    let playersUnsubscribe: (() => void) | null = null;

    const setupListeners = async () => {
      try {
        const db = await getDb();
        
        // Listen to room changes
        const roomRef = ref(db, `rooms/${roomId}`);
        roomUnsubscribe = onValue(
          roomRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const roomData = snapshot.val();
              setRoom({ id: snapshot.key!, ...roomData } as Room);
              setTimeLeft(roomData.timer || 15);
            }
            setLoading(false);
          },
          (error: any) => {
            console.error("Room listener error:", error);
            setLoading(false);
          }
        );

        // Listen to players
        const playersRef = ref(db, "players");
        const playersQuery = query(playersRef, orderByChild("roomId"), equalTo(roomId));
        playersUnsubscribe = onValue(
          playersQuery,
          (snapshot) => {
            const playersData: Player[] = [];
            if (snapshot.exists()) {
              snapshot.forEach((child) => {
                const playerData = child.val();
                playersData.push({ 
                  id: child.key!, 
                  name: playerData?.name || "Unknown", 
                  score: playerData?.score || 0,
                  roomId: playerData?.roomId || "",
                  answers: playerData?.answers || [],
                  isHost: playerData?.isHost || false,
                  hasAnswered: playerData?.hasAnswered || false
                } as Player);
              });
            }
            setPlayers(playersData);

            if (playerId) {
              const player = playersData.find((p) => p.id === playerId);
              if (player) {
                setCurrentPlayer(player);
              }
            }
          },
          (error: any) => {
            console.error("Players listener error:", error);
            setLoading(false);
          }
        );
      } catch (error) {
        console.error("Setup error:", error);
        setLoading(false);
      }
    };

    setupListeners();

    return () => {
      if (roomUnsubscribe) roomUnsubscribe();
      if (playersUnsubscribe) playersUnsubscribe();
    };
  }, [roomId, playerId]);

  // Timer logic
  useEffect(() => {
    if (!room || room.status !== "active") return;

    const currentQuestion = room.questions && room.currentQuestionIndex < room.questions.length 
      ? room.questions[room.currentQuestionIndex] 
      : null;

    if (!currentQuestion) return;

    // Check if all non-host players have answered (exclude host completely)
    const eligiblePlayers = players.filter(p => !p.isHost);
    const allAnswered = eligiblePlayers.length > 0 && eligiblePlayers.every(p => p.hasAnswered);
    
    if (timeLeft <= 0 || allAnswered) {
      setCountdownToNext(3);
      
      const countdownInterval = setInterval(() => {
        setCountdownToNext(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      setTimeout(async () => {
        setCountdownToNext(0);
        setRevealAnswer(true);
        
        setTimeout(async () => {
          setRevealAnswer(false);
          
          if (room.currentQuestionIndex + 1 < room.questions.length) {
            try {
              const db = await getDb();
              const roomRef = ref(db, `rooms/${roomId}`);
              
              // Reset players' hasAnswered status
              const playersRef = ref(db, "players");
              const playersQuery = query(playersRef, orderByChild("roomId"), equalTo(roomId));
              
              onValue(playersQuery, (snapshot) => {
                if (snapshot.exists()) {
                  snapshot.forEach((child) => {
                    update(ref(db, `players/${child.key}`), { hasAnswered: false });
                  });
                }
              }, { onlyOnce: true });

              await update(roomRef, {
                currentQuestionIndex: room.currentQuestionIndex + 1,
                timer: 15
              });
            } catch (error) {
              console.error("Error advancing to next question:", error);
            }
          } else {
            // Game finished
            try {
              const db = await getDb();
              const roomRef = ref(db, `rooms/${roomId}`);
              await update(roomRef, { status: "finished" });
            } catch (error) {
              console.error("Error finishing game:", error);
            }
          }
        }, 2000);
      }, 3000);
      
      return;
    }

    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, room, roomId, players]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 via-purple-100 to-purple-50 dark:from-purple-900 dark:via-purple-900 dark:to-purple-900">
        <div className="text-purple-900 dark:text-purple-100 text-xl">Φόρτωση...</div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 via-purple-100 to-purple-50 dark:from-purple-900 dark:via-purple-900 dark:to-purple-900">
        <div className="text-red-600 dark:text-red-400">Δωμάτιο δεν βρέθηκε</div>
      </div>
    );
  }

  const currentQuestion = room && room.questions && room.currentQuestionIndex < room.questions.length 
    ? room.questions[room.currentQuestionIndex] 
    : null;

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-purple-50 via-purple-100 to-purple-50 dark:from-purple-900 dark:via-purple-900 dark:to-purple-900">
      {/* Header */}
      <div className="bg-purple-800 dark:bg-purple-950 text-white p-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="text-2xl">👁️</div>
            <div>
              <h1 className="text-xl font-bold">Λειτουργία Παρατήρησης Host</h1>
              <p className="text-sm text-purple-200">Δωμάτιο: {room.code}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{timeLeft}s</div>
              <div className="text-xs">Χρόνος</div>
            </div>
            {countdownToNext > 0 && (
              <div className="text-center animate-pulse">
                <div className="text-2xl font-bold text-yellow-300">{countdownToNext}</div>
                <div className="text-xs">Επόμενη</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 sm:p-6 lg:p-8">
        {room.status === "waiting" && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4 animate-pulse">⏳</div>
            <h2 className="text-2xl font-bold text-purple-900 dark:text-purple-100 mb-4">
              Αναμονή Έναρξης Παιχνιδιού
            </h2>
            <div className="bg-purple-200 dark:bg-purple-800 rounded-lg p-6 max-w-md mx-auto mb-6">
              <h3 className="text-lg font-bold mb-4 text-purple-900 dark:text-purple-100">
                Παίκτες στο Δωμάτιο
              </h3>
              <div className="space-y-2">
                {players.map((player) => (
                  <div 
                    key={player.id} 
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      player.isHost 
                        ? 'bg-purple-300 dark:bg-purple-700' 
                        : 'bg-white dark:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                        {player.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-purple-900 dark:text-purple-100">
                        {player.name}
                        {player.isHost && <span className="ml-2 text-xs bg-purple-600 text-white px-2 py-1 rounded-full">HOST</span>}
                      </span>
                    </div>
                    <div className="text-sm text-purple-700 dark:text-purple-300">
                      {player.isHost ? "Παρατηρεί" : "Παίκτης"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Host Controls */}
            {currentPlayer?.isHost && (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <div className="text-sm text-purple-700 dark:text-purple-300 mb-2">
                    {players.filter(p => !p.isHost).length >= 2 
                      ? "✅ Έτοιμοι για παιχνίδι!" 
                      : `⏳ Χρειάζονται ${2 - players.filter(p => !p.isHost).length} ακόμη...`}
                  </div>
                </div>
                <button
                  onClick={startGame}
                  disabled={players.filter(p => !p.isHost).length < 2}
                  className={`rounded-lg px-8 py-4 text-white font-bold text-lg transform transition-all shadow-lg ${
                    players.filter(p => !p.isHost).length >= 2 
                      ? "bg-gradient-to-r from-green-600 to-green-800 hover:from-green-700 hover:to-green-900 hover:scale-105 animate-glow" 
                      : "bg-gray-400 cursor-not-allowed opacity-50"
                  }`}
                >
                  {players.filter(p => !p.isHost).length < 2 
                    ? `⏳ Χρειάζονται ${2 - players.filter(p => !p.isHost).length} παίκτες` 
                    : "🚀 Ξεκίνα Παιχνίδι"}
                </button>
                <div className="text-center">
                  <button
                    onClick={() => window.location.href = `/room/${roomId}`}
                    className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200 underline text-sm"
                  >
                    ← Επιστροφή σε Participate Mode
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {room.status === "active" && currentQuestion && (
          <div className="max-w-4xl mx-auto">
            {/* Question Display */}
            <div className="bg-purple-200 dark:bg-purple-800 rounded-xl p-6 mb-6 shadow-xl">
              <div className="text-center mb-6">
                <span className="bg-purple-600 text-white px-4 py-2 rounded-full text-sm font-bold">
                  Ερώτηση {room.currentQuestionIndex + 1} / {room.questions.length}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-center text-purple-900 dark:text-purple-100 mb-8">
                {currentQuestion.text}
              </h2>
              
              {/* Answers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentQuestion.answers.map((answer, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border-2 transition-all text-lg font-medium ${
                      revealAnswer && answer.id === currentQuestion.correctAnswerId
                        ? "border-green-500 bg-green-100 dark:bg-green-900 animate-pulse"
                        : "border-purple-300 dark:border-purple-700 bg-white dark:bg-gray-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={revealAnswer && answer.id === currentQuestion.correctAnswerId ? "text-green-900 dark:text-green-100" : "text-purple-900 dark:text-purple-100"}>
                        {String.fromCharCode(65 + idx)}. {answer.text}
                      </span>
                      {revealAnswer && answer.id === currentQuestion.correctAnswerId && (
                        <span className="text-green-600 dark:text-green-400 font-bold animate-bounce">
                          ✓ ΣΩΣΤΟ
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Players Status */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-xl">
              <h3 className="text-lg font-bold mb-4 text-purple-900 dark:text-purple-100">
                Κατάσταση Παικτών
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {players.filter(p => !p.isHost).map((player) => (
                  <div 
                    key={player.id} 
                    className={`p-4 rounded-lg border-2 ${
                      player.hasAnswered
                        ? "border-green-500 bg-green-100 dark:bg-green-900"
                        : "border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-purple-900 dark:text-purple-100">
                        {player.name}
                      </span>
                      <div className={`px-2 py-1 rounded-full text-xs font-bold ${
                        player.hasAnswered
                          ? "bg-green-600 text-white"
                          : "bg-yellow-600 text-white animate-pulse"
                      }`}>
                        {player.hasAnswered ? "Απάντησε" : "Σκέφτεται"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Statistics */}
              <div className="mt-6 p-4 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                      {players.filter(p => !p.isHost).length}
                    </div>
                    <div className="text-sm text-purple-700 dark:text-purple-300">Συνολικοί Παίκτες</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {players.filter(p => !p.isHost && p.hasAnswered).length}
                    </div>
                    <div className="text-sm text-purple-700 dark:text-purple-300">Απάντησαν</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                      {players.filter(p => !p.isHost && !p.hasAnswered).length}
                    </div>
                    <div className="text-sm text-purple-700 dark:text-purple-300">Εκκρεμούν</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {Math.round((players.filter(p => !p.isHost && p.hasAnswered).length / players.filter(p => !p.isHost).length) * 100) || 0}%
                    </div>
                    <div className="text-sm text-purple-700 dark:text-purple-300">Πρόοδος</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Host Controls for Active Game */}
            {currentPlayer?.isHost && (
              <div className="text-center mt-6">
                <button
                  onClick={() => window.location.href = `/room/${roomId}`}
                  className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200 underline text-sm"
                >
                  ← Επιστροφή σε Participate Mode
                </button>
              </div>
            )}
          </div>
        )}

        {room.status === "finished" && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-3xl font-bold text-purple-900 dark:text-purple-100 mb-6">
              Το Παιχνίδι Ολοκληρώθηκε!
            </h2>
            <div className="bg-purple-200 dark:bg-purple-800 rounded-xl p-8 max-w-2xl mx-auto">
              <h3 className="text-xl font-bold mb-6 text-purple-900 dark:text-purple-100">
                Τελική Κατάταξη
              </h3>
              <div className="space-y-3">
                {players
                  .filter(p => !p.isHost)
                  .sort((a, b) => b.score - a.score)
                  .map((player, index) => (
                    <div 
                      key={player.id} 
                      className={`flex items-center justify-between p-4 rounded-lg ${
                        index === 0 ? 'bg-yellow-200 dark:bg-yellow-800' :
                        index === 1 ? 'bg-gray-200 dark:bg-gray-700' :
                        index === 2 ? 'bg-orange-200 dark:bg-orange-800' :
                        'bg-white dark:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mr-4 ${
                          index === 0 ? 'bg-yellow-600' :
                          index === 1 ? 'bg-gray-600' :
                          index === 2 ? 'bg-orange-600' :
                          'bg-purple-600'
                        }`}>
                          {index + 1}
                        </div>
                        <span className="font-bold text-lg text-purple-900 dark:text-purple-100">
                          {player.name}
                        </span>
                      </div>
                      <div className="text-xl font-bold text-purple-900 dark:text-purple-100">
                        {player.score} pts
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-purple-800 dark:bg-purple-950 text-white p-4 text-center">
        <p className="text-sm">
          🔍 Λειτουργία Παρατήρησης - Ο Host δεν συμμετέχει ενεργά στο παιχνίδι
        </p>
      </div>
    </div>
  );
}
