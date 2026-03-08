"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ref, onValue, query, orderByChild, equalTo, update, off } from "firebase/database";
import { getDb } from "@/lib/firebase";
import { Room, Player, Question } from "@/types";

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = params.id as string;
  const playerId = searchParams.get("playerId") || undefined;
  const playerName = searchParams.get("name") || "Anonymous";

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [playerNameInput, setPlayerNameInput] = useState("");

  useEffect(() => {
    if (!roomId || typeof roomId !== "string") return;
    if (!playerId) return;

    let db;
    let roomUnsubscribe: (() => void) | null = null;
    let playersUnsubscribe: (() => void) | null = null;

    const setupListeners = async () => {
      try {
        const db = await getDb();
        
        // Listen to room changes with error handling
        const roomRef = ref(db, `rooms/${roomId}`);
        roomUnsubscribe = onValue(
          roomRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const roomData = snapshot.val();
              setRoom({ id: snapshot.key!, ...roomData } as Room);
              setTimeLeft(roomData.timer || 30);
            } else {
              setLoadError("Δωμάτιο δεν βρέθηκε. Μπορεί να έχει διαγραφεί.");
            }
            setLoading(false);
          },
          (error: any) => {
            console.error("Room listener error:", error);
            setLoadError(`Σφάλμα φόρτωσης δωματίου: ${error.message || error}`);
            setLoading(false);
          }
        );

        // Listen to players in room using query with error handling
        const playersRef = ref(db, "players");
        const playersQuery = query(playersRef, orderByChild("roomId"), equalTo(roomId));
        playersUnsubscribe = onValue(
          playersQuery,
          (snapshot) => {
            const playersData: Player[] = [];
            if (snapshot.exists()) {
              snapshot.forEach((child) => {
                const playerData = child.val();
                if (playerData && playerData.answers && Array.isArray(playerData.answers)) {
                  playersData.push({ id: child.key!, ...playerData } as Player);
                } else {
                  playersData.push({ 
                    id: child.key!, 
                    name: playerData?.name || "Unknown", 
                    score: playerData?.score || 0,
                    roomId: playerData?.roomId || "",
                    answers: playerData?.answers || []
                  } as Player);
                }
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
            setLoadError(`Σφάλμα φόρτωσης παικτών: ${error.message || error}`);
            setLoading(false);
          }
        );
      } catch (error: any) {
        console.error("Setup error:", error);
        setLoadError(`Σφάλμα αρχικοποίησης: ${error.message || error}`);
        setLoading(false);
      }
    };

    setupListeners();

    return () => {
      if (roomUnsubscribe) roomUnsubscribe();
      if (playersUnsubscribe) playersUnsubscribe();
    };
  }, [roomId, playerId]);

  // Reset selectedAnswer and hasAnswered when question changes
  useEffect(() => {
    if (room && room.status === "active") {
      setSelectedAnswer(null);
      // Reset hasAnswered status for current player locally
      if (currentPlayer?.hasAnswered) {
        setCurrentPlayer(prev => prev ? { ...prev, hasAnswered: false } : null);
      }
    }
  }, [room?.currentQuestionIndex]);

  // Effect to handle host detection when room and players are available
  useEffect(() => {
    if (room && players.length > 0 && playerId) {
      const player = players.find((p) => p.id === playerId);
      if (player) {
        // Smart host detection: check if player ID matches room's hostId OR if player has isHost flag
        const isHost = room.hostId === player.id || player.isHost;
        
        console.log("Host detection:", { 
          playerId, 
          roomHostId: room.hostId, 
          playerIsHost: player.isHost, 
          finalIsHost: isHost,
          playerName: player.name 
        });
        
        // Update current player with host status
        setCurrentPlayer(prev => {
          if (!prev || prev.id !== player.id) {
            return { ...player, isHost };
          }
          return { ...prev, isHost };
        });
      }
    }
  }, [room, players, playerId]);

  // Create player from name modal
  const createPlayer = () => {
    if (!playerNameInput.trim() || !room) return;

    const newPlayer: Player = {
      id: "player-" + Math.random().toString(36).substring(2, 9),
      name: playerNameInput.trim(),
      score: 0,
      roomId: room.id,
      answers: [],
    };

    const updatedPlayers = [...players, newPlayer];
    setPlayers(updatedPlayers);
    setCurrentPlayer(newPlayer);
    
    // Save to both sessionStorage and localStorage
    const roomKey = `room:${room.code}`;
    const roomData = { room, players: updatedPlayers };
    sessionStorage.setItem(roomKey, JSON.stringify(roomData));
    localStorage.setItem(roomKey, JSON.stringify(roomData));
    
    // Save current player ID
    sessionStorage.setItem(`currentPlayerId:${room.code}`, newPlayer.id);
    localStorage.setItem(`currentPlayerId:${room.code}`, newPlayer.id);
    
    setShowNameModal(false);
    setPlayerNameInput("");
  };

  // Auto-save to sessionStorage on changes (real-time sync)
  useEffect(() => {
    if (room && players.length > 0) {
      const roomKey = `room:${room.code}`;
      const roomData = { room, players };
      sessionStorage.setItem(roomKey, JSON.stringify(roomData));
      localStorage.setItem(roomKey, JSON.stringify(roomData));
    }
  }, [room, players]);

  // Timer - handles question progression for all players
  useEffect(() => {
    if (!room || room.status !== "active") return;
    if (timeLeft <= 0) {
      // Time's up - move to next question for everyone
      if (room.currentQuestionIndex + 1 < room.questions.length) {
        const nextQuestion = async () => {
          try {
            const db = await getDb();
            const roomRef = ref(db, `rooms/${roomId}`);
            
            // Reset all players' hasAnswered status for next question
            const playersRef = ref(db, "players");
            const playersQuery = query(playersRef, orderByChild("roomId"), equalTo(roomId));
            
            onValue(playersQuery, (snapshot) => {
              if (snapshot.exists()) {
                snapshot.forEach((child) => {
                  update(ref(db, `players/${child.key}`), { hasAnswered: false });
                });
              }
            }, { onlyOnce: true });

            // Move to next question
            await update(roomRef, {
              currentQuestionIndex: room.currentQuestionIndex + 1,
              timer: 30
            });
          } catch (error) {
            console.error("Error advancing to next question:", error);
          }
        };
        
        nextQuestion();
      } else {
        // Game finished
        const finishGame = async () => {
          try {
            const db = await getDb();
            const roomRef = ref(db, `rooms/${roomId}`);
            await update(roomRef, { status: "finished" });
          } catch (error) {
            console.error("Error finishing game:", error);
          }
        };
        
        finishGame();
      }
      return;
    }

    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, room, roomId]);

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
      
      // Update room status in Firebase
      await update(roomRef, {
        status: "active",
        currentQuestionIndex: 0,
        timer: 30
      });
      
      // Local state will be updated by the listener
    } catch (error) {
      console.error("Error starting game:", error);
      setLoadError("Σφάλμα εκκίνησης παιχνιδιού");
    }
  };

  const submitAnswer = async () => {
    if (!room || !currentPlayer || selectedAnswer === null || currentPlayer.hasAnswered) return;

    const question = room.questions[room.currentQuestionIndex];
    if (!question || !question.answers || !Array.isArray(question.answers)) {
      console.error("Invalid question or answers data");
      return;
    }
    
    const selectedAnswerObj = question.answers[selectedAnswer];
    const correct = selectedAnswerObj.id === question.correctAnswerId;
    const points = correct ? Math.max(10, timeLeft) : 0;

    // Show immediate feedback
    const feedbackMessage = correct 
      ? `🎉 ΣΩΣΤΗ ΑΠΑΝΤΗΣΗ! +${points} πόντοι!` 
      : `❌ ΛΑΘΟΣ ΑΠΑΝΤΗΣΗ! Η σωστή είναι η ${String.fromCharCode(65 + question.answers.findIndex(a => a.id === question.correctAnswerId))}`;
    
    // Update only the current player's score and answer
    const updatedPlayer = {
      ...currentPlayer,
      score: currentPlayer.score + points,
      answers: [...(currentPlayer.answers || []), { questionId: question.id, answerId: selectedAnswerObj.id, time: Date.now() }],
      hasAnswered: true
    };

    // Save player's answer to Firebase immediately
    try {
      const db = await getDb();
      const playerRef = ref(db, `players/${currentPlayer.id}`);
      await update(playerRef, {
        score: updatedPlayer.score,
        answers: updatedPlayer.answers,
        hasAnswered: true
      });

      // Update local state
      setCurrentPlayer(updatedPlayer);
      setPlayers(prev => prev.map(p => p.id === currentPlayer.id ? updatedPlayer : p));
      
      // Show toast notification (simple alert for now)
      alert(feedbackMessage);

    } catch (error) {
      console.error("Error saving player data:", error);
      alert("❌ Σφάλμα κατά την υποβολή. Παρακαλώ δοκίμασε ξανά!");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-amber-50 via-yellow-100 to-orange-50 dark:from-amber-900 dark:via-yellow-900 dark:to-orange-900">
        <div className="text-xl text-amber-900 dark:text-amber-100 animate-pulse">Φόρτωση...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-amber-50 via-yellow-100 to-orange-50 dark:from-amber-900 dark:via-yellow-900 dark:to-orange-900 p-8">
        <div className="text-red-600 dark:text-red-400 mb-4">{loadError}</div>
        <button
          onClick={() => router.push("/join-room")}
          className="rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-700"
        >
          Πήγαινε στο Join Room
        </button>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-amber-50 via-yellow-100 to-orange-50 dark:from-amber-900 dark:via-yellow-900">
        <div className="text-red-600 dark:text-red-400">Δωμάτιο δεν βρέθηκε</div>
      </div>
    );
  }

  const currentQuestion = room && room.questions && room.currentQuestionIndex < room.questions.length 
    ? room.questions[room.currentQuestionIndex] 
    : null;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gradient-to-br from-amber-50 via-yellow-100 to-orange-50 dark:from-amber-900 dark:via-yellow-900 dark:to-orange-900">
      {/* Name Modal */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4 text-amber-900 dark:text-amber-100">Δώσε το όνομά σου</h2>
            <input
              type="text"
              value={playerNameInput}
              onChange={(e) => setPlayerNameInput(e.target.value)}
              placeholder="Όνομα παίκτη"
              className="w-full border-2 border-amber-600 p-3 rounded-md mb-4 bg-yellow-50 dark:bg-yellow-900 text-amber-900 dark:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && createPlayer()}
            />
            <button
              onClick={createPlayer}
              disabled={!playerNameInput.trim()}
              className="w-full rounded-lg bg-amber-600 px-4 py-3 text-white font-semibold hover:bg-amber-700 disabled:opacity-50"
            >
              Είσοδος
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 p-4 lg:p-8">
        {room.status === "waiting" && (
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4 text-amber-900 dark:text-amber-100">Αναμονή παικτών</h1>
            <p className="mb-6 text-amber-800 dark:text-amber-200">Κωδικός δωματίου: <span className="font-mono text-2xl">{room.code}</span></p>
            <div className="mb-6">
              <h2 className="text-xl mb-4 text-amber-900 dark:text-amber-100">Παίκτες ({players.length})</h2>
              <ul className="space-y-2 max-w-sm mx-auto">
                {players.map((p) => (
                  <li key={p.id} className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow flex justify-between items-center">
                    <span>{p.name}</span>
                    {p.isHost && <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">Host</span>}
                  </li>
                ))}
              </ul>
            </div>
            {currentPlayer?.isHost && (
              <button
                onClick={startGame}
                className="rounded-lg bg-green-600 px-6 py-3 text-white font-semibold hover:bg-green-700"
              >
                Ξεκίνα Παιχνίδι
              </button>
            )}
          </div>
        )}

        {room.status === "active" && currentQuestion && currentQuestion.answers && (
          <div>
            <div className="mb-4 text-center">
              <span className="text-2xl font-bold text-amber-900 dark:text-amber-100">⏱ {timeLeft}s</span>
            </div>
            <h2 className="text-2xl font-bold mb-6 text-amber-900 dark:text-amber-100">{currentQuestion.text}</h2>
            
            {currentPlayer?.hasAnswered ? (
              <div className="text-center p-8 bg-green-100 dark:bg-green-900 rounded-lg">
                <h3 className="text-xl font-bold text-green-800 dark:text-green-200 mb-2">✓ Απάντησες!</h3>
                <p className="text-green-700 dark:text-green-300">Περίμενε τους υπόλοιπους παίκτες...</p>
                
                {/* Show answer results immediately after submission */}
                <div className="mt-6 space-y-2">
                  {currentQuestion.answers.map((answer, idx) => {
                    const isCorrect = answer.id === currentQuestion.correctAnswerId;
                    const wasSelected = selectedAnswer === idx;
                    
                    return (
                      <div 
                        key={idx}
                        className={`p-3 rounded-lg text-left ${
                          isCorrect 
                            ? "bg-green-500 text-white" 
                            : wasSelected 
                            ? "bg-red-500 text-white" 
                            : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-semibold">
                            {String.fromCharCode(65 + idx)}. {answer.text}
                          </span>
                          <span className="text-2xl font-bold">
                            {isCorrect ? "✓ ΣΩΣΤΟ" : wasSelected ? "✗ ΛΑΘΟΣ" : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {currentQuestion.answers.map((answer, idx) => {
                    const isSelected = selectedAnswer === idx;
                    
                    return (
                      <button
                        key={idx}
                        onClick={() => !currentPlayer?.hasAnswered && setSelectedAnswer(idx)}
                        disabled={currentPlayer?.hasAnswered}
                        className={`w-full p-4 text-left rounded-lg transition-all transform hover:scale-102 ${
                          isSelected
                            ? "bg-blue-600 text-white scale-105 shadow-lg"
                            : currentPlayer?.hasAnswered
                            ? "bg-gray-300 dark:bg-gray-600 cursor-not-allowed"
                            : "bg-white dark:bg-gray-800 hover:bg-amber-100 dark:hover:bg-gray-700"
                        }`}
                      >
                        <span className="font-semibold">
                          {String.fromCharCode(65 + idx)}. {answer.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {selectedAnswer !== null && !currentPlayer?.hasAnswered && (
                  <button
                    onClick={submitAnswer}
                    className="mt-6 rounded-lg bg-blue-600 px-6 py-3 text-white font-semibold hover:bg-blue-700 animate-bounce"
                  >
                    Υποβολή
                  </button>
                )}
                {currentPlayer?.hasAnswered && (
                  <div className="mt-6 text-center text-green-700 dark:text-green-300 font-semibold">
                    ✓ Η απάντησή σου καταχωρήθηκε - Περίμενε την επόμενη ερώτηση
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {room.status === "finished" && (
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-6 text-amber-900 dark:text-amber-100">🏆 Τέλος Παιχνιδιού</h1>
            <div className="space-y-2 max-w-sm mx-auto">
              {players
                .sort((a, b) => b.score - a.score)
                .map((p, idx) => (
                  <li key={p.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex justify-between items-center">
                    <span>
                      {idx === 0 && "🥇"} {idx === 1 && "🥈"} {idx === 2 && "🥉"} {p.name}
                    </span>
                    <span className="font-bold">{p.score} πόντοι</span>
                  </li>
                ))}
            </div>
          </div>
        )}
      </div>

      <div className="w-full lg:w-80 p-4 lg:p-8 bg-amber-100 dark:bg-amber-900">
        <h2 className="text-xl font-bold mb-4 text-amber-900 dark:text-amber-100">Live Leaderboard</h2>
        <ul className="space-y-2">
          {players
            .sort((a, b) => b.score - a.score)
            .map((p, idx) => (
              <li key={p.id} className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow flex justify-between items-center">
                <span>
                  {idx === 0 && "🥇"} {idx === 1 && "🥈"} {idx === 2 && "🥉"} {p.name}
                </span>
                <span className="font-bold">{p.score}</span>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
