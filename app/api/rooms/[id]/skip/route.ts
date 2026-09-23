import { NextRequest } from "next/server";
import { adminDb } from "@server/server/firebase-admin";
import { isExpired, requireV3Host, type V3Room } from "@server/server/game";
import { apiError, assertSameOrigin, enforceRateLimit, PublicApiError, requireVerifiedClient } from "@server/server/request-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { uid } = await requireVerifiedClient(request);
    await enforceRateLimit(request, uid, "skip", 20, 60 * 1000);
    const { id } = await params;
    await requireV3Host(id, uid);
    const body = await request.json().catch(() => ({}));
    const db = adminDb();
    const roomRef = db.ref(`v3/rooms/${id}`);
    const room = (await roomRef.get()).val() as V3Room | null;
    if (!room || isExpired(room)) throw new PublicApiError("Το δωμάτιο δεν βρέθηκε ή έχει λήξει.", 404);
    if (typeof body.expectedVersion === "number" && room.version !== body.expectedVersion) return Response.json({ ok: false, version: room.version }, { status: 409 });
    if (room.phase === "lobby" || room.phase === "finished") throw new PublicApiError("Δεν υπάρχει ενεργός γύρος για παράλειψη.", 409);
    await roomRef.update({ phaseEndsAt: Date.now(), paused: false, pausedRemainingMs: null });
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
