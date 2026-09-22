import { NextRequest } from "next/server";
import { adminDb } from "@server/server/firebase-admin";
import { normalizeCode, normalizeName } from "@server/server/game";
import { apiError, assertSameOrigin, enforceRateLimit, PublicApiError, requireVerifiedClient } from "@server/server/request-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const { uid } = await requireVerifiedClient(request);
    await enforceRateLimit(request, uid, "join", 12, 15 * 60 * 1000);
    const body = await request.json();
    const name = normalizeName(body.name);
    const code = normalizeCode(body.code);
    if (!name || !code) throw new PublicApiError("Μη έγκυρο όνομα ή κωδικός δωματίου.");
    const db = adminDb();
    const codeSnapshot = await db.ref(`v3/codes/${code}`).get();
    const roomId = codeSnapshot.val() as string | null;
    if (!roomId) throw new PublicApiError("Το δωμάτιο δεν βρέθηκε.", 404);
    const room = (await db.ref(`v3/rooms/${roomId}`).get()).val();
    if (!room || room.expiresAt <= Date.now()) throw new PublicApiError("Το δωμάτιο έχει λήξει.", 410);
    if (room.phase !== "lobby") throw new PublicApiError("Το παιχνίδι έχει ήδη ξεκινήσει.", 409);
    const [players, existingMember] = await Promise.all([
      db.ref(`v3/players/${roomId}`).get(),
      db.ref(`v3/members/${roomId}/${uid}`).get(),
    ]);
    if (!players.hasChild(uid) && players.numChildren() >= 60) throw new PublicApiError("Το δωμάτιο είναι πλήρες.", 409);
    const now = Date.now();
    await db.ref().update({
      [`v3/members/${roomId}/${uid}`]: { role: existingMember.val()?.role ?? "player", joinedAt: now },
      [`v3/players/${roomId}/${uid}`]: { name, score: 0, participates: true, joinedAt: now, answeredRound: -1, lastScoredRound: -1 },
    });
    return Response.json({ roomId });
  } catch (error) {
    return apiError(error);
  }
}
