import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithPhoneNumber,
  GoogleAuthProvider,
  RecaptchaVerifier,
  sendPasswordResetEmail,
  confirmPasswordReset,
  updateProfile,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
  ConfirmationResult
} from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyBuht58TZusVJm4do47LSooBWBGSZErsS8",
  authDomain: "asialog-2aa38.firebaseapp.com",
  projectId: "asialog-2aa38",
  storageBucket: "asialog-2aa38.firebasestorage.app",
  messagingSenderId: "472239170057",
  appId: "1:472239170057:web:c5267f425f2ab661520ed8",
  measurementId: "G-VZWR0QP89W"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Analytics (only in browser)
let analytics: ReturnType<typeof getAnalytics> | null = null;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (e) {
    console.log('Analytics not available');
  }
}

// Recaptcha verifier for phone auth
let recaptchaVerifier: RecaptchaVerifier | null = null;

export const setupRecaptcha = (containerId: string) => {
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: () => {
        console.log('reCAPTCHA solved');
      }
    });
  }
  return recaptchaVerifier;
};

export const clearRecaptcha = () => {
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
};

// Auth functions
export const firebaseEmailSignIn = async (email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const firebaseEmailSignUp = async (email: string, password: string, displayName: string) => {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  if (result.user) {
    await updateProfile(result.user, { displayName });
  }
  return result;
};

export const firebaseGoogleSignIn = async () => {
  googleProvider.setCustomParameters({
    prompt: 'select_account'
  });
  return signInWithPopup(auth, googleProvider);
};

export const firebasePhoneSignIn = async (phoneNumber: string, appVerifier: RecaptchaVerifier): Promise<ConfirmationResult> => {
  return signInWithPhoneNumber(auth, phoneNumber, appVerifier);
};

export const firebaseSendPasswordReset = async (email: string) => {
  return sendPasswordResetEmail(auth, email);
};

export const firebaseConfirmPasswordReset = async (oobCode: string, newPassword: string) => {
  return confirmPasswordReset(auth, oobCode, newPassword);
};

export const firebaseSignOut = async () => {
  return signOut(auth);
};

export const onFirebaseAuthStateChanged = (callback: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export type { FirebaseUser, ConfirmationResult };
