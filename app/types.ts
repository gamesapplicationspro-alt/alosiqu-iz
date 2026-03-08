export interface Answer {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  text: string;
  answers: Answer[];
  correctAnswerId: string;
}

export interface Room {
  id: string;
  code: string;
  hostId: string;
  questions: Question[];
  currentQuestionIndex: number;
  status: 'waiting' | 'active' | 'finished';
  timer: number; // seconds left for current question
  createdAt: string;
}

export interface Player {
  id: string;
  name: string;
  isHost?: boolean;
  score: number;
  roomId: string;
  answers: { questionId: string; answerId: string; time: number }[];
  hasAnswered?: boolean;
}
