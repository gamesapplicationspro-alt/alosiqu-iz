import { NextRequest } from "next/server";
import { adminDb } from "@server/server/firebase-admin";
import { isExpired, requireV3Host, type V3Player, type V3Room } from "@server/server/game";
import { apiError, assertSameOrigin, enforceRateLimit, PublicApiError, requireVerifiedClient } from "@server/server/request-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { uid } = await requireVerifiedClient(request);
    await enforceRateLimit(request, uid, "restart", 6, 60 * 1000);
    const { id } = await params;
    await requireV3Host(id, uid);
    const db = adminDb();
    const roomRef = db.ref(`v3/rooms/${id}`);
    const room = (await roomRef.get()).val() as V3Room | null;
    const now = Date.now();
    if (!room || isExpired(room, now)) throw new PublicApiError("Το δωμάτιο δεν βρέθηκε ή έχει λήξει.", 404);
    const players = ((await db.ref(`v3/players/${id}`).get()).val() || {}) as Record<string, V3Player>;
    const updates: Record<string, unknown> = {
      [`v3/rooms/${id}`]: { ...room, phase: "lobby", questionIndex: 0, round: 0, version: room.version + 1, phaseEndsAt: null, revealCorrectAnswerId: null, paused: false, pausedRemainingMs: null },
      [`v3/answers/${id}`]: null,
    };
    for (const playerId of Object.keys(players)) {
      updates[`v3/players/${id}/${playerId}/score`] = 0;
      updates[`v3/players/${id}/${playerId}/answeredRound`] = -1;
      updates[`v3/players/${id}/${playerId}/lastScoredRound`] = -1;
    }
    await db.ref().update(updates);
    return Response.json({ ok: true, phase: "lobby" });
  } catch (error) {
    return apiError(error);
  }
}
