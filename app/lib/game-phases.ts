export const QUESTION_DURATION_MS = 20_000;
export const REVEAL_DURATION_MS = 5_000;
export const SCOREBOARD_DURATION_MS = 4_000;

export type GamePhase = "lobby" | "question" | "reveal" | "scoreboard" | "finished";

export function durationForPhase(phase: GamePhase): number | null {
  if (phase === "question") return QUESTION_DURATION_MS;
  if (phase === "reveal") return REVEAL_DURATION_MS;
  if (phase === "scoreboard") return SCOREBOARD_DURATION_MS;
  return null;
}

export function scoreForAnswer(remainingMs: number): number {
  const bounded = Math.max(0, Math.min(QUESTION_DURATION_MS, remainingMs));
  return 1_000 + Math.round((bounded / QUESTION_DURATION_MS) * 500);
}
