import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  firebaseEmailSignIn,
  firebaseEmailSignUp,
  firebaseGoogleSignIn,
  firebasePhoneSignIn,
  firebaseSendPasswordReset,
  firebaseSignOut,
  onFirebaseAuthStateChanged,
  setupRecaptcha,
  clearRecaptcha,
  FirebaseUser,
  ConfirmationResult
} from "@/lib/firebase";

type AppRole = "client" | "carrier" | "admin";

interface AuthContextType {
  user: FirebaseUser | null;
  role: AppRole | null;
  loading: boolean;
  // Email auth
  signUpWithEmail: (email: string, password: string, role: AppRole, fullName: string) => Promise<{ error: Error | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  // Google auth
  signInWithGoogle: (role?: AppRole) => Promise<{ error: Error | null }>;
  // Phone auth
  sendPhoneCode: (phoneNumber: string, containerId: string) => Promise<{ error: Error | null; confirmationResult?: ConfirmationResult }>;
  verifyPhoneCode: (confirmationResult: ConfirmationResult, code: string, role?: AppRole) => Promise<{ error: Error | null }>;
  // Password reset
  sendPasswordReset: (email: string) => Promise<{ error: Error | null }>;
  // Sign out
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const FirebaseAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Sync Firebase user with Supabase profile
  const syncUserToSupabase = async (firebaseUser: FirebaseUser, userRole?: AppRole, fullName?: string) => {
    try {
      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("user_id, firebase_uid")
        .eq("firebase_uid", firebaseUser.uid)
        .maybeSingle();

      if (!existingProfile) {
        // Create new profile with a generated user_id
        const newUserId = crypto.randomUUID();
        
        await supabase
          .from("profiles")
          .insert({
            user_id: newUserId,
            firebase_uid: firebaseUser.uid,
            full_name: fullName || firebaseUser.displayName || "Пользователь",
            phone: firebaseUser.phoneNumber?.replace(/\D/g, '') || null,
            avatar_url: firebaseUser.photoURL,
          });

        // Create firebase_user_roles entry if role provided
        if (userRole) {
          await supabase
            .from("firebase_user_roles")
            .insert({
              firebase_uid: firebaseUser.uid,
              role: userRole,
            });
          setRole(userRole);
        }
      } else {
        // Fetch existing role
        const { data: roleData } = await supabase
          .from("firebase_user_roles")
          .select("role")
          .eq("firebase_uid", firebaseUser.uid)
          .maybeSingle();

        if (roleData) {
          setRole(roleData.role as AppRole);
        } else if (userRole) {
          // Create role if not exists
          await supabase
            .from("firebase_user_roles")
            .insert({
              firebase_uid: firebaseUser.uid,
              role: userRole,
            });
          setRole(userRole);
        }
      }
    } catch (error) {
      console.error("Sync error:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onFirebaseAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        await syncUserToSupabase(firebaseUser);
      } else {
        setRole(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signUpWithEmail = async (email: string, password: string, userRole: AppRole, fullName: string) => {
    try {
      const result = await firebaseEmailSignUp(email, password, fullName);
      await syncUserToSupabase(result.user, userRole, fullName);
      return { error: null };
    } catch (error: any) {
      return { error: error as Error };
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await firebaseEmailSignIn(email, password);
      return { error: null };
    } catch (error: any) {
      return { error: error as Error };
    }
  };

  const signInWithGoogle = async (userRole?: AppRole) => {
    try {
      const result = await firebaseGoogleSignIn();
      await syncUserToSupabase(result.user, userRole);
      return { error: null };
    } catch (error: any) {
      return { error: error as Error };
    }
  };

  const sendPhoneCode = async (phoneNumber: string, containerId: string) => {
    try {
      clearRecaptcha();
      const appVerifier = setupRecaptcha(containerId);
      const confirmationResult = await firebasePhoneSignIn(phoneNumber, appVerifier);
      return { error: null, confirmationResult };
    } catch (error: any) {
      clearRecaptcha();
      return { error: error as Error };
    }
  };

  const verifyPhoneCode = async (confirmationResult: ConfirmationResult, code: string, userRole?: AppRole) => {
    try {
      const result = await confirmationResult.confirm(code);
      await syncUserToSupabase(result.user, userRole);
      return { error: null };
    } catch (error: any) {
      return { error: error as Error };
    }
  };

  const sendPasswordReset = async (email: string) => {
    try {
      await firebaseSendPasswordReset(email);
      return { error: null };
    } catch (error: any) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await firebaseSignOut();
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        signUpWithEmail,
        signInWithEmail,
        signInWithGoogle,
        sendPhoneCode,
        verifyPhoneCode,
        sendPasswordReset,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useFirebaseAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useFirebaseAuth must be used within a FirebaseAuthProvider");
  }
  return context;
};
