import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { adminAppCheck, adminAuth } from "@server/server/firebase-admin";
import { adminDb } from "@server/server/firebase-admin";

export class RequestAuthError extends Error {}
export class PublicApiError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

export async function requireVerifiedClient(request: NextRequest) {
  const bearer = request.headers.get("authorization");
  const appCheckToken = request.headers.get("x-firebase-appcheck");
  if (!bearer?.startsWith("Bearer ") || !appCheckToken) {
    throw new RequestAuthError("Authentication is required.");
  }
  let identity;
  try {
    identity = await adminAuth().verifyIdToken(bearer.slice(7), true);
  } catch (error) {
    console.error("Firebase Auth token verification failed", {
      code: typeof error === "object" && error && "code" in error ? error.code : "unknown",
    });
    throw new RequestAuthError("Η ασφαλής ταυτοποίηση απέτυχε.");
  }

  try {
    await adminAppCheck().verifyToken(appCheckToken);
  } catch (error) {
    console.error("Firebase App Check token verification failed", {
      code: typeof error === "object" && error && "code" in error ? error.code : "unknown",
    });
    throw new RequestAuthError("Η ασφαλής ταυτοποίηση απέτυχε.");
  }
  return { uid: identity.uid };
}

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!host) throw new RequestAuthError("Invalid request origin.");
  if (origin) {
    if (new URL(origin).host !== host) throw new RequestAuthError("Invalid request origin.");
    return;
  }

  // Browsers commonly omit Origin for same-origin GET requests. Accept only
  // explicit same-origin Fetch Metadata, or an exact same-host referrer.
  if (request.method === "GET" || request.method === "HEAD") {
    if (request.headers.get("sec-fetch-site") === "same-origin") return;
    const referrer = request.headers.get("referer");
    if (referrer && new URL(referrer).host === host) return;
  }
  throw new RequestAuthError("Invalid request origin.");
}

export async function enforceRateLimit(request: NextRequest, uid: string, action: string, limit: number, windowMs: number) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = createHash("sha256").update(`${uid}:${forwardedFor}`).digest("hex");
  const ref = adminDb().ref(`v3/rateLimits/${action}/${key}`);
  const now = Date.now();
  const result = await ref.transaction((current: { start: number; count: number } | null) => {
    if (!current || now - current.start >= windowMs) return { start: now, count: 1 };
    if (current.count >= limit) return;
    return { ...current, count: current.count + 1 };
  });
  if (!result.committed) throw new PublicApiError("Πάρα πολλές προσπάθειες. Δοκιμάστε ξανά λίγο αργότερα.", 429);
}

export function apiError(error: unknown) {
  const message = error instanceof RequestAuthError || error instanceof PublicApiError
    ? error.message : "The request could not be completed.";
  const status = error instanceof RequestAuthError ? 401 : error instanceof PublicApiError ? error.status : 500;
  console.error("Secure API request failed", error);
  return Response.json({ error: message }, { status });
}
