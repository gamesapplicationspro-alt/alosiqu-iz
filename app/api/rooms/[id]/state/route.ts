import { NextRequest } from "next/server";
import { adminDb } from "@server/server/firebase-admin";
import { isExpired, requireV3Member, type V3Player, type V3Room } from "@server/server/game";
import { apiError, assertSameOrigin, enforceRateLimit, PublicApiError, requireVerifiedClient } from "@server/server/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { uid } = await requireVerifiedClient(request);
    await enforceRateLimit(request, uid, "state", 90, 60 * 1000);
    const { id } = await params;
    const member = await requireV3Member(id, uid);
    const db = adminDb();
    const [roomSnapshot, playersSnapshot] = await Promise.all([
      db.ref(`v3/rooms/${id}`).get(), db.ref(`v3/players/${id}`).get(),
    ]);
    const room = roomSnapshot.val() as V3Room | null;
    if (!room || isExpired(room)) throw new PublicApiError("Το δωμάτιο δεν βρέθηκε ή έχει λήξει.", 404);
    return Response.json({ room, players: (playersSnapshot.val() || {}) as Record<string, V3Player>, role: member.role }, {
      headers: { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" },
    });
  } catch (error) {
    return apiError(error);
  }
}
