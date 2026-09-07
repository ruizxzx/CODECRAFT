import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  signOut,
  User 
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
// Production configuration for the KRISHFICIENT portfolio Firebase project.
// Environment variables may override these values for a different deployment,
// but this app must always use the default Firestore database in this project.
const DEFAULT_FIREBASE_CONFIG = {
  projectId: "krishficient-portfolio",
  appId: "1:46384387176:web:977beb4377e89f70e5d7dd",
  apiKey: "AIzaSyC1_eau-5rsMTreEzCNmTsn2FGcSa448ug",
  authDomain: "krishficient-portfolio.firebaseapp.com",
  storageBucket: "krishficient-portfolio.firebasestorage.app",
  messagingSenderId: "46384387176",
};

// Production Firebase configuration prioritizing VITE_* environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Intentionally use Firestore's `(default)` database. A named database can have
// separate rules and was the source of the permission-denied CMS failures.
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export const ADMIN_EMAILS = [
  'ruizxzxz@gmail.com',
  'krishsarkar456@gmail.com'
];

export const checkIsAdmin = (email?: string | null): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
};

/**
 * Signs in user via Google.
 * Handles popups on desktop, gracefully handles cancellations without throwing errors,
 * falls back to redirect when popups are blocked (e.g. mobile Safari / Chrome),
 * and provides clear guidance if domain is unauthorized on Vercel.
 */
export const loginWithGoogle = async (): Promise<User | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    // 1. User intentionally closed popup or cancelled request
    if (
      error?.code === 'auth/popup-closed-by-user' || 
      error?.code === 'auth/cancelled-popup-request'
    ) {
      console.info("Google Sign-In was cancelled by the user.");
      return null;
    }

    // 2. Popup was blocked by browser - fallback to redirect
    if (error?.code === 'auth/popup-blocked') {
      console.warn("Popup blocked by browser. Attempting sign-in with redirect...");
      await signInWithRedirect(auth, googleProvider);
      return null;
    }

    // 3. Unauthorized domain on Vercel or custom domain
    if (error?.code === 'auth/unauthorized-domain') {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : 'current domain';
      const msg = `Unauthorized domain: "${hostname}". Please add "${hostname}" and "krishficientblogx.vercel.app" to Firebase Console -> Authentication -> Settings -> Authorized Domains.`;
      console.error(msg);
      throw new Error(msg);
    }

    console.error("Error signing in with Google:", error);
    throw error;
  }
};

// Check for redirect result on page load (e.g. after mobile redirect auth)
if (typeof window !== 'undefined') {
  getRedirectResult(auth).catch((err) => {
    if (err?.code !== 'auth/popup-closed-by-user') {
      console.warn("Firebase redirect auth check:", err?.message);
    }
  });
}

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};
