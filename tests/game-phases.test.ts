import { describe, expect, it } from "vitest";
import { QUESTION_DURATION_MS, REVEAL_DURATION_MS, SCOREBOARD_DURATION_MS, durationForPhase, scoreForAnswer } from "../app/lib/game-phases";

describe("quiz phase rules", () => {
  it("uses the agreed Kahoot-like phase durations", () => {
    expect(durationForPhase("question")).toBe(QUESTION_DURATION_MS);
    expect(durationForPhase("reveal")).toBe(REVEAL_DURATION_MS);
    expect(durationForPhase("scoreboard")).toBe(SCOREBOARD_DURATION_MS);
    expect(durationForPhase("lobby")).toBeNull();
  });

  it("awards more points for a faster correct answer and clamps invalid time", () => {
    expect(scoreForAnswer(QUESTION_DURATION_MS)).toBe(1500);
    expect(scoreForAnswer(0)).toBe(1000);
    expect(scoreForAnswer(-100)).toBe(1000);
    expect(scoreForAnswer(QUESTION_DURATION_MS + 500)).toBe(1500);
  });
});
