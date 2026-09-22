import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getAppCheck } from "firebase-admin/app-check";
import { getDatabase } from "firebase-admin/database";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required server environment variable: ${name}`);
  return value;
}

function app() {
  if (getApps().length) return getApps()[0]!;
  return initializeApp({
    credential: cert({
      projectId: required("FIREBASE_ADMIN_PROJECT_ID"),
      clientEmail: required("FIREBASE_ADMIN_CLIENT_EMAIL"),
      privateKey: required("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
    databaseURL: required("NEXT_PUBLIC_FIREBASE_DATABASE_URL"),
  });
}

export const adminDb = () => getDatabase(app());
export const adminAuth = () => getAuth(app());
export const adminAppCheck = () => getAppCheck(app());
