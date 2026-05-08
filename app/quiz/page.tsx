"use client";

import React, { useEffect, useReducer, useState } from "react";
import { QUESTIONS } from "../lib/questions";
import QuestionCard from "./components/QuestionCard";
import ProgressBar from "./components/ProgressBar";
import ErrorBoundary from "./components/ErrorBoundary";
import { ref } from "firebase/database";
import { getDb } from "../lib/firebase";
import { Question } from "../types";
import { validatePlayerName, sanitizeInput } from "../../lib/security";

interface State {
  questions: Question[];
  currentIndex: number;
  selectedAnswer: string | null;
  score: number;
  timeLeft: number;
  showResult: boolean;
  isCompleted: boolean;
  playerName: string;
  loading: boolean;
}

type Action =
  | { type: "SET_QUESTIONS"; payload: Question[] }
  | { type: "SET_CURRENT_INDEX"; payload: number }
  | { type: "SET_SELECTED_ANSWER"; payload: string | null }
  | { type: "SET_SCORE"; payload: number }
  | { type: "DECREMENT_TIMER" }
  | { type: "SET_TIMER"; payload: number }
  | { type: "SHOW_RESULT" }
  | { type: "HIDE_RESULT" }
  | { type: "SET_COMPLETED" }
  | { type: "SET_PLAYER_NAME"; payload: string }
  | { type: "SET_LOADING"; payload: boolean };

const initialState: State = {
  questions: [],
  currentIndex: 0,
  selectedAnswer: null,
  score: 0,
  timeLeft: 15,
  showResult: false,
  isCompleted: false,
  playerName: "",
  loading: false,
};

function quizReducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_QUESTIONS":
      return { ...state, questions: action.payload };
    case "SET_CURRENT_INDEX":
      return { 
        ...state, 
        currentIndex: action.payload, 
        selectedAnswer: null, 
        showResult: false,
        timeLeft: 15 
      };
    case "SET_SELECTED_ANSWER":
      return { ...state, selectedAnswer: action.payload };
    case "SET_SCORE":
      return { ...state, score: action.payload };
    case "DECREMENT_TIMER":
      return { ...state, timeLeft: Math.max(0, state.timeLeft - 1) };
    case "SET_TIMER":
      return { ...state, timeLeft: action.payload };
    case "SHOW_RESULT":
      return { ...state, showResult: true };
    case "HIDE_RESULT":
      return { ...state, showResult: false };
    case "SET_COMPLETED":
      return { ...state, isCompleted: true };
    case "SET_PLAYER_NAME":
      return { ...state, playerName: action.payload };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    default:
      return state;
  }
}

