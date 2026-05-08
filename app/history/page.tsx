"use client";

import React, { useState, useEffect } from "react";
import { ref, onValue, query, orderByChild, limitToLast } from "firebase/database";
import { getDb } from "../lib/firebase";
import { validatePlayerName, sanitizeInput } from "../../lib/security";

interface GameHistory {
  id: string;
  playerName: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  date: string;
  roomCode?: string;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<GameHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("");

  useEffect(() => {
    // Get stored player name
    const storedName = localStorage.getItem('playerName');
    if (storedName) {
      setPlayerName(storedName);
    }
    
    // Add animations
    const timer = setTimeout(() => {
      document.querySelectorAll('.animate-float').forEach((el, index) => {
        (el as HTMLElement).style.animationDelay = `${index * 0.3}s`;
      });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!playerName) return;
    
    setLoading(true);
    setError(null);
    
    const fetchHistory = async () => {
      try {
        const db = await getDb();
        const historyRef = ref(db, `quizHistory/${playerName}`);
        
        onValue(historyRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const historyArray: GameHistory[] = Object.entries(data).map(([entryId, entry]) => {
              const entryData = entry as GameHistory;
              return {
                id: entryId,
                playerName: entryData.playerName,
                score: entryData.score,
                totalQuestions: entryData.totalQuestions,
                percentage: entryData.percentage,
                date: entryData.date,
                roomCode: entryData.roomCode
              };
            });
            
            // Sort by date (newest first)
            const sortedHistory = historyArray.sort((a, b) => 
              new Date(b.date).getTime() - new Date(a.date).getTime()
            );
            
            setHistory(sortedHistory);
          } else {
            setHistory([]);
          }
          setLoading(false);
        }, (error) => {
          console.error("Error fetching history:", error);
          setError("Αποτυχία φόρτωσης ιστορικού. Παρακαλώ δοκιμάστε ξανά.");
          setLoading(false);
        });
      } catch (err) {
        console.error("Error fetching history:", err);
        setError("Αποτυχία φόρτωσης ιστορικού. Παρακαλώ δοκιμάστε ξανά.");
        setLoading(false);
      }
    };
    
    fetchHistory();
  }, [playerName]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('el-GR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPerformanceLevel = (percentage: number) => {
    if (percentage >= 90) return { level: "Θεός", color: "text-gold", icon: "🏆" };
    if (percentage >= 80) return { level: "Ήρωας", color: "text-bronze", icon: "🥈" };
    if (percentage >= 70) return { level: "Στρατηγός", color: "text-purple-royal", icon: "🥉" };
    if (percentage >= 60) return { level: "Πολεμιστής", color: "text-olive", icon: "🎖" };
    return { level: "Μαθητής", color: "text-stone", icon: "📜" };
  };

  const getStats = () => {
    if (history.length === 0) return null;
    
    const totalGames = history.length;
    const totalScore = history.reduce((sum, game) => sum + game.score, 0);
    const totalQuestions = history.reduce((sum, game) => sum + game.totalQuestions, 0);
    const averageScore = Math.round(totalScore / totalGames);
    const averagePercentage = Math.round((totalScore / totalQuestions) * 100);
    const bestGame = history.reduce((best, game) => 
      game.percentage > best.percentage ? game : best
    , history[0]);
    
    return {
      totalGames,
      totalScore,
      totalQuestions,
      averageScore,
      averagePercentage,
      bestGame
    };
  };

  const stats = getStats();

