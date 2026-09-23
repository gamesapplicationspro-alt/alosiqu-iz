import { NextRequest } from "next/server";
import { adminDb } from "@server/server/firebase-admin";
import { isExpired, phaseAfterDeadline, requireV3Member, type V3Player, type V3Room } from "@server/server/game";
import { scoreForAnswer } from "@/lib/game-phases";
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
    // This operation is deliberately idempotent. Every connected member may ask
    // for a transition; duplicate requests write the same next version and never
    // skip a phase. This avoids exposing RTDB transaction aborts as game failures.
    if (expectedVersion !== null && before.version !== expectedVersion) {
      return Response.json({ advanced: false, phase: before.phase, version: before.version });
    }
    const players = before.phase === "question"
      ? ((await db.ref(`v3/players/${id}`).get()).val() || {}) as Record<string, V3Player>
      : null;
    const activePlayers = players ? Object.values(players).filter((player) => player.participates) : [];
    const everyoneAnswered = before.phase === "question" && activePlayers.length > 0 && activePlayers.every((player) => player.answeredRound === before.round);
    const transitionSource = everyoneAnswered ? { ...before, phaseEndsAt: now } : before;
    const next = phaseAfterDeadline(transitionSource, correctAnswerId, now);
    if (!next) return Response.json({ advanced: false, phase: before.phase, version: before.version });
    const updates: Record<string, unknown> = { [`v3/rooms/${id}`]: next };
    if (before.phase === "question" && next.phase === "reveal") {
      const answers = (await db.ref(`v3/answers/${id}`).get()).val() as Record<string, Record<string, { answerId: string; submittedAt: number }>> | null;
      for (const [playerId, player] of Object.entries(players || {})) {
        if (!player.participates) continue;
        const answer = answers?.[playerId]?.[String(before.round)];
        const questionStartedAt = before.phaseEndsAt ? before.phaseEndsAt - 20_000 : null;
        const isInQuestionWindow = Boolean(answer?.submittedAt && before.phaseEndsAt && questionStartedAt
          && answer.submittedAt >= questionStartedAt && answer.submittedAt <= before.phaseEndsAt);
        const points = answer?.answerId === correctAnswerId && before.phaseEndsAt && isInQuestionWindow
          ? scoreForAnswer(before.phaseEndsAt - answer.submittedAt)
          : 0;
        updates[`v3/players/${id}/${playerId}/score`] = player.lastScoredRound >= before.round ? player.score : player.score + points;
        updates[`v3/players/${id}/${playerId}/lastScoredRound`] = Math.max(player.lastScoredRound, before.round);
      }
    }
    await db.ref().update(updates);
    if (next.phase === "finished") await saveHistory(id, next);
    return Response.json({ advanced: true, phase: next.phase, version: next.version });
  } catch (error) {
    return apiError(error);
  }
}
