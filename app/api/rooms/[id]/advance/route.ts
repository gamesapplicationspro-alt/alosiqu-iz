import { NextRequest } from "next/server";
import { adminDb } from "@server/server/firebase-admin";
import { isExpired, phaseAfterDeadline, requireV3Member, type V3Player, type V3Room } from "@server/server/game";
import { apiError, assertSameOrigin, enforceRateLimit, PublicApiError, requireVerifiedClient } from "@server/server/request-auth";

export const runtime = "nodejs";

async function saveHistory(roomId: string, room: V3Room) {
  const db = adminDb();
  const players = (await db.ref(`v3/players/${roomId}`).get()).val() as Record<string, V3Player> | null;
  if (!players) return;
  const updates: Record<string, unknown> = {};
  for (const [uid, player] of Object.entries(players)) {
    updates[`v3/history/${uid}/${roomId}`] = {
      playerName: player.name, score: player.score, totalQuestions: room.questions.length,
      percentage: Math.round((player.score / (room.questions.length * 1500)) * 100),
      date: Date.now(), roomCode: room.code, expiresAt: room.expiresAt,
    };
  }
  await db.ref().update(updates);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { uid } = await requireVerifiedClient(request);
    await enforceRateLimit(request, uid, "advance", 40, 60 * 1000);
    const { id } = await params;
    await requireV3Member(id, uid);
    const body = await request.json().catch(() => ({}));
    const expectedVersion = typeof body.expectedVersion === "number" ? body.expectedVersion : null;
    const db = adminDb();
    const roomRef = db.ref(`v3/rooms/${id}`);
    const now = Date.now();
    const before = (await roomRef.get()).val() as V3Room | null;
    if (!before || isExpired(before, now)) throw new PublicApiError("Το δωμάτιο δεν βρέθηκε ή έχει λήξει.", 404);
    const correctAnswerId = before.phase === "question"
      ? ((await db.ref(`v3/privateRooms/${id}/questions/${before.questionIndex}`).get()).val() as { correctAnswerId?: string } | null)?.correctAnswerId ?? null
      : before.revealCorrectAnswerId;
    let transitionedToFinished: V3Room | null = null;
    const result = await roomRef.transaction((current: V3Room | null) => {
      if (!current || isExpired(current, now) || (expectedVersion !== null && current.version !== expectedVersion)) return;
      const next = phaseAfterDeadline(current, correctAnswerId, now);
      if (!next) return;
      return next;
    });
    const room = result.snapshot.val() as V3Room | null;
    if (!room) throw new PublicApiError("Το δωμάτιο δεν βρέθηκε ή έχει λήξει.", 404);

    if (result.committed && room.phase === "finished") transitionedToFinished = room;
    if (transitionedToFinished) await saveHistory(id, transitionedToFinished);
    return Response.json({ advanced: result.committed, phase: room.phase, version: room.version });
  } catch (error) {
    return apiError(error);
  }
}
