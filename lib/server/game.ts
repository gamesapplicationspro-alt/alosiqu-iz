import { randomBytes } from "crypto";
import { QUESTIONS } from "../../app/lib/questions";
import { QUESTION_DURATION_MS, REVEAL_DURATION_MS, SCOREBOARD_DURATION_MS, type GamePhase } from "../../app/lib/game-phases";
import type { Question } from "../../app/types";
import { adminDb } from "@server/server/firebase-admin";
import { PublicApiError } from "@server/server/request-auth";

export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
export { QUESTION_DURATION_MS, REVEAL_DURATION_MS, SCOREBOARD_DURATION_MS };

export type PublicAnswer = { id: string; text: string };
export type PublicQuestion = { id: string; text: string; answers: PublicAnswer[]; explanation?: string; source?: string };
export type V3Room = {
  id: string; code: string; phase: GamePhase; questionIndex: number; round: number; version: number;
  questions: PublicQuestion[]; createdAt: number; expiresAt: number; phaseEndsAt: number | null;
  revealCorrectAnswerId: string | null; paused?: boolean; pausedRemainingMs?: number | null;
};
export type V3Player = {
  name: string; score: number; participates: boolean; joinedAt: number;
  answeredRound: number; lastScoredRound: number;
};

export function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  return /^[a-zA-Z\u0370-\u03FF0-9\s\-']{2,20}$/.test(name) ? name : null;
}

export function normalizeCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9]{4,10}$/.test(code) ? code : null;
}

export function generateCode() {
  return randomBytes(5).toString("hex").toUpperCase().slice(0, 6);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = randomBytes(4).readUInt32BE(0) % (index + 1);
    [copy[index], copy[swap]] = [copy[swap]!, copy[index]!];
  }
  return copy;
}

function shuffledQuestions(): Question[] {
  return shuffle(QUESTIONS).map((question) => ({ ...question, answers: shuffle(question.answers) }));
}

function publicQuestions(questions: Question[]): PublicQuestion[] {
  return questions.map(({ id, text, answers, explanation, source }) => ({ id, text, answers, explanation, source }));
}

export async function requireV3Member(roomId: string, uid: string) {
  const member = await adminDb().ref(`v3/members/${roomId}/${uid}`).get();
  if (!member.exists()) throw new PublicApiError("Δεν είστε μέλος αυτού του δωματίου.", 403);
  return member.val() as { role: "host" | "player" };
}

export async function requireV3Host(roomId: string, uid: string) {
  const member = await requireV3Member(roomId, uid);
  if (member.role !== "host") throw new PublicApiError("Μόνο ο host μπορεί να εκτελέσει αυτή την ενέργεια.", 403);
}

export async function createV3Room(uid: string, name: string, requestedCode?: string) {
  const db = adminDb();
  const roomId = db.ref("v3/rooms").push().key!;
  const code = requestedCode ?? generateCode();
  const claim = await db.ref(`v3/codes/${code}`).transaction((existing) => existing ?? roomId);
  if (!claim.committed || claim.snapshot.val() !== roomId) throw new PublicApiError("Ο κωδικός χρησιμοποιείται ήδη. Δημιουργήστε νέο κωδικό.", 409);

  const now = Date.now();
  const questions = shuffledQuestions();
  const room: V3Room = {
    id: roomId, code, phase: "lobby", questionIndex: 0, round: 0, version: 1,
    questions: publicQuestions(questions), createdAt: now, expiresAt: now + ROOM_TTL_MS,
    phaseEndsAt: null, revealCorrectAnswerId: null, paused: false, pausedRemainingMs: null,
  };
  const host: V3Player = { name, score: 0, participates: true, joinedAt: now, answeredRound: -1, lastScoredRound: -1 };
  await db.ref().update({
    [`v3/rooms/${roomId}`]: room,
    [`v3/privateRooms/${roomId}`]: { questions },
    [`v3/members/${roomId}/${uid}`]: { role: "host", joinedAt: now },
    [`v3/players/${roomId}/${uid}`]: host,
  });
  return room;
}

export function isExpired(room: V3Room, now = Date.now()) {
  return room.expiresAt <= now;
}

export function phaseAfterDeadline(room: V3Room, correctAnswerId: string | null, now: number): V3Room | null {
  if (!room.phaseEndsAt || room.phaseEndsAt > now) return null;
  const version = room.version + 1;
  if (room.phase === "question") {
    return { ...room, phase: "reveal", version, phaseEndsAt: now + REVEAL_DURATION_MS, revealCorrectAnswerId: correctAnswerId };
  }
  if (room.phase === "reveal") {
    return { ...room, phase: "scoreboard", version, phaseEndsAt: now + SCOREBOARD_DURATION_MS };
  }
  if (room.phase === "scoreboard") {
    if (room.questionIndex + 1 >= room.questions.length) return { ...room, phase: "finished", version, phaseEndsAt: null };
    return {
      ...room, phase: "question", questionIndex: room.questionIndex + 1, round: room.round + 1,
      version, phaseEndsAt: now + QUESTION_DURATION_MS, revealCorrectAnswerId: null,
    };
  }
  return null;
}
