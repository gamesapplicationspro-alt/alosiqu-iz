"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { validateRoomCode, validatePlayerName, sanitizeInput } from "../lib/security";

export default function HomePage() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [validationErrors, setValidationErrors] = useState<{ name?: string; code?: string }>({});

  useEffect(() => {
    // Add some ambient animations
    const timer = setTimeout(() => {
      document.querySelectorAll('.animate-float').forEach((el, index) => {
        (el as HTMLElement).style.animationDelay = `${index * 0.5}s`;
      });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSoloPlay = () => {
    const nameValidation = validatePlayerName(playerName);
    if (!nameValidation.isValid) {
      setValidationErrors({ name: nameValidation.error });
      return;
    }
    
    // Store player name and redirect to quiz
    localStorage.setItem('playerName', nameValidation.sanitized!);
    router.push('/quiz');
  };

  const handleCreateRoom = () => {
    const nameValidation = validatePlayerName(playerName);
    if (!nameValidation.isValid) {
      setValidationErrors({ name: nameValidation.error });
      return;
    }
    
    localStorage.setItem('playerName', nameValidation.sanitized!);
    router.push('/create-room');
  };

  const handleJoinRoom = () => {
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
      setValidationErrors(errors);
      return;
    }
    
    localStorage.setItem('playerName', nameValidation.sanitized!);
    router.push(`/join-room?code=${codeValidation.sanitized}`);
  };

  const clearError = (field: 'name' | 'code') => {
    setValidationErrors(prev => ({ ...prev, [field]: undefined }));
  };

  return (
    <div className="min-h-screen pattern-greek-key">
      {/* Ancient Greek Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-transparent"></div>
        <div className="relative z-10 text-center py-8 px-4">
          <h1 className="greek-title text-4xl md:text-6xl mb-4 animate-float">
            ΑΛΟΣΙΚΟΥ ΙΣΤΟΡΙΑ
          </h1>
          <p className="greek-subtitle text-lg md:text-xl max-w-2xl mx-auto">
            Ταξιδέψτε στον αρχαίο ελληνικό κόσμο της γνώσης
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Player Name Input */}
          <div className="marble-bg p-6 md:p-8 mb-8 animate-scroll-reveal">
            <label htmlFor="playerName" className="block text-lg font-bold mb-3 text-foreground">
              Το Όνομά σου στην Ιστορία
            </label>
            <input
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => {
                setPlayerName(sanitizeInput(e.target.value));
                clearError('name');
              }}
              placeholder="Εισάγετε το αρχαίο ελληνικό σας όνομα..."
              className="w-full px-4 py-3 text-lg border-2 border-stone rounded-lg bg-marble/50 focus:outline-none focus:ring-2 focus:ring-gold transition-all"
              maxLength={20}
            />
            {validationErrors.name && (
              <div className="error-parchment mt-3 p-3 rounded-lg text-sm">
                {validationErrors.name}
              </div>
            )}
          </div>

          {/* Game Options */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {/* Solo Play */}
            <div className="parchment-bg p-6 interactive-card animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <div className="text-center">
                <div className="text-4xl mb-4 animate-float">🏛️</div>
                <h2 className="greek-title text-xl mb-3">Μόνος Πάικτης</h2>
                <p className="text-foreground/80 mb-6 text-sm">
                  Δοκιμάστε τις γνώσεις σας μόνοι σας στην πρόκληση της ιστορίας
                </p>
                <button
                  onClick={handleSoloPlay}
                  disabled={!playerName.trim()}
                  className="bronze-button w-full py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Εκκίνηση Μάχης
                </button>
              </div>
            </div>

            {/* Create Room */}
            <div className="parchment-bg p-6 interactive-card animate-slide-up" style={{ animationDelay: '0.4s' }}>
              <div className="text-center">
                <div className="text-4xl mb-4 animate-float">🏺</div>
                <h2 className="greek-title text-xl mb-3">Δημιουργία Δωματίου</h2>
                <p className="text-foreground/80 mb-6 text-sm">
                  Γίνετε ο Αρχιτέκτονας του δικού σας ιστορικού αγώνα
                </p>
                <button
                  onClick={handleCreateRoom}
                  disabled={!playerName.trim()}
                  className="gold-button w-full py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Ανέγερση Ναού
                </button>
              </div>
            </div>

            {/* Join Room */}
            <div className="parchment-bg p-6 interactive-card animate-slide-up" style={{ animationDelay: '0.6s' }}>
              <div className="text-center">
                <div className="text-4xl mb-4 animate-float">🏛️</div>
                <h2 className="greek-title text-xl mb-3">Είσοδος σε Δωμάτιο</h2>
                <p className="text-foreground/80 mb-6 text-sm">
                  Εισέλθετε σε υπάρχον ιστορικό αγώνα γνώσης
                </p>
                
                <div className="mb-4">
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => {
                      setRoomCode(sanitizeInput(e.target.value).toUpperCase());
                      clearError('code');
                    }}
                    placeholder="Κωδικός Δωματίου"
                    className="w-full px-4 py-2 text-lg border-2 border-stone rounded-lg bg-marble/50 focus:outline-none focus:ring-2 focus:ring-gold transition-all mb-3"
                    maxLength={10}
                  />
                  {validationErrors.code && (
                    <div className="error-parchment p-2 rounded text-xs">
                      {validationErrors.code}
                    </div>
                  )}
                </div>
                
                <button
                  onClick={handleJoinRoom}
                  disabled={!playerName.trim() || !roomCode.trim()}
                  className="bronze-button w-full py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Είσοδος στον Αγώνα
                </button>
              </div>
            </div>
          </div>

          {/* Features Section */}
          <div className="marble-bg p-8 mt-12 animate-scroll-reveal" style={{ animationDelay: '0.8s' }}>
            <h2 className="greek-title text-2xl md:text-3xl text-center mb-8">
              Χαρακτηριστικά του Αγώνα
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl mb-3 text-gold">📚</div>
                <h3 className="font-bold text-lg mb-2">Ιστορικές Ερωτήσεις</h3>
                <p className="text-foreground/70 text-sm">
                  Ερωτήσεις από την αρχαία ελληνική ιστορία και μυθολογία
                </p>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-3 text-bronze">⚡</div>
                <h3 className="font-bold text-lg mb-2">Γρήγορο Παιχνίδι</h3>
                <p className="text-foreground/70 text-sm">
                  Πραγματικός χρόνος και ανταγωνισμός μεταξύ παικτών
                </p>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-3 text-purple-royal">🏆</div>
                <h3 className="font-bold text-lg mb-2">Κατάταξη</h3>
                <p className="text-foreground/70 text-sm">
                  Ζωντανή κατάταξη και στατιστικά για όλους τους παίκτες
                </p>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-3 text-olive">🛡️</div>
                <h3 className="font-bold text-lg mb-2">Ασφάλεια</h3>
                <p className="text-foreground/70 text-sm">
                  Πλήρης προστασία και έλεγχος για δίκαιο παιχνίδι
                </p>
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
            Ένα εκπαιδευτικό παιχνίδι γνώσης εμπνευσμένο από την αρχαία ελληνική ιστορία και φιλοσοφία.
            Μαθήτε, παίξτε και γίνετε μάρτυρες της ιστορίας!
          </p>
          <div className="mt-6 flex justify-center space-x-8 text-foreground/60 text-sm">
            <Link href="/about" className="hover:text-gold transition-colors">
              Σχετικά με το Παιχνίδι
            </Link>
            <Link href="/history" className="hover:text-gold transition-colors">
              Ιστορικό Αγώνα
            </Link>
            <Link href="/leaderboard" className="hover:text-gold transition-colors">
              Πίνακας Κατάταξης
            </Link>
          </div>
        </div>
      </footer>

      {/* Floating Ancient Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-10 left-10 text-6xl opacity-10 animate-float" style={{ animationDelay: '0s' }}>🏛️</div>
        <div className="absolute top-20 right-20 text-4xl opacity-10 animate-float" style={{ animationDelay: '2s' }}>🏺</div>
        <div className="absolute bottom-20 left-20 text-5xl opacity-10 animate-float" style={{ animationDelay: '4s' }}>📜</div>
        <div className="absolute bottom-10 right-10 text-3xl opacity-10 animate-float" style={{ animationDelay: '6s' }}>⚡</div>
      </div>
    </div>
  );
}
