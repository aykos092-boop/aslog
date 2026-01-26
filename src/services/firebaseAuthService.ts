import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updatePassword,
  GoogleAuthProvider,
  signInWithPopup,
  User,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  increment,
  Timestamp,
  addDoc,
  deleteDoc,
} from 'firebase/firestore';
import { auth, db } from '@/config/firebase';

export type AppRole = 'client' | 'carrier' | 'admin';

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  role: AppRole;
  phone?: string;
  referralCode?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  role: AppRole;
  phone?: string;
  phoneVerified: boolean;
  emailVerified: boolean;
  accountStatus: 'pending' | 'active' | 'suspended' | 'blocked';
  referralCode: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt?: Timestamp;
}

// Password validation
export const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Минимум 8 символов');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Минимум одна заглавная буква (A-Z)');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Минимум одна строчная буква (a-z)');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Минимум одна цифра (0-9)');
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Минимум один спецсимвол (!@#$%^&*...)');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

// Email validation
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Generate 5-digit OTP
const generateOTP = (): string => {
  return Math.floor(10000 + Math.random() * 90000).toString();
};

// Generate referral code
const generateReferralCode = (role: AppRole, uid: string): string => {
  const prefix = role === 'client' ? 'C' : 'D';
  return `${prefix}${uid.substring(0, 6).toUpperCase()}`;
};

// Check rate limiting
const checkRateLimit = async (identifier: string, action: string, maxAttempts: number = 5): Promise<boolean> => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const attemptsRef = collection(db, 'auth_attempts');
  const q = query(
    attemptsRef,
    where('identifier', '==', identifier),
    where('attemptType', '==', action),
    where('createdAt', '>=', oneHourAgo)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.size < maxAttempts;
};

// Log auth attempt
const logAuthAttempt = async (identifier: string, attemptType: string, success: boolean) => {
  await addDoc(collection(db, 'auth_attempts'), {
    identifier,
    attemptType,
    success,
    createdAt: serverTimestamp(),
    ipAddress: 'unknown', // TODO: Get from request
    userAgent: navigator.userAgent,
  });
};

// Check account lockout
const isAccountLocked = async (identifier: string): Promise<boolean> => {
  const lockoutsRef = collection(db, 'account_lockouts');
  const q = query(
    lockoutsRef,
    where('identifier', '==', identifier),
    where('lockedUntil', '>', new Date())
  );
  
  const snapshot = await getDocs(q);
  return !snapshot.empty;
};

// Lock account
const lockAccount = async (identifier: string, reason: string, durationMinutes: number = 10) => {
  const lockedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
  
  await addDoc(collection(db, 'account_lockouts'), {
    identifier,
    lockedUntil,
    reason,
    createdAt: serverTimestamp(),
  });
};

// Send Email OTP
export const sendEmailOTP = async (
  email: string,
  type: 'email_verification' | 'login' = 'email_verification'
): Promise<{ success: boolean; error?: string; otpId?: string }> => {
  try {
    // Validate email
    if (!validateEmail(email)) {
      return { success: false, error: 'Неверный формат email' };
    }

    // Check account lockout
    if (await isAccountLocked(email)) {
      return { success: false, error: 'Аккаунт временно заблокирован. Попробуйте позже.' };
    }

    // Check rate limiting
    if (!(await checkRateLimit(email, 'email_otp', 5))) {
      await lockAccount(email, 'OTP rate limit exceeded', 10);
      return { success: false, error: 'Слишком много запросов. Аккаунт заблокирован на 10 минут.' };
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store OTP in Firestore
    const otpRef = await addDoc(collection(db, 'email_otp_codes'), {
      email,
      code: otp,
      type,
      verified: false,
      attempts: 0,
      maxAttempts: 5,
      expiresAt,
      createdAt: serverTimestamp(),
    });

    // TODO: Send email via Cloud Function or external service
    console.log(`OTP for ${email}: ${otp}`);

    // Log attempt
    await logAuthAttempt(email, 'email_otp_send', true);

    return {
      success: true,
      otpId: otpRef.id,
    };
  } catch (error) {
    console.error('Send email OTP error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Не удалось отправить код',
    };
  }
};

// Verify Email OTP
export const verifyEmailOTP = async (
  email: string,
  code: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Check account lockout
    if (await isAccountLocked(email)) {
      return { success: false, error: 'Аккаунт временно заблокирован' };
    }

    // Find OTP
    const otpRef = collection(db, 'email_otp_codes');
    const q = query(
      otpRef,
      where('email', '==', email),
      where('code', '==', code),
      where('verified', '==', false),
      where('expiresAt', '>', new Date())
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      await logAuthAttempt(email, 'otp_verify', false);
      
      // Check failed attempts
      const failedAttempts = await getDocs(
        query(
          collection(db, 'auth_attempts'),
          where('identifier', '==', email),
          where('attemptType', '==', 'otp_verify'),
          where('success', '==', false),
          where('createdAt', '>=', new Date(Date.now() - 10 * 60 * 1000))
        )
      );

      if (failedAttempts.size >= 5) {
        await lockAccount(email, 'Too many failed OTP attempts', 10);
        return { success: false, error: 'Слишком много неверных попыток. Аккаунт заблокирован на 10 минут.' };
      }

      return { success: false, error: 'Неверный или истёкший код' };
    }

    const otpDoc = snapshot.docs[0];
    const otpData = otpDoc.data();

    // Check max attempts
    if (otpData.attempts >= otpData.maxAttempts) {
      return { success: false, error: 'Превышено максимальное количество попыток' };
    }

    // Mark as verified
    await updateDoc(doc(db, 'email_otp_codes', otpDoc.id), {
      verified: true,
      updatedAt: serverTimestamp(),
    });

    // Log success
    await logAuthAttempt(email, 'otp_verify', true);

    return { success: true };
  } catch (error) {
    console.error('Verify email OTP error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неверный код',
    };
  }
};

// Sign Up with Email
export const signUpWithEmail = async (data: SignUpData): Promise<{
  success: boolean;
  error?: string;
  user?: User;
}> => {
  try {
    // Validate password
    const passwordValidation = validatePassword(data.password);
    if (!passwordValidation.valid) {
      return {
        success: false,
        error: passwordValidation.errors.join(', '),
      };
    }

    // Validate email
    if (!validateEmail(data.email)) {
      return {
        success: false,
        error: 'Неверный формат email',
      };
    }

    // Create user
    const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const user = userCredential.user;

    // Update profile
    await updateProfile(user, {
      displayName: data.fullName,
    });

    // Generate referral code
    const referralCode = generateReferralCode(data.role, user.uid);

    // Create user profile in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: data.email,
      fullName: data.fullName,
      role: data.role,
      phone: data.phone || '',
      phoneVerified: false,
      emailVerified: false,
      accountStatus: 'pending',
      referralCode,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Handle referral if provided
    if (data.referralCode) {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('referralCode', '==', data.referralCode.toUpperCase()));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const referrerId = snapshot.docs[0].id;
        await addDoc(collection(db, 'referrals'), {
          referrerId,
          referredId: user.uid,
          referralCode: data.referralCode.toUpperCase(),
          createdAt: serverTimestamp(),
        });
      }
    }

    // Send verification email
    await sendEmailVerification(user);

    return {
      success: true,
      user,
    };
  } catch (error) {
    console.error('Sign up error:', error);
    let errorMessage = 'Ошибка регистрации';
    
    if (error instanceof Error) {
      if (error.message.includes('email-already-in-use')) {
        errorMessage = 'Email уже зарегистрирован';
      } else if (error.message.includes('weak-password')) {
        errorMessage = 'Слишком слабый пароль';
      } else {
        errorMessage = error.message;
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
};

// Sign In with Email
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; user?: User }> => {
  try {
    // Check account lockout
    if (await isAccountLocked(email)) {
      return { success: false, error: 'Аккаунт временно заблокирован' };
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update last login
    await updateDoc(doc(db, 'users', user.uid), {
      lastLoginAt: serverTimestamp(),
    });

    // Log success
    await logAuthAttempt(email, 'login', true);

    return {
      success: true,
      user,
    };
  } catch (error) {
    console.error('Sign in error:', error);
    
    // Log failed attempt
    await logAuthAttempt(email, 'login', false);

    // Check failed attempts
    const failedAttempts = await getDocs(
      query(
        collection(db, 'auth_attempts'),
        where('identifier', '==', email),
        where('attemptType', '==', 'login'),
        where('success', '==', false),
        where('createdAt', '>=', new Date(Date.now() - 10 * 60 * 1000))
      )
    );

    if (failedAttempts.size >= 5) {
      await lockAccount(email, 'Too many failed login attempts', 10);
      return { success: false, error: 'Слишком много неудачных попыток. Аккаунт заблокирован на 10 минут.' };
    }

    let errorMessage = 'Ошибка входа';
    
    if (error instanceof Error) {
      if (error.message.includes('user-not-found') || error.message.includes('wrong-password')) {
        errorMessage = 'Неверный email или пароль';
      } else if (error.message.includes('too-many-requests')) {
        errorMessage = 'Слишком много попыток. Попробуйте позже.';
      } else {
        errorMessage = error.message;
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
};

// Google Sign In
export const signInWithGoogle = async (
  role: AppRole = 'client'
): Promise<{ success: boolean; error?: string; user?: User; isNewUser?: boolean }> => {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account',
    });

    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Check if user exists
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const isNewUser = !userDoc.exists();

    if (isNewUser) {
      // Create new user profile
      const referralCode = generateReferralCode(role, user.uid);

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        fullName: user.displayName || 'User',
        role,
        phone: user.phoneNumber || '',
        phoneVerified: !!user.phoneNumber,
        emailVerified: user.emailVerified,
        accountStatus: 'active',
        referralCode,
        photoURL: user.photoURL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      // Update last login
      await updateDoc(doc(db, 'users', user.uid), {
        lastLoginAt: serverTimestamp(),
        emailVerified: user.emailVerified,
      });
    }

    return {
      success: true,
      user,
      isNewUser,
    };
  } catch (error) {
    console.error('Google sign in error:', error);
    let errorMessage = 'Ошибка входа через Google';
    
    if (error instanceof Error) {
      if (error.message.includes('popup-closed-by-user')) {
        errorMessage = 'Вход отменён';
      } else if (error.message.includes('popup-blocked')) {
        errorMessage = 'Всплывающее окно заблокировано браузером';
      } else {
        errorMessage = error.message;
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
};

// Password Reset
export const requestPasswordReset = async (
  email: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!validateEmail(email)) {
      return { success: false, error: 'Неверный формат email' };
    }

    await sendPasswordResetEmail(auth, email);

    return { success: true };
  } catch (error) {
    console.error('Password reset error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка сброса пароля',
    };
  }
};

// Sign Out
export const signOut = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    await firebaseSignOut(auth);
    return { success: true };
  } catch (error) {
    console.error('Sign out error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка выхода',
    };
  }
};

// Get user profile
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Get user profile error:', error);
    return null;
  }
};
