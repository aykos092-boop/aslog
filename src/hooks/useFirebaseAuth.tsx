import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { getUserProfile, AppRole, UserProfile } from '@/services/firebaseAuthService';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  role: AppRole | null;
  loading: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  accountStatus: string;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const FirebaseAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [accountStatus, setAccountStatus] = useState('pending');

  const loadUserProfile = async (uid: string) => {
    try {
      const profile = await getUserProfile(uid);
      if (profile) {
        setUserProfile(profile);
        setRole(profile.role);
        setEmailVerified(profile.emailVerified);
        setPhoneVerified(profile.phoneVerified);
        setAccountStatus(profile.accountStatus);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const refreshUserProfile = async () => {
    if (user) {
      await loadUserProfile(user.uid);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        await loadUserProfile(firebaseUser.uid);
      } else {
        setUserProfile(null);
        setRole(null);
        setEmailVerified(false);
        setPhoneVerified(false);
        setAccountStatus('pending');
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        role,
        loading,
        emailVerified,
        phoneVerified,
        accountStatus,
        refreshUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useFirebaseAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useFirebaseAuth must be used within FirebaseAuthProvider');
  }
  return context;
};
