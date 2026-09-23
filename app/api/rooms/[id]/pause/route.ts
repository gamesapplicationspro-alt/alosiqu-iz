import { NextRequest } from "next/server";
import { adminDb } from "@server/server/firebase-admin";
import { isExpired, requireV3Host, type V3Room } from "@server/server/game";
import { apiError, assertSameOrigin, enforceRateLimit, PublicApiError, requireVerifiedClient } from "@server/server/request-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { uid } = await requireVerifiedClient(request);
    await enforceRateLimit(request, uid, "pause", 20, 60 * 1000);
    const { id } = await params;
    await requireV3Host(id, uid);
    const body = await request.json().catch(() => ({}));
    if (typeof body.paused !== "boolean") throw new PublicApiError("Μη έγκυρη επιλογή παύσης.");
    const db = adminDb();
    const roomRef = db.ref(`v3/rooms/${id}`);
    const room = (await roomRef.get()).val() as V3Room | null;
    const now = Date.now();
    if (!room || isExpired(room, now)) throw new PublicApiError("Το δωμάτιο δεν βρέθηκε ή έχει λήξει.", 404);
    if (room.phase === "lobby" || room.phase === "question" || room.phase === "finished") throw new PublicApiError("Η παύση είναι διαθέσιμη μόνο μετά την απάντηση.", 409);
    if (typeof body.expectedVersion === "number" && room.version !== body.expectedVersion) {
      return Response.json({ ok: false, version: room.version }, { status: 409 });
    }
    if (body.paused) {
      if (room.paused) return Response.json({ ok: true, paused: true, version: room.version });
      const remainingMs = room.phaseEndsAt ? Math.max(0, room.phaseEndsAt - now) : 0;
      await roomRef.update({ paused: true, pausedRemainingMs: remainingMs, phaseEndsAt: null, version: room.version + 1 });
      return Response.json({ ok: true, paused: true, version: room.version + 1 });
    }
    if (!room.paused) return Response.json({ ok: true, paused: false, version: room.version });
    const remainingMs = Math.max(0, room.pausedRemainingMs ?? 0);
    await roomRef.update({ paused: false, pausedRemainingMs: null, phaseEndsAt: now + remainingMs, version: room.version + 1 });
    return Response.json({ ok: true, paused: false, version: room.version + 1 });
  } catch (error) {
    return apiError(error);
  }
}
