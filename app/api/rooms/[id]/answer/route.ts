import { NextRequest } from "next/server";
import { adminDb } from "@server/server/firebase-admin";
import { isExpired, requireV3Member, type V3Player, type V3Room } from "@server/server/game";
import { scoreForAnswer } from "@/lib/game-phases";
import { apiError, assertSameOrigin, enforceRateLimit, PublicApiError, requireVerifiedClient } from "@server/server/request-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { uid } = await requireVerifiedClient(request);
    await enforceRateLimit(request, uid, "answer", 40, 60 * 1000);
    const { id } = await params;
    await requireV3Member(id, uid);
    const body = await request.json();
    const answerId = typeof body.answerId === "string" && /^[a-z0-9_-]{1,32}$/i.test(body.answerId) ? body.answerId : null;
    if (!answerId) throw new PublicApiError("Μη έγκυρη απάντηση.");

    const db = adminDb();
    const room = (await db.ref(`v3/rooms/${id}`).get()).val() as V3Room | null;
    const now = Date.now();
    if (!room || isExpired(room, now)) {
      throw new PublicApiError("Το δωμάτιο δεν βρέθηκε ή έχει λήξει.", 404);
    }
    // Reaching the server a fraction after the deadline is a normal quiz race,
    // not an application error. Return a successful, explicit game outcome.
    if (room.phase !== "question" || !room.phaseEndsAt || room.phaseEndsAt <= now) {
      return Response.json({ accepted: false, expired: true });
    }
    const [privateSnapshot, playerSnapshot] = await Promise.all([
      db.ref(`v3/privateRooms/${id}/questions/${room.questionIndex}`).get(),
      db.ref(`v3/players/${id}/${uid}`).get(),
    ]);
    const privateQuestion = privateSnapshot.val() as { answers: { id: string }[]; correctAnswerId: string } | null;
    const player = playerSnapshot.val() as V3Player | null;
    if (!player?.participates) throw new PublicApiError("Βρίσκεστε σε λειτουργία παρατήρησης.", 403);
    if (!privateQuestion?.answers.some((answer) => answer.id === answerId)) throw new PublicApiError("Μη έγκυρη απάντηση.");

    const answerRef = db.ref(`v3/answers/${id}/${uid}/${room.round}`);
    const answerWrite = await answerRef.transaction((existing) => existing ?? { answerId, submittedAt: now });
    const savedAnswer = answerWrite.snapshot.val() as { answerId: string; submittedAt: number };
    const correct = savedAnswer.answerId === privateQuestion.correctAnswerId;
    const points = correct ? scoreForAnswer(room.phaseEndsAt - savedAnswer.submittedAt) : 0;

    const playerRef = db.ref(`v3/players/${id}/${uid}`);
    const scoreWrite = await playerRef.transaction((current: V3Player | null) => {
      if (!current || current.lastScoredRound >= room.round) return;
      return { ...current, score: current.score + points, answeredRound: room.round, lastScoredRound: room.round };
    });
    const replayed = !answerWrite.committed || !scoreWrite.committed;
    return Response.json({ accepted: true, replayed });
  } catch (error) {
    return apiError(error);
  }
}
