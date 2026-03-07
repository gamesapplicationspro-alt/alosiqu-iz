"use client";

import React, { useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { QUESTIONS } from "@/lib/questions";
import { Room } from "@/types";

export default function CreateRoom() {
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);

  const generateCode = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomCode(code);
  };

  const createRoom = async () => {
    if (!roomCode) return;
    setLoading(true);
    try {
      const shuffledQuestions = [...QUESTIONS].sort(() => Math.random() - 0.5);
      const room: Omit<Room, 'id'> = {
        code: roomCode,
        hostId: "host-" + Date.now(), // simple host ID
        questions: shuffledQuestions,
        currentQuestionIndex: 0,
        status: 'waiting',
        timer: 30, // 30 seconds per question
        createdAt: new Date(),
      };
      const docRef = await addDoc(collection(db, "rooms"), room);
      // Redirect to room page
      window.location.href = `/room/${docRef.id}`;
    } catch (error) {
      console.error("Error creating room:", error);
      alert("Σφάλμα στη δημιουργία δωματίου");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-amber-50 via-yellow-100 to-orange-50 dark:from-amber-900 dark:via-yellow-900 dark:to-orange-900 p-8 animate-fade-in">
      <div className="w-full max-w-md parchment-bg rounded-lg p-8 shadow-2xl animate-slide-up">
        <h1 className="text-2xl font-bold mb-6 text-center text-amber-900 dark:text-amber-100">Δημιουργία Δωματίου</h1>
        <div className="mb-6">
          <button
            onClick={generateCode}
            className="w-full rounded-lg bg-gradient-to-r from-amber-600 to-yellow-600 px-4 py-3 text-white font-semibold hover:from-amber-700 hover:to-yellow-700 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            Δημιουργία Κωδικού
          </button>
        </div>
        <input
          type="text"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          placeholder="Κωδικός Δωματίου"
          className="w-full border-2 border-amber-600 p-3 rounded-md mb-6 text-center text-lg font-mono bg-yellow-50 dark:bg-yellow-900 text-amber-900 dark:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
          maxLength={6}
        />
        <button
          onClick={createRoom}
          disabled={!roomCode || loading}
          className="w-full rounded-lg bg-gradient-to-r from-green-600 to-green-800 px-4 py-3 text-white font-semibold hover:from-green-700 hover:to-green-900 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:transform-none"
        >
          {loading ? "Δημιουργία..." : "Δημιουργία Δωματίου"}
        </button>
      </div>
    </div>
  );
}
