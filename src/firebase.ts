import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAnalytics, logEvent } from 'firebase/analytics'

// Reads Firebase configuration from Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Export Firestore Database
export const db = getFirestore(app)

// Initialize & Export Analytics (check if window is defined for SSR/build safety)
export const analytics = typeof window !== 'undefined' && firebaseConfig.measurementId ? getAnalytics(app) : null

// Helper function to safely log custom events
export function logCustomEvent(eventName: string, params?: Record<string, any>) {
  if (analytics) {
    try {
      logEvent(analytics, eventName, params)
    } catch (e) {
      console.warn('Firebase Analytics logEvent failed:', e)
    }
  }
}
