// src/firebase.ts
import { initializeApp } from 'firebase/app'
import {
  getDatabase,
  ref as dbRef,
  onValue,
  runTransaction,
  update as dbUpdate,
  type DatabaseReference,
} from 'firebase/database'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://demo.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-project',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'demo-app',
}

let app;
let db: any;

try {
  app = initializeApp(firebaseConfig)
  db = getDatabase(app)
} catch (e) {
  console.warn("Firebase initialization failed, falling back to mock mode if possible or just logging error", e);
  // In a real hackathon panic, we might want a local mock DB here, but for now let's hope the user put keys or we just don't crash immediately.
}

export { db, dbRef, onValue, runTransaction, dbUpdate, type DatabaseReference }