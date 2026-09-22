import { NextRequest } from "next/server";
import { adminDb } from "@server/server/firebase-admin";
import { isExpired, requireV3Host, type V3Room } from "@server/server/game";
import { apiError, assertSameOrigin, enforceRateLimit, PublicApiError, requireVerifiedClient } from "@server/server/request-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { uid } = await requireVerifiedClient(request);
    await enforceRateLimit(request, uid, "participation", 12, 60 * 1000);
    const { id } = await params;
    await requireV3Host(id, uid);
    const body = await request.json();
    if (typeof body.participates !== "boolean") throw new PublicApiError("Μη έγκυρη επιλογή συμμετοχής.");
    const room = (await adminDb().ref(`v3/rooms/${id}`).get()).val() as V3Room | null;
    if (!room || isExpired(room)) throw new PublicApiError("Το δωμάτιο δεν βρέθηκε ή έχει λήξει.", 404);
    if (room.phase !== "lobby") throw new PublicApiError("Η επιλογή συμμετοχής αλλάζει μόνο πριν την έναρξη.", 409);
    await adminDb().ref(`v3/players/${id}/${uid}/participates`).set(body.participates);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
