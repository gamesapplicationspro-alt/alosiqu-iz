import { initializeApp, getApp, getApps } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

// initialize only once
let _db: Database | null = null;

function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  };
}

function hasMinimumFirebaseConfig(cfg: ReturnType<typeof getFirebaseConfig>) {
  return Boolean(cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId && cfg.databaseURL);
}

export function getDb(): Database {
  if (typeof window === "undefined") {
    throw new Error("Firebase Database is only available in the browser");
  }

  if (_db) return _db;

  const firebaseConfig = getFirebaseConfig();
  if (!hasMinimumFirebaseConfig(firebaseConfig)) {
    throw new Error("Missing Firebase config (check Vercel Environment Variables / .env.local)");
  }

  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }

  _db = getDatabase(getApp());
  return _db;
}

