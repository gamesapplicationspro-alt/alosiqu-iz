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
    const [roomSnapshot, playersSnapshot] = await Promise.all([
      ref.get(),
      adminDb().ref(`v2/players/${id}`).get(),
    ]);
    const existingRoom = roomSnapshot.val();
    if (!existingRoom) throw new PublicApiError("Το δωμάτιο δεν βρέθηκε.", 404);
    if (existingRoom.expiresAt <= now) throw new PublicApiError("Το δωμάτιο έχει λήξει.", 410);

    // A repeated click or a slow realtime update must not be reported as a failed start.
    if (existingRoom.status === "active") return Response.json({ ok: true, alreadyStarted: true });
    if (existingRoom.status === "finished") throw new PublicApiError("Το παιχνίδι έχει ήδη ολοκληρωθεί.", 409);
    if (existingRoom.status !== "waiting") throw new PublicApiError("Το δωμάτιο δεν είναι έτοιμο για έναρξη.", 409);
    if (playersSnapshot.numChildren() < 3) {
      throw new PublicApiError("Χρειάζονται τουλάχιστον δύο παίκτες, πέρα από τον host, για να ξεκινήσει το παιχνίδι.", 409);
    }

    // All authorization and state preconditions above are checked server-side.
    // A direct update avoids an Admin SDK transaction abort observed on Vercel,
    // while Firebase rules still deny every client-side write to this path.
    await ref.update({
      status: "active",
      currentQuestionIndex: 0,
      revealedAnswerId: null,
      questionDeadlineAt: now + QUESTION_DURATION_MS,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
