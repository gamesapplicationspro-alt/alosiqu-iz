"use client";

import React, { useState } from "react";
import { Room, Player } from "@/types";

export default function JoinRoom() {
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [loading, setLoading] = useState(false);

  const joinRoom = async () => {
    if (!roomCode || !playerName) return;
    setLoading(true);
    try {
      const code = roomCode.toUpperCase();
      const roomKey = `room:${code}`;
      
      // Try sessionStorage first (real-time sync)
      let stored = sessionStorage.getItem(roomKey);
      if (!stored) {
        // Fallback to localStorage
        stored = localStorage.getItem(roomKey);
      }
      
      if (!stored) {
        alert("Δωμάτιο δεν βρέθηκε. Βεβαιωθείτε ότι ο κωδικός είναι σωστός.");
        return;
      }

      const { room, players } = JSON.parse(stored);

      const newPlayer: Player = {
        id: "player-" + Math.random().toString(36).substring(2, 9),
        name: playerName,
        score: 0,
        roomId: room.id,
        answers: [],
      };

      const updatedPlayers = [...players, newPlayer];
      const roomData = { room, players: updatedPlayers };
      
      // Save to both sessionStorage and localStorage
      sessionStorage.setItem(roomKey, JSON.stringify(roomData));
      localStorage.setItem(roomKey, JSON.stringify(roomData));
      
      // Save current player ID
      sessionStorage.setItem(`currentPlayerId:${code}`, newPlayer.id);
      localStorage.setItem(`currentPlayerId:${code}`, newPlayer.id);

      // Redirect to room URL
      window.location.href = `/room/${code}`;
    } catch (error) {
      console.error("Error joining room:", error);
      alert(`Σφάλμα στην είσοδο: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-amber-50 via-yellow-100 to-orange-50 dark:from-amber-900 dark:via-yellow-900 dark:to-orange-900 p-8 animate-fade-in">
      <div className="w-full max-w-md parchment-bg rounded-lg p-8 shadow-2xl animate-slide-up">
        <h1 className="text-2xl font-bold mb-6 text-center text-amber-900 dark:text-amber-100">Είσοδος σε Δωμάτιο</h1>
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Όνομα Παίκτη"
          className="w-full border-2 border-amber-600 p-3 rounded-md mb-4 bg-yellow-50 dark:bg-yellow-900 text-amber-900 dark:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <input
          type="text"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          placeholder="Κωδικός Δωματίου"
          className="w-full border-2 border-amber-600 p-3 rounded-md mb-6 text-center text-lg font-mono bg-yellow-50 dark:bg-yellow-900 text-amber-900 dark:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase"
          maxLength={6}
          autoFocus
        />
        <button
          onClick={joinRoom}
          disabled={!roomCode || !playerName || loading}
          className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-purple-800 px-4 py-3 text-white font-semibold hover:from-purple-700 hover:to-purple-900 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:transform-none"
        >
          {loading ? "Είσοδος..." : "Είσοδος"}
        </button>
      </div>
    </div>
  );
}
