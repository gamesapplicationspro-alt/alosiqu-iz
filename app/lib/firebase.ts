import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getDatabase, Database, ref, set, get, push, onValue, query, orderByChild, equalTo, update, off } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

function hasMinimumFirebaseConfig(config: FirebaseOptions): boolean {
  return !!(config.apiKey && config.projectId && config.databaseURL);
}

let _db: Database | null = null;
let _initPromise: Promise<Database> | null = null;

export async function getDb(): Promise<Database> {
  // Return existing instance
  if (_db) return _db;
  
  // Return existing promise
  if (_initPromise) return _initPromise;

  // Create initialization promise
  _initPromise = new Promise((resolve, reject) => {
    try {
      // Check if we're in browser
      if (typeof window === "undefined") {
        reject(new Error("Firebase Database is only available in the browser"));
        return;
      }

      // Check config
      if (!hasMinimumFirebaseConfig(firebaseConfig)) {
        reject(new Error("Missing Firebase config (check Vercel Environment Variables / .env.local)"));
        return;
      }

      // Initialize app
      if (!getApps().length) {
        initializeApp(firebaseConfig);
      }

      // Get database
      const db = getDatabase(getApp());
      _db = db;
      resolve(db);
    } catch (error) {
      console.error("Firebase initialization error:", error);
      reject(error);
    }
  });

  return _initPromise;
}

export function resetFirebase(): void {
  _db = null;
  _initPromise = null;
}

export { ref, set, get, push, onValue, query, orderByChild, equalTo, update, off };
export type { Database };
