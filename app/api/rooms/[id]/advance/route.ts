import { NextRequest } from "next/server";
import { adminDb } from "@server/server/firebase-admin";
import { QUESTION_DURATION_MS, requireHost } from "@server/server/game";
import { apiError, assertSameOrigin, enforceRateLimit, PublicApiError, requireVerifiedClient } from "@server/server/request-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { uid } = await requireVerifiedClient(request);
    await enforceRateLimit(request, uid, "advance", 12, 60 * 1000);
    const { id } = await params;
    await requireHost(id, uid);
    const db = adminDb();
    const roomRef = db.ref(`v2/rooms/${id}`);
    const before = (await roomRef.get()).val();
    if (!before || before.status !== "active" || before.expiresAt <= Date.now()) throw new PublicApiError("Δεν υπάρχει ενεργό παιχνίδι.", 409);
    if (!before.questionDeadlineAt || before.questionDeadlineAt > Date.now()) throw new PublicApiError("Ο χρόνος της ερώτησης δεν έχει λήξει ακόμη.", 409);
    const privateQuestion = (await db.ref(`v2/privateRooms/${id}/questions/${before.currentQuestionIndex}`).get()).val();
    if (!privateQuestion) throw new PublicApiError("Η ερώτηση δεν βρέθηκε.", 500);
    const now = Date.now();
    const isLast = before.currentQuestionIndex + 1 >= before.questions.length;
    const result = await roomRef.transaction((room) => {
      if (!room || room.status !== "active" || room.currentQuestionIndex !== before.currentQuestionIndex || room.questionDeadlineAt !== before.questionDeadlineAt) return;
      return isLast
        ? { ...room, status: "finished", questionDeadlineAt: null, revealedAnswerId: privateQuestion.correctAnswerId }
        : { ...room, currentQuestionIndex: room.currentQuestionIndex + 1, questionDeadlineAt: now + QUESTION_DURATION_MS, revealedAnswerId: null };
    });
    if (!result.committed) throw new PublicApiError("Η κατάσταση άλλαξε. Ανανεώστε τη σελίδα.", 409);

    if (isLast) {
      const players = (await db.ref(`v2/players/${id}`).get()).val() || {};
      const updates: Record<string, unknown> = {};
      for (const [playerUid, player] of Object.entries(players) as [string, { name: string; score: number }][]) {
        updates[`v2/history/${playerUid}/${id}`] = {
          playerName: player.name, score: player.score, totalQuestions: before.questions.length,
          percentage: Math.round((player.score / before.questions.length) * 100),
          date: now, roomCode: before.code, expiresAt: before.expiresAt,
        };
      }
      await db.ref().update(updates);
    }
    return Response.json({ finished: isLast });
  } catch (error) {
    return apiError(error);
  }
}
