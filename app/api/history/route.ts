import { NextRequest } from "next/server";
import { adminDb } from "@server/server/firebase-admin";
import { apiError, requireVerifiedClient } from "@server/server/request-auth";

export const runtime = "nodejs";
type HistoryEntry = {
  id: string; playerName: string; score: number; totalQuestions: number;
  percentage: number; date: number; roomCode: string; expiresAt: number;
};

export async function GET(request: NextRequest) {
  try {
    const { uid } = await requireVerifiedClient(request);
    const snapshot = await adminDb().ref(`v3/history/${uid}`).get();
    const now = Date.now();
    const entries = Object.entries(snapshot.val() || {})
      .map(([id, value]) => ({ id, ...(value as Omit<HistoryEntry, "id">) }))
      .filter((entry) => entry.expiresAt > now)
      .sort((a, b) => b.date - a.date);
    return Response.json({ entries });
  } catch (error) {
    return apiError(error);
  }
}
