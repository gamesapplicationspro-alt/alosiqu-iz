"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getToken, initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
let appCheck: ReturnType<typeof initializeAppCheck> | null = null;

function app() {
  if (!config.apiKey || !config.projectId || !config.databaseURL || !config.appId) {
    throw new Error("Η εφαρμογή δεν έχει ρυθμιστεί σωστά.");
  }
  return getApps().length ? getApp() : initializeApp(config);
}

export async function getSession() {
  const firebaseApp = app();
  const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;
  if (!siteKey) throw new Error("Η προστασία εφαρμογής δεν έχει ρυθμιστεί σωστά.");
  appCheck ??= initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  const auth = getAuth(firebaseApp);
  if (!auth.currentUser) await signInAnonymously(auth);
  const [idToken, appCheckToken] = await Promise.all([
    auth.currentUser!.getIdToken(), getToken(appCheck, false),
  ]);
  return { uid: auth.currentUser!.uid, idToken, appCheckToken: appCheckToken.token, firebaseApp };
}

export async function secureRequest(path: string, init: RequestInit = {}) {
  const session = await getSession();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.idToken}`);
  headers.set("X-Firebase-AppCheck", session.appCheckToken);
  headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...init, headers, credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Η ενέργεια δεν ολοκληρώθηκε.");
  return body;
}
