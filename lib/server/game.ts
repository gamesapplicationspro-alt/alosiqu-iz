import { randomBytes } from "crypto";
import { QUESTIONS } from "../../app/lib/questions";
import type { Question } from "../../app/types";
import { adminDb } from "@server/server/firebase-admin";
import { PublicApiError } from "@server/server/request-auth";

export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
export const QUESTION_DURATION_MS = 15 * 1000;
export type PublicQuestion = Omit<Question, "correctAnswerId">;
export type PublicRoom = {
  id: string; code: string; status: "waiting" | "active" | "finished";
  currentQuestionIndex: number; questions: PublicQuestion[]; createdAt: number;
  expiresAt: number; questionDeadlineAt: number | null; revealedAnswerId: string | null;
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
  return randomBytes(8).toString("hex").toUpperCase().slice(0, 8);
}

function shuffledQuestions(): Question[] {
  const items = QUESTIONS.map((question) => ({ ...question, answers: [...question.answers] }));
  for (let index = items.length - 1; index > 0; index--) {
    const swap = randomBytes(4).readUInt32BE(0) % (index + 1);
    [items[index], items[swap]] = [items[swap]!, items[index]!];
  }
  return items;
}

export function publicQuestions(questions: Question[]): PublicQuestion[] {
  return questions.map((question) => ({ id: question.id, text: question.text, answers: question.answers }));
}

export async function requireHost(roomId: string, uid: string) {
  const member = await adminDb().ref(`v2/members/${roomId}/${uid}`).get();
  if (!member.exists() || member.val()?.role !== "host") throw new PublicApiError("Μόνο ο host μπορεί να εκτελέσει αυτή την ενέργεια.", 403);
}

export async function createRoom(uid: string, name: string, requestedCode?: string) {
  const db = adminDb();
  const roomId = db.ref("v2/rooms").push().key!;
  const code = requestedCode ?? generateCode();
  const codeRef = db.ref(`v2/codes/${code}`);
  const codeClaim = await codeRef.transaction((existing) => existing ?? roomId);
  if (!codeClaim.committed || codeClaim.snapshot.val() !== roomId) throw new Error("This room code is already in use. Generate another one.");
  const now = Date.now();
  const questions = shuffledQuestions();
  const room: PublicRoom = {
    id: roomId, code, status: "waiting", currentQuestionIndex: 0,
    questions: publicQuestions(questions), createdAt: now, expiresAt: now + ROOM_TTL_MS,
    questionDeadlineAt: null, revealedAnswerId: null,
  };
  await db.ref().update({
    [`v2/rooms/${roomId}`]: room,
    [`v2/privateRooms/${roomId}`]: { questions },
    [`v2/members/${roomId}/${uid}`]: { role: "host", joinedAt: now },
    [`v2/players/${roomId}/${uid}`]: { name, score: 0, answeredQuestionIndex: -1 },
  });
  return room;
}
