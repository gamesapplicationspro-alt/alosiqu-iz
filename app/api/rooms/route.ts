import { NextRequest } from "next/server";
import { createV3Room, generateCode, normalizeCode, normalizeName } from "@server/server/game";
import { apiError, assertSameOrigin, enforceRateLimit, PublicApiError, requireVerifiedClient } from "@server/server/request-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const { uid } = await requireVerifiedClient(request);
    await enforceRateLimit(request, uid, "create", 3, 15 * 60 * 1000);
    const body = await request.json();
    const name = normalizeName(body.name);
    const code = body.code ? normalizeCode(body.code) : generateCode();
    if (!name || !code) throw new PublicApiError("Μη έγκυρο όνομα ή κωδικός δωματίου.");
    const room = await createV3Room(uid, name, code, body.settings, body.customQuestions);
    return Response.json({ roomId: room.id, code: room.code });
  } catch (error) {
    return apiError(error);
  }
}
