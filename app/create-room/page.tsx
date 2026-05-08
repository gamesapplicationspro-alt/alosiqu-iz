"use client";

import React, { useState, useEffect } from "react";
import { ref, set, push } from "firebase/database";
import { getDb } from "../lib/firebase";
import { QUESTIONS } from "../lib/questions";
import { Room, Player } from "../types";
import { validatePlayerName, sanitizeInput } from "../../lib/security";

export default function CreateRoom() {
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
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

  const generateCode = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomCode(code);
  };

  const createRoom = async () => {
    const nameValidation = validatePlayerName(playerName);
    if (!nameValidation.isValid) {
      setError(nameValidation.error!);
      return;
    }

    if (!roomCode) {
      setError("Παρακαλώ δημιουργήστε έναν κωδικό δωματίου");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const db = await getDb();
      const shuffledQuestions = [...QUESTIONS].sort(() => Math.random() - 0.5);

      // Create a new room with auto-generated ID using push
      const roomRef = push(ref(db, "rooms"));
      if (!roomRef.key) throw new Error("Unable to create room id");

      const newRoom: Room = {
        id: roomRef.key,
        code: roomCode,
        status: "waiting",
        currentQuestionIndex: 0,
        timer: 15,
        questions: shuffledQuestions,
        createdAt: new Date().toISOString(),
      };

      // Set the room data
      await set(roomRef, newRoom);

      // Create host player
      const playerRef = push(ref(db, "players"));
      if (!playerRef.key) throw new Error("Unable to create player id");

      const hostPlayer: Player = {
        id: playerRef.key,
        name: nameValidation.sanitized!,
        score: 0,
        roomId: roomRef.key,
        answers: [],
        isHost: true,
        hasAnswered: false,
      };

      await set(playerRef, hostPlayer);

      // Store player info and redirect
      localStorage.setItem('playerId', playerRef.key);
      localStorage.setItem('playerName', nameValidation.sanitized!);
      localStorage.setItem('isHost', 'true');

      // Redirect to the room
      window.location.href = `/room/${roomRef.key}`;
    } catch (err) {
      console.error("Error creating room:", err);
      setError("Αποτυχία δημιουργίας δωματίου. Παρακαλώ δοκιμάστε ξανά.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pattern-greek-key">
      {/* Ancient Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-transparent"></div>
        <div className="relative z-10 text-center py-8 px-4">
          <h1 className="greek-title text-4xl md:text-6xl mb-4 animate-float">
            ΔΗΜΙΟΥΡΓΙΑ ΝΑΟΥ
          </h1>
          <p className="greek-subtitle text-lg md:text-xl max-w-2xl mx-auto">
            Γίνετε ο Αρχιτέκτονας του δικού σας ιστορικού αγώνα
          </p>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Host Name Input */}
          <div className="marble-bg p-6 md:p-8 mb-8 animate-scroll-reveal">
            <label htmlFor="hostName" className="block text-lg font-bold mb-3 text-foreground">
              Το Όνομά του Αρχιτέκτονα
            </label>
            <input
              id="hostName"
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

          {/* Room Code Generation */}
          <div className="parchment-bg p-6 md:p-8 mb-8 animate-slide-up">
            <h2 className="greek-title text-xl md:text-2xl mb-6 text-center">
              Κωδικός του Ναού
            </h2>
            <div className="flex gap-4 mb-6">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => {
                  setRoomCode(sanitizeInput(e.target.value).toUpperCase());
                  setError(null);
                }}
                placeholder="Αυτόματη δημιουργία..."
                className="flex-1 px-4 py-3 text-lg border-2 border-parchment-border rounded-lg bg-parchment/50 focus:outline-none focus:ring-2 focus:ring-gold transition-all font-mono"
                maxLength={8}
              />
              <button
                onClick={generateCode}
                className="bronze-button px-6 py-3 text-lg whitespace-nowrap"
              >
                🎲 Δημιουργία
              </button>
            </div>
            <div className="text-center text-sm text-foreground/70">
              Ο κωδικός πρέπει να είναι μοναδικός και εύκολος στην ανάγνωση
            </div>
          </div>

          {/* Create Room Button */}
          <div className="text-center">
            <button
              onClick={createRoom}
              disabled={loading || !playerName.trim() || !roomCode.trim()}
              className="gold-button px-8 py-4 text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed animate-pulse-gold"
            >
              {loading ? (
                <span className="inline-flex items-center">
                  <div className="animate-spin mr-2">⚡</div>
                  Δημιουργία...
                </span>
              ) : (
                "🏺 Ανέγερση Ναού"
              )}
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="error-parchment mt-6 p-4 rounded-lg text-center animate-slide-up">
              <div className="text-lg font-bold">⚠️ Προειδοποίηση</div>
              <div className="text-sm mt-2">{error}</div>
            </div>
          )}

          {/* Instructions */}
          <div className="marble-bg p-6 mt-8 animate-scroll-reveal">
            <h3 className="greek-title text-lg mb-4 text-center">
              Οδηγίες Αρχιτέκτονα
            </h3>
            <div className="space-y-3 text-sm text-foreground/80">
              <div className="flex items-start">
                <span className="text-gold mr-2">1.</span>
                <span>Δημιουργήστε έναν μοναδικό κωδικό για το δωμάτιό σας</span>
              </div>
              <div className="flex items-start">
                <span className="text-gold mr-2">2.</span>
                <span>Μοιραστείστε τον κωδικό με τους παίκτες που θέλετε να προσκαλέσετε</span>
              </div>
              <div className="flex items-start">
                <span className="text-gold mr-2">3.</span>
                <span>Ξεκινήστε το παιχνίδι όταν όλοι οι παίκτες είναι έτοιμοι</span>
              </div>
              <div className="flex items-start">
                <span className="text-gold mr-2">4.</span>
                <span>Επιλέξτε μεταξύ συμμετοχής ή παρατήρησης του παιχνιδιού</span>
              </div>
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
            Ο Αρχιτέκτονας είναι ο φύλακας της γνώσης και της ιστορίας.
          </p>
        </div>
      </footer>

      {/* Floating Ancient Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-10 left-10 text-6xl opacity-10 animate-float" style={{ animationDelay: '0s' }}>🏺</div>
        <div className="absolute top-20 right-20 text-4xl opacity-10 animate-float" style={{ animationDelay: '2s' }}>📜</div>
        <div className="absolute bottom-20 left-20 text-5xl opacity-10 animate-float" style={{ animationDelay: '4s' }}>🏛️</div>
      </div>
    </div>
  );
}
