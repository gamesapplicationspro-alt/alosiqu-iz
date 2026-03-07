"use client";

import React, { useState } from "react";
import { query, where, getDocs, collection } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function JoinRoom() {
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [loading, setLoading] = useState(false);

  const joinRoom = async () => {
    if (!roomCode || !playerName) return;
    setLoading(true);
    try {
      const q = query(collection(db, "rooms"), where("code", "==", roomCode.toUpperCase()));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const roomDoc = querySnapshot.docs[0];
        // Redirect to room page with player name
        window.location.href = `/room/${roomDoc.id}?name=${encodeURIComponent(playerName)}`;
      } else {
        alert("Δωμάτιο δεν βρέθηκε");
      }
    } catch (error) {
      console.error("Error joining room:", error);
      alert("Σφάλμα στην είσοδο");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-black p-8">
      <h1 className="text-2xl font-bold mb-4">Είσοδος σε Δωμάτιο</h1>
      <input
        type="text"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        placeholder="Όνομα Παίκτη"
        className="border p-2 rounded mb-4 w-64"
      />
      <input
        type="text"
        value={roomCode}
        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
        placeholder="Κωδικός Δωματίου"
        className="border p-2 rounded mb-4 w-64 text-center text-lg font-mono"
        maxLength={6}
      />
      <button
        onClick={joinRoom}
        disabled={!roomCode || !playerName || loading}
        className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600 disabled:opacity-50"
      >
        {loading ? "Είσοδος..." : "Είσοδος"}
      </button>
    </div>
  );
}
