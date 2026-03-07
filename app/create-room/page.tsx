"use client";

import React, { useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { QUESTIONS } from "../../lib/questions";
import { Room } from "../../types";

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
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-black p-8">
      <h1 className="text-2xl font-bold mb-4">Δημιουργία Δωματίου</h1>
      <div className="mb-4">
        <button
          onClick={generateCode}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Δημιουργία Κωδικού
        </button>
      </div>
      <input
        type="text"
        value={roomCode}
        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
        placeholder="Κωδικός Δωματίου"
        className="border p-2 rounded mb-4 text-center text-lg font-mono"
        maxLength={6}
      />
      <button
        onClick={createRoom}
        disabled={!roomCode || loading}
        className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600 disabled:opacity-50"
      >
        {loading ? "Δημιουργία..." : "Δημιουργία Δωματίου"}
      </button>
    </div>
  );
}
