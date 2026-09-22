import { NextRequest } from "next/server";
import { adminDb } from "@server/server/firebase-admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = adminDb();
  const now = Date.now();
  const expired = await db.ref("v2/rooms").orderByChild("expiresAt").endAt(now).get();
  const updates: Record<string, null> = {};
  expired.forEach((room) => {
    const id = room.key!;
    const code = room.val().code;
    updates[`v2/rooms/${id}`] = null;
    updates[`v2/privateRooms/${id}`] = null;
    updates[`v2/players/${id}`] = null;
    updates[`v2/members/${id}`] = null;
    updates[`v2/answers/${id}`] = null;
    updates[`v2/codes/${code}`] = null;
  });
  if (Object.keys(updates).length) await db.ref().update(updates);

  const history = await db.ref("v2/history").get();
  history.forEach((userHistory) => userHistory.forEach((entry) => {
    if (entry.val()?.expiresAt <= now) updates[`v2/history/${userHistory.key}/${entry.key}`] = null;
  }));
  updates["v2/rateLimits"] = null;
  if (Object.keys(updates).length) await db.ref().update(updates);
  return Response.json({ deletedRooms: expired.numChildren() });
}
