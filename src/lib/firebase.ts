import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  onAuthStateChanged,
  User,
  signOut as firebaseAuthSignOut,
  UserCredential
} from 'firebase/auth';

// Initialize Firebase
const app = initializeApp({
  apiKey: "AIzaSyBuht58TZusVJm4do47LSooBWBGSZErsS8",
  authDomain: "asialog-2aa38.firebaseapp.com",
  projectId: "asialog-2aa38",
  storageBucket: "asialog-2aa38.firebasestorage.app",
  messagingSenderId: "472239170057",
  appId: "1:472239170057:web:c5267f425f2ab661520ed8",
  measurementId: "G-VZWR0QP89W"
});

export const auth = getAuth(app);

// Google Provider
export const googleProvider = new GoogleAuthProvider();

// Firebase Auth Functions
export const firebaseCreateUser = async (email: string, password: string): Promise<UserCredential> => {
  try {
    console.log('Creating user with email:', email);
    const result = await createUserWithEmailAndPassword(auth, email, password);
    console.log('User created successfully:', result.user.uid);
    return result;
  } catch (error: any) {
    console.error('Firebase create user error:', error.code, error.message);
    throw error;
  }
};

export const firebaseSignIn = async (email: string, password: string): Promise<UserCredential> => {
  try {
    console.log('Signing in with email:', email);
    const result = await signInWithEmailAndPassword(auth, email, password);
    console.log('Sign in successful:', result.user.uid);
    return result;
  } catch (error: any) {
    console.error('Firebase sign in error:', error.code, error.message);
    throw error;
  }
};

export const firebaseSignInWithGoogle = async (): Promise<UserCredential> => {
  return await signInWithPopup(auth, googleProvider);
};

export const firebaseSendEmailVerification = async (user: User): Promise<void> => {
  return await sendEmailVerification(user, {
    url: `${window.location.origin}/login`,
    handleCodeInApp: true
  });
};

export const signOutFromFirebase = async (): Promise<void> => {
  return await firebaseAuthSignOut(auth);
};

export const firebaseOnAuthStateChanged = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export default app;
