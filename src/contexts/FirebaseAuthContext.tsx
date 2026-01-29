import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User } from "firebase/auth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { 
  firebaseCreateUser,
  firebaseSignIn,
  firebaseSignInWithGoogle,
  firebaseSendEmailVerification,
  signOutFromFirebase,
  firebaseOnAuthStateChanged
} from "@/lib/firebase";

export type AppRole = "client" | "carrier" | "admin";

interface AuthContextType {
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  accountStatus: string;
  signUp: (email: string, password: string, role: AppRole, fullName: string, phone?: string, referralCode?: string) => Promise<{ error: Error | null; success: boolean; requiresEmailVerification?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: (role?: AppRole) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  checkEmailVerification: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const FirebaseAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [accountStatus, setAccountStatus] = useState('pending');
  const { toast } = useToast();

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (error) {
        // It's okay if user doesn't have a role yet (new user)
        if (error.code === 'PGRST116') {
          console.log('No role found for user:', userId);
          return null;
        }
        console.error("Error fetching role:", error);
        return null;
      }
      return data?.role as AppRole;
    } catch (error) {
      console.error("Database error in fetchUserRole:", error);
      return null;
    }
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("email_verified, phone_verified")
        .eq("user_id", userId)
        .single();

      if (error) {
        // It's okay if user doesn't have a profile yet (new user)
        if (error.code === 'PGRST116') {
          setEmailVerified(false);
          setPhoneVerified(false);
          setAccountStatus('pending');
          return;
        }
        console.error("Error fetching profile:", error);
        // Try without account_status if it doesn't exist
        const { data: basicData, error: basicError } = await supabase
          .from("profiles")
          .select("email_verified, phone_verified")
          .eq("user_id", userId)
          .single();
        
        if (basicError) {
          console.error("Error fetching basic profile:", basicError);
          setEmailVerified(false);
          setPhoneVerified(false);
          setAccountStatus('pending');
          return;
        }
        
        setEmailVerified(basicData?.email_verified || false);
        setPhoneVerified(basicData?.phone_verified || false);
        setAccountStatus('active'); // Default status
        return;
      }

      setEmailVerified(data?.email_verified || false);
      setPhoneVerified(data?.phone_verified || false);
      setAccountStatus('active'); // Default status since we can't query account_status
    } catch (error) {
      console.error("Error in fetchUserProfile:", error);
      setEmailVerified(false);
      setPhoneVerified(false);
      setAccountStatus('pending');
    }
  };

  const syncUserWithSupabase = async (firebaseUser: User, role: AppRole, fullName: string, phone?: string, referralCode?: string) => {
    try {
      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', firebaseUser.uid)
        .single();

      if (!existingProfile) {
        // Create profile
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            user_id: firebaseUser.uid,
            full_name: fullName,
            phone: phone?.replace(/\D/g, ''),
            email: firebaseUser.email,
            email_verified: firebaseUser.emailVerified
          });

        if (profileError) {
          console.error("Profile creation error:", profileError);
        }

        // Assign role
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: firebaseUser.uid,
            role: role,
          });

        if (roleError) {
          console.error("Role assignment error:", roleError);
        }

        // Generate referral code
        const referralCodeGenerated = `${role === 'client' ? 'C' : 'D'}${firebaseUser.uid.substring(0, 6).toUpperCase()}`;
        await supabase.from('profiles').update({
          referral_code: referralCodeGenerated
        }).eq('user_id', firebaseUser.uid);

        // Handle referral if provided
        if (referralCode) {
          const { data: referrerProfile } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('referral_code', referralCode.toUpperCase())
            .single();

          if (referrerProfile) {
            await supabase.from('referrals').insert({
              referrer_id: referrerProfile.user_id,
              referred_id: firebaseUser.uid,
              referral_code: referralCode.toUpperCase()
            });
          }
        }
      } else {
        // Update existing profile with Firebase email verification status
        await supabase.from('profiles').update({
          email_verified: firebaseUser.emailVerified
        }).eq('user_id', firebaseUser.uid);
      }
    } catch (error) {
      console.error("Error syncing user with Supabase:", error);
    }
  };

  const refreshUserData = async () => {
    if (user) {
      await fetchUserRole(user.uid).then(setRole);
      await fetchUserProfile(user.uid);
    }
  };

  const checkEmailVerification = async (): Promise<boolean> => {
    if (!user) return false;
    
    // Reload user to get latest email verification status
    await user.reload();
    
    if (user.emailVerified) {
      // Update Supabase profile
      await supabase.from('profiles').update({
        email_verified: true
      }).eq('user_id', user.uid);
      
      setEmailVerified(true);
      setAccountStatus('active');
      return true;
    }
    
    return false;
  };

  useEffect(() => {
    const unsubscribe = firebaseOnAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        await Promise.all([
          fetchUserRole(firebaseUser.uid),
          fetchUserProfile(firebaseUser.uid)
        ]).then(([r]) => {
          setRole(r);
        });
      } else {
        setRole(null);
        setEmailVerified(false);
        setPhoneVerified(false);
        setAccountStatus('pending');
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, role: AppRole, fullName: string, phone?: string, referralCode?: string) => {
    try {
      const userCredential = await firebaseCreateUser(email, password);
      
      // Send email verification
      await firebaseSendEmailVerification(userCredential.user);
      
      // Sync with Supabase
      await syncUserWithSupabase(userCredential.user, role, fullName, phone, referralCode);
      
      return { 
        error: null, 
        success: true, 
        requiresEmailVerification: true 
      };
    } catch (error) {
      return { 
        error: error as Error, 
        success: false 
      };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const userCredential = await firebaseSignIn(email, password);
      
      if (!userCredential.user.emailVerified) {
        return { 
          error: new Error('Пожалуйста, подтвердите ваш email перед входом') 
        };
      }
      
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const handleGoogleSignIn = async (role: AppRole = 'client') => {
    try {
      const userCredential = await firebaseSignInWithGoogle();
      
      // Sync with Supabase
      await syncUserWithSupabase(
        userCredential.user, 
        role, 
        userCredential.user.displayName || '',
        undefined,
        undefined
      );
      
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const handleSignOut = async () => {
    await signOutFromFirebase();
    setUser(null);
    setRole(null);
    setEmailVerified(false);
    setPhoneVerified(false);
    setAccountStatus('pending');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        emailVerified,
        phoneVerified,
        accountStatus,
        signUp,
        signIn,
        signInWithGoogle: handleGoogleSignIn,
        signOut: handleSignOut,
        refreshUserData,
        checkEmailVerification
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