export default function QuizPage() {
  const [state, dispatch] = useReducer(quizReducer, initialState);
  const [error, setError] = useState<string | null>();

  useEffect(() => {
    // Get stored player name
    const storedName = localStorage.getItem('playerName');
    if (storedName) {
      dispatch({ type: "SET_PLAYER_NAME", payload: storedName });
    } else {
      // Redirect to home if no player name
      window.location.href = '/';
      return;
    }
    
    // Shuffle and set questions
    const shuffledQuestions = [...QUESTIONS].sort(() => Math.random() - 0.5);
    dispatch({ type: "SET_QUESTIONS", payload: shuffledQuestions });
    
    // Add animations
    const timer = setTimeout(() => {
      document.querySelectorAll('.animate-float').forEach((el, index) => {
        (el as HTMLElement).style.animationDelay = `${index * 0.3}s`;
      });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (state.questions.length === 0 || state.isCompleted) return;

    const timer = setInterval(() => {
      dispatch({ type: "DECREMENT_TIMER" });
    }, 1000);

    return () => clearInterval(timer);
  }, [state.currentIndex, state.questions.length, state.isCompleted]);

  useEffect(() => {
    if (state.timeLeft === 0 && !state.showResult && state.questions.length > 0) {
      handleAnswerSubmit();
    }
  }, [state.timeLeft, state.showResult, state.questions.length]);

  const currentQuestion = state.questions[state.currentIndex];

  const handleAnswerSelect = (answerId: string) => {
    if (state.showResult) return;
    dispatch({ type: "SET_SELECTED_ANSWER", payload: answerId });
  };

  const handleAnswerSubmit = async () => {
    if (!state.selectedAnswer || !currentQuestion || state.showResult) return;

    dispatch({ type: "SHOW_RESULT" });

    const isCorrect = state.selectedAnswer === currentQuestion.correctAnswerId;
    if (isCorrect) {
      dispatch({ type: "SET_SCORE", payload: state.score + 1 });
    }

    // Save to Firebase if logged in
    try {
      const db = await getDb();
      const playerId = localStorage.getItem('playerId');
      if (playerId) {
        // This would save to player's history
        console.log('Saving quiz result to Firebase');
      }
    } catch (err) {
      console.error('Error saving to Firebase:', err);
    }

    // Move to next question after delay
    setTimeout(() => {
      if (state.currentIndex < state.questions.length - 1) {
        dispatch({ type: "SET_CURRENT_INDEX", payload: state.currentIndex + 1 });
      } else {
        dispatch({ type: "SET_COMPLETED" });
        saveScoreToHistory();
      }
    }, 2000);
  };

  const saveScoreToHistory = async () => {
    try {
      const db = await getDb();
      const playerId = localStorage.getItem('playerId');
      
      if (playerId) {
        // Save to player's quiz history
        const historyRef = ref(db, `quizHistory/${playerId}`);
        const newEntry = {
          score: state.score,
          totalQuestions: state.questions.length,
          percentage: Math.round((state.score / state.questions.length) * 100),
          date: new Date().toISOString(),
          playerName: state.playerName
        };
        
        // This would push to Firebase
        console.log('Saving to history:', newEntry);
      }
    } catch (err) {
      console.error('Error saving history:', err);
    }
  };

  const restartQuiz = () => {
    const shuffledQuestions = [...QUESTIONS].sort(() => Math.random() - 0.5);
    dispatch({ type: "SET_QUESTIONS", payload: shuffledQuestions });
    dispatch({ type: "SET_CURRENT_INDEX", payload: 0 });
    dispatch({ type: "SET_SCORE", payload: 0 });
    dispatch({ type: "SET_COMPLETED" });
    dispatch({ type: "SET_TIMER", payload: 15 });
  };

  if (state.loading) {
    return (
      <div className="min-h-screen pattern-greek-key flex items-center justify-center">
        <div className="text-foreground text-xl animate-pulse">Φόρτωση του Αγώνα...</div>
      </div>
    );
  }

  if (state.isCompleted) {
    const percentage = Math.round((state.score / state.questions.length) * 100);
    return (
      <div className="min-h-screen pattern-greek-key">
        <header className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-transparent"></div>
          <div className="relative z-10 text-center py-8 px-4">
            <h1 className="greek-title text-4xl md:text-6xl mb-4 animate-float">
              ΟΛΟΚΛΗΡΩΣΗ ΑΓΩΝΑ
            </h1>
            <p className="greek-subtitle text-lg md:text-xl max-w-2xl mx-auto">
              {state.playerName}, η ιστορική σας πρόκληση ολοκληρώθηκε!
            </p>
          </div>
        </header>

        <main className="relative z-10 container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            <div className="marble-bg p-8 md:p-12 animate-scroll-reveal">
              <div className="text-center mb-8">
                <div className="text-6xl mb-4 animate-pulse-gold">
                  {percentage >= 80 ? '🏆' : percentage >= 60 ? '🥈' : percentage >= 40 ? '🥉' : '📜'}
                </div>
                <h2 className="greek-title text-2xl md:text-3xl mb-4">
                  Αποτελέσματα
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="parchment-bg p-6 rounded-lg">
                    <div className="text-3xl font-bold text-gold mb-2">{state.score}</div>
                    <div className="text-sm text-foreground/70">Σωστές Απαντήσεις</div>
                  </div>
                  <div className="parchment-bg p-6 rounded-lg">
                    <div className="text-3xl font-bold text-bronze mb-2">{state.questions.length - state.score}</div>
                    <div className="text-sm text-foreground/70">Λάθος Απαντήσεις</div>
                  </div>
                  <div className="parchment-bg p-6 rounded-lg">
                    <div className="text-3xl font-bold text-purple-royal mb-2">{percentage}%</div>
                    <div className="text-sm text-foreground/70">Ποσοστό Επιτυχίας</div>
                  </div>
                </div>
              </div>

              <div className="text-center space-y-4">
                <button
                  onClick={restartQuiz}
                  className="gold-button px-8 py-4 text-xl font-bold"
                >
                  🔄 Νέα Πρόκληση
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
          </div>
        </main>

        <footer className="relative z-10 mt-16 border-t-4 border-double border-parchment bg-parchment/50">
          <div className="container mx-auto px-4 py-8 text-center">
            <div className="greek-subtitle text-lg mb-4">
              ΑΛΟΣΙΚΟΥ ΙΣΤΟΡΙΑ © 2024
            </div>
            <p className="text-foreground/70 text-sm max-w-2xl mx-auto">
              Κάθε ολοκλήρωση είναι ένα νέο κεφάλαιο στην ιστορία της γνώσης.
            </p>
          </div>
        </footer>

        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-10 left-10 text-6xl opacity-10 animate-float" style={{ animationDelay: '0s' }}>🏆</div>
          <div className="absolute top-20 right-20 text-4xl opacity-10 animate-float" style={{ animationDelay: '2s' }}>📜</div>
          <div className="absolute bottom-20 left-20 text-5xl opacity-10 animate-float" style={{ animationDelay: '4s' }}>⚡</div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen pattern-greek-key">
        <header className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-transparent"></div>
          <div className="relative z-10 text-center py-8 px-4">
            <h1 className="greek-title text-4xl md:text-6xl mb-4 animate-float">
              ΙΣΤΟΡΙΚΗ ΠΡΟΚΛΗΣΗ
            </h1>
            <p className="greek-subtitle text-lg md:text-xl max-w-2xl mx-auto">
              {state.playerName}, δοκιμάστε τις γνώσεις σας στην αρχαία ελληνική ιστορία
            </p>
          </div>
        </header>

        <main className="relative z-10 container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            {/* Progress Bar */}
            <div className="mb-8 animate-slide-up">
              <ProgressBar 
                current={state.currentIndex + 1} 
                total={state.questions.length}
              />
            </div>

            {/* Question Card */}
            {currentQuestion && (
              <div className="animate-scroll-reveal">
                <QuestionCard
                  question={currentQuestion}
                  selectedAnswerId={state.selectedAnswer}
                  onSelect={handleAnswerSelect}
                />
              </div>
            )}

            {/* Navigation */}
            <div className="text-center mt-8 space-y-4">
              <button
                onClick={() => window.location.href = '/'}
                className="text-foreground/60 hover:text-gold transition-colors underline text-sm"
              >
                ← Επιστροφή στην Αρχική
              </button>
            </div>
          </div>
        </main>

        <footer className="relative z-10 mt-16 border-t-4 border-double border-parchment bg-parchment/50">
          <div className="container mx-auto px-4 py-8 text-center">
            <div className="greek-subtitle text-lg mb-4">
              ΑΛΟΣΙΚΟΥ ΙΣΤΟΡΙΑ © 2024
            </div>
            <p className="text-foreground/70 text-sm max-w-2xl mx-auto">
              Κάθε ερώτηση είναι ένα ταξίδι στον χρόνο.
            </p>
          </div>
        </footer>

        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-10 left-10 text-6xl opacity-10 animate-float" style={{ animationDelay: '0s' }}>📜</div>
          <div className="absolute top-20 right-20 text-4xl opacity-10 animate-float" style={{ animationDelay: '2s' }}>🏛️</div>
          <div className="absolute bottom-20 left-20 text-5xl opacity-10 animate-float" style={{ animationDelay: '4s' }}>⚡</div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
