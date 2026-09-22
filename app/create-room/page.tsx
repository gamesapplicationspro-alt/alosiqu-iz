"use client";

import React, { useState } from "react";
import { secureRequest } from "../lib/session";

export default function CreateRoom() {
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateCode = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomCode(code);
  };

  const createRoom = async () => {
    if (!roomCode) return;
    setLoading(true);
    setError(null);
    
    try {
      const hostName = localStorage.getItem("playerName")?.trim() || "Host";
      const result = await secureRequest("/api/rooms", {
        method: "POST",
        body: JSON.stringify({ name: hostName, code: roomCode }),
      });
      window.location.href = `/room/${result.roomId}`;
    } catch (error) {
      console.error("Error creating room:", error);
      setError(error instanceof Error ? error.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-amber-50 via-yellow-100 to-orange-50 dark:from-amber-900 dark:via-yellow-900 dark:to-orange-900 p-4 sm:p-6 lg:p-8 animate-fade-in">
      <div className="w-full max-w-sm sm:max-w-md parchment-bg rounded-lg p-6 sm:p-8 shadow-2xl animate-slide-up">
        <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-center text-amber-900 dark:text-amber-100">Δημιουργία Δωματίου</h1>
        <div className="mb-4 sm:mb-6">
          <button
            onClick={generateCode}
            className="w-full rounded-lg bg-gradient-to-r from-amber-600 to-yellow-600 px-4 py-3 text-white font-semibold hover:from-amber-700 hover:to-yellow-700 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl text-sm sm:text-base"
          >
            Δημιουργία Κωδικού
          </button>
        </div>
        <input
          type="text"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          placeholder="Κωδικός Δωματίου"
          className="w-full border-2 border-amber-600 p-3 rounded-md mb-4 sm:mb-6 text-center text-base sm:text-lg font-mono bg-yellow-50 dark:bg-yellow-900 text-amber-900 dark:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
          maxLength={6}
        />
        {error && (
          <div className="w-full p-3 sm:p-4 mb-4 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
            <p className="font-semibold">Σφάλμα:</p>
            <p>{error}</p>
            <p className="text-xs sm:text-sm mt-2">Ελέγξτε τη ρύθμιση Firebase και Vercel.</p>
          </div>
        )}
        
        <button
          onClick={createRoom}
          disabled={!roomCode || loading}
          className="w-full rounded-lg bg-gradient-to-r from-green-600 to-green-800 px-4 py-3 text-white font-semibold hover:from-green-700 hover:to-green-900 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:transform-none text-sm sm:text-base"
        >
          {loading ? "Δημιουργία..." : "Δημιουργία Δωματίου"}
        </button>
      </div>
    </div>
  );
}
