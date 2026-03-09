"use client";



import React, { useEffect, useReducer } from "react";

import { QUESTIONS } from "../lib/questions";

import QuestionCard from "./components/QuestionCard";

import ProgressBar from "./components/ProgressBar";

import ErrorBoundary from "./components/ErrorBoundary";

import { getDb } from "../lib/firebase";

import { Question } from "../types";



interface State {

  questions: Question[];

  currentIndex: number;

  selectedAnswer: string | null;

  score: number;

  completed: boolean;

  error: string | null;

}



type Action =

  | { type: "start" }

  | { type: "select"; answerId: string }

  | { type: "next" }

  | { type: "restart" }

  | { type: "error"; message: string };



function shuffle<T>(array: T[]): T[] {

  const a = [...array];

  for (let i = a.length - 1; i > 0; i--) {

    const j = Math.floor(Math.random() * (i + 1));

    [a[i], a[j]] = [a[j], a[i]];

  }

  return a;

}



function reducer(state: State, action: Action): State {

  switch (action.type) {

    case "start": {

      const shuffled = shuffle(QUESTIONS);

      return {

        questions: shuffled,

        currentIndex: 0,

        selectedAnswer: null,

        score: 0,

        completed: false,

        error: null,

      };

    }

    case "select": {

      if (state.selectedAnswer !== null) return state; // already answered

      const correct = state.questions[state.currentIndex].correctAnswerId;

      const isCorrect = action.answerId === correct;

      return {

        ...state,

        selectedAnswer: action.answerId,

        score: state.score + (isCorrect ? 1 : 0),

      };

    }

    case "next": {

      if (state.currentIndex + 1 >= state.questions.length) {

        return { ...state, completed: true };

      }

      return {

        ...state,

        currentIndex: state.currentIndex + 1,

        selectedAnswer: null,

      };

    }

    case "restart": {

      return reducer(state, { type: "start" });

    }

    case "error": {

      return { ...state, error: action.message };

    }

    default:

      return state;

  }

}



export default function QuizPage() {

  const [state, dispatch] = useReducer(reducer, {

    questions: [],

    currentIndex: 0,

    selectedAnswer: null,

    score: 0,

    completed: false,

    error: null,

  });



  // try to import firebase dynamically so app still works without config

  useEffect(() => {

    try {

      dispatch({ type: "start" });

    } catch (e: any) {

      dispatch({ type: "error", message: e.message });

    }

  }, []);



  // save result to realtime database when quiz completes (optional)

  useEffect(() => {

    if (!state.completed) return;

    (async () => {

      try {

        const { ref, push, set } = await import("firebase/database");

        const db = await getDb();

        const resultsRef = ref(db, "results");

        const newResultRef = push(resultsRef);

        await set(newResultRef, {

          score: state.score,

          total: state.questions.length,

          timestamp: new Date().toISOString(),

        });

      } catch (err) {

        console.warn("Unable to save result to Realtime Database:", err);

      }

    })();

  }, [state.completed]);



  if (state.error) {

    return (

      <div className="p-8 text-red-600 dark:text-red-400">

        Σφάλμα: {state.error}

      </div>

    );

  }



  // guard against initial empty questions (server or immediately after mount)

  if (state.questions.length === 0) {

    return (

      <div className="flex min-h-screen items-center justify-center">

        Φόρτωση...

      </div>

    );

  }



  if (state.completed) {

    return (

      <div className="flex flex-col items-center justify-center p-8">

        <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-gray-50">

          Ολοκληρώθηκε!

        </h1>

        <p className="mb-6 text-xl text-gray-700 dark:text-gray-300">

          Σκορ: {state.score} / {state.questions.length}

        </p>

        <button

          className="rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"

          onClick={() => dispatch({ type: "restart" })}

        >

          Ξεκίνα πάλι

        </button>

      </div>

    );

  }



  const currentQuestion = state.questions[state.currentIndex];



  return (

    <ErrorBoundary>

      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-100 to-orange-50 dark:from-amber-900 dark:via-yellow-900 dark:to-orange-900 py-12 px-4 animate-fade-in">

        <div className="mx-auto max-w-3xl">

          <ProgressBar

            current={state.currentIndex + 1}

            total={state.questions.length}

          />

          <QuestionCard

            question={currentQuestion}

            onSelect={(id) => dispatch({ type: "select", answerId: id })}

            selectedAnswerId={state.selectedAnswer}

          />

          <div className="mt-6 flex justify-end">

            <button

              className="rounded-lg bg-gradient-to-r from-amber-600 to-yellow-600 px-6 py-3 text-white font-semibold hover:from-amber-700 hover:to-yellow-700 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl animate-glow"

              disabled={state.selectedAnswer === null}

              onClick={() => dispatch({ type: "next" })}

            >

              Επόμενο

            </button>

          </div>

        </div>

      </div>

    </ErrorBoundary>

  );

}

