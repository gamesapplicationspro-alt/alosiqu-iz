import { NextRequest } from "next/server";
import { adminDb } from "@server/server/firebase-admin";
import { apiError, assertSameOrigin, enforceRateLimit, PublicApiError, requireVerifiedClient } from "@server/server/request-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { uid } = await requireVerifiedClient(request);
    await enforceRateLimit(request, uid, "answer", 30, 60 * 1000);
    const { id } = await params;
    const body = await request.json();
    const answerId = typeof body.answerId === "string" && /^[a-z0-9_-]{1,32}$/i.test(body.answerId) ? body.answerId : null;
    if (!answerId) throw new PublicApiError("Μη έγκυρη απάντηση.");

    const db = adminDb();
    const [roomSnapshot, memberSnapshot] = await Promise.all([
      db.ref(`v2/rooms/${id}`).get(), db.ref(`v2/members/${id}/${uid}`).get(),
    ]);
    const room = roomSnapshot.val();
    if (!memberSnapshot.exists()) throw new PublicApiError("Δεν είστε μέλος αυτού του δωματίου.", 403);
    if (!room || room.expiresAt <= Date.now() || room.status !== "active" || !room.questionDeadlineAt || room.questionDeadlineAt < Date.now()) {
      throw new PublicApiError("Η ερώτηση δεν είναι πλέον ενεργή.", 409);
    }
    const index = room.currentQuestionIndex;
    const privateQuestion = (await db.ref(`v2/privateRooms/${id}/questions/${index}`).get()).val();
    if (!privateQuestion || !privateQuestion.answers?.some((answer: { id: string }) => answer.id === answerId)) {
      throw new PublicApiError("Μη έγκυρη απάντηση.");
    }
    const answerRef = db.ref(`v2/answers/${id}/${uid}/${index}`);
    const answerWrite = await answerRef.transaction((existing) => existing ?? { answerId, submittedAt: Date.now() });
    if (!answerWrite.committed) throw new PublicApiError("Έχει ήδη καταχωριστεί απάντηση για αυτή την ερώτηση.", 409);

    const correct = privateQuestion.correctAnswerId === answerId;
    const playerRef = db.ref(`v2/players/${id}/${uid}`);
    await playerRef.transaction((player) => {
      if (!player) return;
      return {
        ...player,
        score: player.score + (correct ? 1 : 0),
        answeredQuestionIndex: index,
      };
    });
    return Response.json({ accepted: true });
  } catch (error) {
    return apiError(error);
  }
}
