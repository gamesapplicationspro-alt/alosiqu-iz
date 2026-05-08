"use client";

import React, { useState, useEffect, Suspense } from "react";
import { query, orderByChild, equalTo, get, ref, set, push } from "firebase/database";
import { getDb } from "../lib/firebase";
import { Room, Player } from "../types";
import { validateRoomCode, validatePlayerName, sanitizeInput } from "../../lib/security";
import { useSearchParams } from "next/navigation";

function JoinRoomContent() {
  const searchParams = useSearchParams();
  const [roomCode, setRoomCode] = useState(searchParams.get("code") || "");
  const [playerName, setPlayerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }, [searchParams]);

  const joinRoom = async () => {
    const nameValidation = validatePlayerName(playerName);
    const codeValidation = validateRoomCode(roomCode);
    
    const errors: { name?: string; code?: string } = {};
    
    if (!nameValidation.isValid) {
      errors.name = nameValidation.error;
    }
    
    if (!codeValidation.isValid) {
      errors.code = codeValidation.error;
    }
    
    if (Object.keys(errors).length > 0) {
      setError(errors.name || errors.code || null);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const db = await getDb();
      
      // Query rooms by code
      const roomsRef = ref(db, "rooms");
      const roomsQuery = query(roomsRef, orderByChild("code"), equalTo(codeValidation.sanitized!));
      const snapshot = await get(roomsQuery);
      
      if (snapshot.exists()) {
        // Get the room ID from the snapshot key
        const roomData = snapshot.val();
        const roomId = Object.keys(roomData)[0];
        const room = roomData[roomId] as Room;
        
        // Check if room is still joinable
        if (room.status === "finished") {
          setError("Αυτό το δωμάτιο έχει ολοκληρωθεί. Δημιουργήστε ένα νέο.");
          return;
        }
        
        // Create new player
        const playerRef = push(ref(db, "players"));
        if (!playerRef.key) throw new Error("Unable to create player id");

        const newPlayer: Player = {
          id: playerRef.key,
          name: nameValidation.sanitized!,
          score: 0,
          roomId: roomId,
          answers: [],
          isHost: false,
          hasAnswered: false,
        };

        await set(playerRef, newPlayer);

        // Store player info and redirect
        localStorage.setItem('playerId', playerRef.key);
        localStorage.setItem('playerName', nameValidation.sanitized!);
        localStorage.setItem('isHost', 'false');

        // Redirect to room
        window.location.href = `/room/${roomId}`;
      } else {
        setError("Ο κωδικός δωματίου δεν βρέθηκε. Ελέγξτε και δοκιμάστε ξανά.");
      }
    } catch (err) {
      console.error("Error joining room:", err);
      setError("Αποτυχία εισόδου στο δωμάτιο. Παρακαλώ δοκιμάστε ξανά.");
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
            ΕΙΣΟΔΟΣ ΣΤΟΝ ΝΑΟ
          </h1>
          <p className="greek-subtitle text-lg md:text-xl max-w-2xl mx-auto">
            Εισέλθετε στον ιστορικό αγώνα γνώσης
          </p>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Room Code Input */}
          <div className="parchment-bg p-6 md:p-8 mb-8 animate-scroll-reveal">
            <label htmlFor="roomCode" className="block text-lg font-bold mb-3 text-foreground">
              Κωδικός του Ναού
            </label>
            <input
              id="roomCode"
              type="text"
              value={roomCode}
              onChange={(e) => {
                setRoomCode(sanitizeInput(e.target.value).toUpperCase());
                setError(null);
              }}
              placeholder="Εισάγετε τον κωδικό δωματίου..."
              className="w-full px-4 py-3 text-lg border-2 border-parchment-border rounded-lg bg-parchment/50 focus:outline-none focus:ring-2 focus:ring-gold transition-all font-mono"
              maxLength={10}
            />
          </div>

          {/* Player Name Input */}
          <div className="marble-bg p-6 md:p-8 mb-8 animate-slide-up">
            <label htmlFor="playerName" className="block text-lg font-bold mb-3 text-foreground">
              Το Όνομά σας
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

          {/* Join Room Button */}
          <div className="text-center">
            <button
              onClick={joinRoom}
              disabled={loading || !playerName.trim() || !roomCode.trim()}
              className="gold-button px-8 py-4 text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed animate-pulse-gold"
            >
              {loading ? (
                <span className="inline-flex items-center">
                  <div className="animate-spin mr-2">⚡</div>
                  Είσοδος...
                </span>
              ) : (
                "🏛️ Είσοδος στον Αγώνα"
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
              Οδηγίες Εισόδου
            </h3>
            <div className="space-y-3 text-sm text-foreground/80">
              <div className="flex items-start">
                <span className="text-gold mr-2">1.</span>
                <span>Εισάγετε τον κωδικό του δωματίου που σας έδωσε ο Αρχιτέκτονας</span>
              </div>
              <div className="flex items-start">
                <span className="text-gold mr-2">2.</span>
                <span>Πληκτρολογήστε το όνομά σας για να αναγνωριστείτε</span>
              </div>
              <div className="flex items-start">
                <span className="text-gold mr-2">3.</span>
                <span>Πατήστε "Είσοδος στον Αγώνα" για να συμμετάσχετε</span>
              </div>
              <div className="flex items-start">
                <span className="text-gold mr-2">4.</span>
                <span>Περιμένετε τον Αρχιτέκτονα να ξεκινήσει το παιχνίδι</span>
              </div>
            </div>
          </div>

          {/* Back to Home */}
          <div className="text-center mt-6">
            <button
              onClick={() => window.location.href = '/'}
              className="text-foreground/60 hover:text-gold transition-colors underline text-sm"
            >
              ← Επιστροφή στην Αρχική
            </button>
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
            Κάθε ταξιδιώτης είναι μέλος της ιστορίας.
          </p>
        </div>
      </footer>

      {/* Floating Ancient Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-10 left-10 text-6xl opacity-10 animate-float" style={{ animationDelay: '0s' }}>🏛️</div>
        <div className="absolute top-20 right-20 text-4xl opacity-10 animate-float" style={{ animationDelay: '2s' }}>🏺</div>
        <div className="absolute bottom-20 left-20 text-5xl opacity-10 animate-float" style={{ animationDelay: '4s' }}>📜</div>
      </div>
    </div>
  );
}

export default function JoinRoom() {
  return (
    <Suspense fallback={
      <div className="min-h-screen pattern-greek-key flex items-center justify-center">
        <div className="text-foreground text-xl animate-pulse">Φόρτωση...</div>
      </div>
    }>
      <JoinRoomContent />
    </Suspense>
  );
}
