import { NextRequest } from "next/server";
import { adminDb } from "@server/server/firebase-admin";
import { QUESTION_DURATION_MS, isExpired, requireV3Host, type V3Player, type V3Room } from "@server/server/game";
import { apiError, assertSameOrigin, enforceRateLimit, PublicApiError, requireVerifiedClient } from "@server/server/request-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { uid } = await requireVerifiedClient(request);
    await enforceRateLimit(request, uid, "start", 6, 60 * 1000);
    const { id } = await params;
    await requireV3Host(id, uid);
    const db = adminDb();
    const [roomSnapshot, playersSnapshot] = await Promise.all([db.ref(`v3/rooms/${id}`).get(), db.ref(`v3/players/${id}`).get()]);
    const room = roomSnapshot.val() as V3Room | null;
    const players = (playersSnapshot.val() || {}) as Record<string, V3Player>;
    const now = Date.now();
    if (!room) throw new PublicApiError("Το δωμάτιο δεν βρέθηκε.", 404);
    if (isExpired(room, now)) throw new PublicApiError("Το δωμάτιο έχει λήξει.", 410);
    if (room.phase !== "lobby") return Response.json({ ok: true, alreadyStarted: true });
    if (!Object.values(players).some((player) => player.participates)) {
      throw new PublicApiError("Χρειάζεται τουλάχιστον ένας παίκτης που συμμετέχει.", 409);
    }
    await db.ref(`v3/rooms/${id}`).update({
      phase: "question", questionIndex: 0, round: 0, version: room.version + 1,
      phaseEndsAt: now + QUESTION_DURATION_MS, revealCorrectAnswerId: null,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