  return (
    <div className="min-h-screen pattern-greek-key">
      {/* Ancient Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-transparent"></div>
        <div className="relative z-10 text-center py-8 px-4">
          <h1 className="greek-title text-4xl md:text-6xl mb-4 animate-float">
            ΙΣΤΟΡΙΚΟ ΑΡΧΕΙΟ
          </h1>
          <p className="greek-subtitle text-lg md:text-xl max-w-2xl mx-auto">
            Οι ιστορικές σας μάχες και επιδόσεις
          </p>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Player Name Input */}
          <div className="marble-bg p-6 mb-8 animate-scroll-reveal">
            <label htmlFor="playerName" className="block text-lg font-bold mb-3 text-foreground">
              Όνομα Παίκτη
            </label>
            <input
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => {
                setPlayerName(sanitizeInput(e.target.value));
                setError(null);
              }}
              placeholder="Εισάγετε το όνομά σας..."
              className="w-full px-4 py-3 text-lg border-2 border-stone rounded-lg bg-marble/50 focus:outline-none focus:ring-2 focus:ring-gold transition-all"
              maxLength={20}
            />
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="text-foreground text-xl animate-pulse">Φόρτωση ιστορικού...</div>
            </div>
          ) : error ? (
            <div className="error-parchment p-6 rounded-lg text-center animate-slide-up">
              <div className="text-lg font-bold">⚠️ Σφάλμα</div>
              <div className="text-sm mt-2">{error}</div>
            </div>
          ) : (
            <>
              {/* Statistics */}
              {stats && (
                <div className="marble-bg p-6 md:p-8 mb-8 animate-scroll-reveal">
                  <h2 className="greek-title text-xl md:text-2xl mb-6 text-center">
                    Στατιστικά Απόδοσης
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="parchment-bg p-4 rounded-lg text-center">
                      <div className="text-3xl font-bold text-gold mb-2">{stats.totalGames}</div>
                      <div className="text-sm text-foreground/70">Συνολικοί Αγώνες</div>
                    </div>
                    <div className="parchment-bg p-4 rounded-lg text-center">
                      <div className="text-3xl font-bold text-bronze mb-2">{stats.averageScore}</div>
                      <div className="text-sm text-foreground/70">Μέσος Βαθμός</div>
                    </div>
                    <div className="parchment-bg p-4 rounded-lg text-center">
                      <div className="text-3xl font-bold text-purple-royal mb-2">{stats.averagePercentage}%</div>
                      <div className="text-sm text-foreground/70">Μέσο Ποσοστό</div>
                    </div>
                    <div className="parchment-bg p-4 rounded-lg text-center">
                      <div className="text-3xl font-bold text-olive mb-2">{stats.bestGame.percentage}%</div>
                      <div className="text-sm text-foreground/70">Καλύτερη Επίδοση</div>
                    </div>
                    <div className="parchment-bg p-4 rounded-lg text-center">
                      <div className="text-3xl font-bold text-stone mb-2">{stats.totalScore}</div>
                      <div className="text-sm text-foreground/70">Συνολικοί Πόντοι</div>
                    </div>
                    <div className="parchment-bg p-4 rounded-lg text-center">
                      <div className="text-3xl font-bold text-red-ancient mb-2">{stats.totalQuestions}</div>
                      <div className="text-sm text-foreground/70">Συνολικές Ερωτήσεις</div>
                    </div>
                  </div>
                </div>
              )}

              {/* History List */}
              <div className="parchment-bg p-6 md:p-8 animate-slide-up">
                <h2 className="greek-title text-xl md:text-2xl mb-6 text-center">
                  Ιστορικό Αγώνων
                </h2>
                {history.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4 opacity-50">📜</div>
                    <div className="text-foreground/70 text-lg">
                      Δεν βρέθηκαν ιστορικά αγώνες
                    </div>
                    <div className="text-foreground/60 text-sm mt-2">
                      Παίξτε μερικά παιχνίδια για να δημιουργήσετε ιστορικό!
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {history.map((game, index) => {
                      const performance = getPerformanceLevel(game.percentage);
                      return (
                        <div 
                          key={game.id} 
                          className="marble-bg p-4 rounded-lg interactive-card animate-scroll-reveal"
                          style={{ animationDelay: `${index * 0.1}s` }}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center">
                              <div className="text-2xl mr-3">{performance.icon}</div>
                              <div>
                                <div className="font-bold text-lg">{performance.level}</div>
                                <div className="text-sm text-foreground/70">
                                  {formatDate(game.date)}
                                </div>
                              </div>
                            </div>
                            <div className={`text-2xl font-bold ${performance.color}`}>
                              {game.percentage}%
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-foreground/60">Βαθμός:</span>
                              <span className="font-bold ml-1">{game.score}/{game.totalQuestions}</span>
                            </div>
                            <div>
                              <span className="text-foreground/60">Σωστές:</span>
                              <span className="font-bold ml-1 text-green-600 dark:text-green-400">{game.score}</span>
                            </div>
                            <div>
                              <span className="text-foreground/60">Λάθος:</span>
                              <span className="font-bold ml-1 text-red-600 dark:text-red-400">{game.totalQuestions - game.score}</span>
                            </div>
                            {game.roomCode && (
                              <div>
                                <span className="text-foreground/60">Δωμάτιο:</span>
                                <span className="font-bold ml-1">{game.roomCode}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Navigation */}
          <div className="text-center mt-8 space-y-4">
            <button
              onClick={() => window.location.href = '/quiz'}
              className="gold-button px-6 py-3 text-lg font-bold"
            >
              🎮 Νέο Παιχνίδι
            </button>
            <div>
              <button
                onClick={() => window.location.href = '/'}
                className="text-foreground/60 hover:text-gold transition-colors underline text-sm"
              >
                ← Επιστροφή στην Αρχική
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Ancient Footer */}
      <footer className="relative z-10 mt-16 border-t-4 border-double border-parchment bg-parchment/50">
        <div className="container mx-auto px-4 py-8 text-center">
          <div className="greek-subtitle text-lg mb-4">
            ΑΛΟΣΙΚΟΥ ΙΣΤΟΡΙΑ © 2024
          </div>
          <p className="text-foreground/70 text-sm max-w-2xl mx-auto">
            Κάθε αγώνας είναι μια σελίδα στην ιστορία της γνώσης σας.
          </p>
        </div>
      </footer>

      {/* Floating Ancient Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-10 left-10 text-6xl opacity-10 animate-float" style={{ animationDelay: '0s' }}>📜</div>
        <div className="absolute top-20 right-20 text-4xl opacity-10 animate-float" style={{ animationDelay: '2s' }}>🏺</div>
        <div className="absolute bottom-20 left-20 text-5xl opacity-10 animate-float" style={{ animationDelay: '4s' }}>⚡</div>
      </div>
    </div>
  );
}
