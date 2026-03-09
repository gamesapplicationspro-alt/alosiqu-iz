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
  const [countdownToNext, setCountdownToNext] = useState(0);
  const [showQuestionsToHost, setShowQuestionsToHost] = useState(false);
  const [hostViewMode, setHostViewMode] = useState<'participate'>('participate');
  const [revealAnswer, setRevealAnswer] = useState(false);

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
      setRevealAnswer(false); // Reset answer reveal
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

  // Smart timer - check if all players have answered OR time is up
  useEffect(() => {
    if (!room || room.status !== "active") return;
    
    // Check if all eligible players have answered (now all players can answer)
    const allAnswered = players.length > 0 && players.every(p => p.hasAnswered);
    
    if (timeLeft <= 0 || allAnswered) {
      // Show countdown for 3 seconds before moving to next question
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
      
      // Wait 3 seconds before moving to next question so players can see results
      setTimeout(async () => {
        setCountdownToNext(0);
        setRevealAnswer(true); // Reveal the correct answer with animation
        
        // Wait 2 more seconds with the answer revealed, then move to next question
        setTimeout(async () => {
          setRevealAnswer(false);
          
          // Move to next question for everyone
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
        }, 2000);
      }, 3000);
      
      return;
    }

    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, room, roomId, players]);

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
          <div className="animate-fade-in">
            {/* Animated Header */}
            <div className="text-center mb-8">
              <div className="inline-block">
                <h1 className="text-4xl font-bold mb-4 text-amber-900 dark:text-amber-100 animate-pulse">
                  🎮 Αναμονή Παικτών
                </h1>
                <div className="bg-gradient-to-r from-amber-400 to-orange-400 text-white rounded-full px-8 py-4 inline-block shadow-lg transform hover:scale-105 transition-all">
                  <div className="text-sm font-bold mb-1">Κωδικός Δωματίου</div>
                  <div className="text-3xl font-mono font-bold">{room.code}</div>
                </div>
              </div>
            </div>

            {/* Players Grid with Animations */}
            <div className="mb-8">
              <h2 className="text-2xl mb-6 text-center text-amber-900 dark:text-amber-100">
                🎯 Παίκτες ({players.length}) 
                <span className="text-lg ml-2 text-amber-700 dark:text-amber-300">
                  {players.length >= 2 
                    ? "✅ Έτοιμοι για παιχνίδι!" 
                    : `⏳ Χρειάζονται ${2 - players.length} ακόμη...`}
                </span>
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {players
                  .sort((a, b) => {
                    // Keep consistent ordering: host first, then by name
                    if (a.isHost && !b.isHost) return -1;
                    if (!a.isHost && b.isHost) return 1;
                    return a.name.localeCompare(b.name);
                  })
                  .map((p, idx) => (
                  <div 
                    key={p.id} 
                    className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-xl animate-slide-up"
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-lg mr-3">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-amber-900 dark:text-amber-100">{p.name}</div>
                          {p.isHost && (
                            <div className="text-xs bg-purple-600 text-white px-2 py-1 rounded-full inline-block mt-1 animate-glow">
                              👑 HOST
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-2xl animate-bounce" style={{ animationDelay: `${idx * 200}ms` }}>
                        {p.isHost ? "👑" : "🎮"}
                      </div>
                    </div>
                    <div className="bg-amber-100 dark:bg-amber-900 rounded-lg p-2 text-center">
                      <div className="text-xs text-amber-700 dark:text-amber-300">Κατάσταση</div>
                      <div className="text-sm font-bold text-amber-900 dark:text-amber-100 animate-pulse">
                        {p.isHost ? "Έτοιμος" : "Αναμονή"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Host Controls */}
            <div className="text-center">
              {currentPlayer?.isHost && (
                <div className="space-y-4">
                  {/* Start Game Button */}
                  <button
                    onClick={startGame}
                    disabled={players.length < 2}
                    className={`rounded-lg px-8 py-4 text-white font-bold text-lg transform transition-all shadow-lg ${
                      players.length >= 2 
                        ? "bg-gradient-to-r from-green-600 to-green-800 hover:from-green-700 hover:to-green-900 hover:scale-105 animate-glow" 
                        : "bg-gray-400 cursor-not-allowed opacity-50"
                    }`}
                  >
                    {players.length < 2 ? `⏳ Χρειάζονται ${2 - players.length} παίκτες` : "🚀 Ξεκίνα Παιχνίδι"}
                  </button>
                </div>
              )}

              {/* Non-host message */}
              {!currentPlayer?.isHost && (
                <div className="bg-amber-100 dark:bg-amber-900 rounded-lg p-6 max-w-md mx-auto animate-pulse">
                  <div className="text-amber-900 dark:text-amber-100 font-bold text-lg">
                    ⏳ Αναμονή Host...
                  </div>
                  <div className="text-amber-700 dark:text-amber-300 mt-2">
                    Ο host θα ξεκινήσει το παιχνίδι όταν είστε έτοιμοι!
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {room.status === "active" && currentQuestion && currentQuestion.answers && (
          <div className="animate-fade-in">
            {/* Normal Game View */}
            <>
                <div className="mb-6 text-center">
                  <div className="inline-flex items-center bg-white dark:bg-gray-800 rounded-full px-6 py-3 shadow-lg">
                    <span className="text-2xl font-bold text-amber-900 dark:text-amber-100 mr-3">⏱</span>
                    <span className="text-2xl font-bold text-amber-900 dark:text-amber-100">{timeLeft}s</span>
                    <div className="ml-4 text-sm text-amber-700 dark:text-amber-300">
                      {players.filter(p => p.hasAnswered).length}/{players.length} απάντησαν
                    </div>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl mb-6 transform transition-all duration-500 hover:scale-102">
                  <div className="flex items-center mb-4">
                    <div className="bg-amber-600 text-white rounded-full px-3 py-1 text-sm font-bold mr-3">
                      ΕΡΩΤΗΣΗ {room.currentQuestionIndex + 1}
                    </div>
                    <div className="h-1 flex-1 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full"></div>
                    <div className="bg-amber-600 text-white rounded-full px-3 py-1 text-sm font-bold ml-3">
                      {room.questions.length}
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold mb-6 text-amber-900 dark:text-amber-100 leading-relaxed">
                    {currentQuestion.text}
                  </h2>
                </div>
                
                {currentPlayer?.hasAnswered ? (
                  <div className="text-center p-8 bg-green-100 dark:bg-green-900 rounded-lg">
                    <h3 className="text-xl font-bold text-green-800 dark:text-green-200 mb-2">✓ Απάντησες!</h3>
                    <p className="text-green-700 dark:text-green-300">
                      {countdownToNext > 0 
                        ? `Επόμενη ερώτηση σε ${countdownToNext}...` 
                        : "Περίμενε τους υπόλοιπους παίκτες..."
                      }
                    </p>
                    
                    {/* Show countdown when all answered */}
                    {countdownToNext > 0 && (
                      <div className="mt-4">
                        <div className="text-4xl font-bold text-amber-600 dark:text-amber-400 animate-pulse">
                          {countdownToNext}
                        </div>
                        <div className="text-sm text-amber-700 dark:text-amber-300">
                          Όλοι απάντησαν! Επόμενη ερώτηση...
                        </div>
                      </div>
                    )}
                    
                    {/* Show answer results immediately after submission */}
                    <div className="mt-6 space-y-2">
                      {currentQuestion.answers.map((answer, idx) => {
                        const isCorrect = answer.id === currentQuestion.correctAnswerId;
                        const wasSelected = selectedAnswer === idx;
                        
                        return (
                          <div 
                            key={idx}
                            className={`p-3 rounded-lg text-left transform transition-all duration-500 ${
                              isCorrect && revealAnswer
                                ? "bg-green-500 text-white scale-105 shadow-lg animate-pulse" 
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
                                {isCorrect && revealAnswer ? "✓ ΣΩΣΤΟ" : wasSelected ? "✗ ΛΑΘΟΣ" : ""}
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
            </>
          </div>
        )}

        {room.status === "finished" && (
          <div className="text-center animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl mb-6">
              <div className="text-6xl mb-6 animate-bounce">🏆</div>
              <h1 className="text-4xl font-bold mb-6 text-amber-900 dark:text-amber-100">
                Τέλος Παιχνιδιού!
              </h1>
              <div className="bg-gradient-to-r from-amber-400 to-orange-400 text-white rounded-full px-6 py-2 inline-block mb-6">
                <span className="font-bold">Νικητής:</span> {players.sort((a, b) => b.score - a.score)[0]?.name}
              </div>
            </div>
            <div className="space-y-3 max-w-md mx-auto">
              {players
                .sort((a, b) => b.score - a.score)
                .map((p, idx) => (
                  <div 
                    key={p.id} 
                    className={`p-4 rounded-lg shadow-lg transform transition-all duration-300 hover:scale-105 ${
                      idx === 0 ? "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white" :
                      idx === 1 ? "bg-gradient-to-r from-gray-300 to-gray-500 text-white" :
                      idx === 2 ? "bg-gradient-to-r from-orange-600 to-orange-800 text-white" :
                      "bg-white dark:bg-gray-800"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">
                          {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`}
                        </span>
                        <span className="font-bold">{p.name}</span>
                        {p.isHost && <span className="ml-2 text-xs bg-purple-600 text-white px-2 py-1 rounded">Host</span>}
                      </div>
                      <span className="font-bold text-xl">{p.score} πόντοι</span>
                    </div>
                  </div>
                ))}
            </div>
            {currentPlayer?.isHost && (
              <button
                onClick={() => window.location.href = "/create-room"}
                className="mt-8 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 px-8 py-4 text-white font-bold text-lg hover:from-amber-700 hover:to-orange-700 transform hover:scale-105 transition-all shadow-lg"
              >
                Νέο Παιχνίδι
              </button>
            )}
          </div>
        )}
      </div>

      <div className="w-full lg:w-80 p-4 lg:p-8 parchment-bg relative overflow-hidden">
        {/* Historic Background Elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-4 text-6xl transform rotate-12">🏛️</div>
          <div className="absolute bottom-4 left-4 text-4xl transform -rotate-12">⚡</div>
          <div className="absolute top-1/2 right-8 text-5xl transform rotate-45">🔱</div>
          <div className="absolute bottom-1/3 left-6 text-3xl transform -rotate-45">🦉</div>
        </div>
        
        {/* Content */}
        <div className="relative z-10">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-amber-900 dark:text-amber-100 flex items-center justify-center">
              <span className="mr-2">🏆</span>
              Live Leaderboard
              <span className="ml-2">🏆</span>
            </h2>
            <div className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              {room.status === 'active' 
                ? `Ερώτηση ${room.currentQuestionIndex + 1}/${room.questions.length}`
                : room.status === 'waiting' 
                ? 'Αναμονή αρχής'
                : 'Παιχνίδι ολοκληρώθηκε'
              }
            </div>
          </div>
          
          <div className="space-y-3">
            {players
              .sort((a, b) => b.score - a.score)
              .map((p, idx) => (
                <div 
                  key={p.id} 
                  className={`p-3 rounded-lg shadow-md transform transition-all duration-300 hover:scale-105 hover:shadow-lg ${
                    idx === 0 
                      ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white border-2 border-yellow-700' 
                      : idx === 1 
                      ? 'bg-gradient-to-r from-gray-300 to-gray-500 text-white border-2 border-gray-600'
                      : idx === 2 
                      ? 'bg-gradient-to-r from-orange-600 to-orange-800 text-white border-2 border-orange-900'
                      : 'bg-white dark:bg-gray-800 border-2 border-amber-300 dark:border-amber-700'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <span className="text-xl mr-2 font-bold">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                      </span>
                      <div>
                        <span className="font-bold">{p.name}</span>
                        {p.isHost && (
                          <span className="ml-1 text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">
                            👑
                          </span>
                        )}
                        {p.hasAnswered && room.status === 'active' && (
                          <span className="ml-1 text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">
                            ✓
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="font-bold text-lg">{p.score}</span>
                  </div>
                </div>
              ))}
          </div>
          
          {/* Game Status Indicator */}
          <div className="mt-6 text-center">
            <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${
              room.status === 'active' 
                ? 'bg-green-600 text-white animate-pulse' 
                : room.status === 'waiting' 
                ? 'bg-amber-600 text-white' 
                : 'bg-purple-600 text-white'
            }`}>
              {room.status === 'active' && '🎮 Παιχνίδι σε εξέλιξη'}
              {room.status === 'waiting' && '⏳ Αναμονή παικτών'}
              {room.status === 'finished' && '🏆 Ολοκληρώθηκε'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
