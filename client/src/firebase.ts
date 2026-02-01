// src/firebase.ts
// Initialize Firebase once and export the app/analytics
// Add your values to a .env.local file using Vite env vars (VITE_ prefix)
// Example .env.local:
// VITE_FIREBASE_API_KEY=...
// VITE_FIREBASE_AUTH_DOMAIN=...
// VITE_FIREBASE_PROJECT_ID=...
// VITE_FIREBASE_STORAGE_BUCKET=...
// VITE_FIREBASE_MESSAGING_SENDER_ID=...
// VITE_FIREBASE_APP_ID=...
// VITE_FIREBASE_MEASUREMENT_ID=...

import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string,
};

// Debug: print which env values are visible to the client so you can confirm which env file is used
if (typeof window !== 'undefined') {
  console.log('Firebase env check — MODE:', import.meta.env.MODE, 'PROJECT_ID:', import.meta.env.VITE_FIREBASE_PROJECT_ID, 'SOURCE:', import.meta.env.VITE_SOURCE ?? 'unset', 'keysPresent:', {
    apiKey: !!import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: !!import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    appId: !!import.meta.env.VITE_FIREBASE_APP_ID,
  })
}

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Analytics is browser-only
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : undefined;
