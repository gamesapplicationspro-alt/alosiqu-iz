import { NextRequest } from "next/server";
import { adminDb } from "@server/server/firebase-admin";
import { QUESTION_DURATION_MS, requireHost } from "@server/server/game";
import { apiError, assertSameOrigin, enforceRateLimit, PublicApiError, requireVerifiedClient } from "@server/server/request-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { uid } = await requireVerifiedClient(request);
    await enforceRateLimit(request, uid, "start", 6, 60 * 1000);
    const { id } = await params;
    await requireHost(id, uid);
    const ref = adminDb().ref(`v2/rooms/${id}`);
    const now = Date.now();
    const result = await ref.transaction((room) => {
      if (!room || room.expiresAt <= now || room.status !== "waiting") return;
      return { ...room, status: "active", currentQuestionIndex: 0, revealedAnswerId: null, questionDeadlineAt: now + QUESTION_DURATION_MS };
    });
    if (!result.committed) throw new PublicApiError("Το παιχνίδι δεν μπορεί να ξεκινήσει.", 409);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
