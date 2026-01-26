import { supabase } from "@/integrations/supabase/client";

export type AppRole = "client" | "carrier" | "admin";

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  role: AppRole;
  phone?: string;
  referralCode?: string;
}

export interface PasswordResetData {
  email?: string;
  phone?: string;
  token?: string;
  otp?: string;
  newPassword: string;
}

export interface GoogleAuthData {
  idToken: string;
  role?: AppRole;
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

// Phone validation (Uzbekistan format)
export const validatePhone = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 12 && digits.startsWith('998');
};

// Format phone number
export const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  
  if (digits.startsWith('998')) {
    const rest = digits.slice(3);
    let formatted = '+998';
    if (rest.length > 0) formatted += ' ' + rest.slice(0, 2);
    if (rest.length > 2) formatted += ' ' + rest.slice(2, 5);
    if (rest.length > 5) formatted += ' ' + rest.slice(5, 7);
    if (rest.length > 7) formatted += ' ' + rest.slice(7, 9);
    return formatted;
  }
  
  if (!digits.startsWith('998') && digits.length > 0) {
    return '+998 ' + digits.slice(0, 9);
  }
  
  return value;
};

// Send Email OTP
export const sendEmailOTP = async (
  email: string, 
  type: 'email_verification' | 'login' = 'email_verification'
): Promise<{ success: boolean; error?: string; otpId?: string; expiresAt?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('auth-email-otp', {
      body: { action: 'send', email, type }
    });

    if (error) throw error;
    
    return {
      success: data.success,
      otpId: data.otpId,
      expiresAt: data.expiresAt,
      error: data.error
    };
  } catch (error: any) {
    console.error('Send email OTP error:', error);
    return {
      success: false,
      error: error.message || 'Не удалось отправить код'
    };
  }
};

// Verify Email OTP
export const verifyEmailOTP = async (
  email: string, 
  code: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('auth-email-otp', {
      body: { action: 'verify', email, code }
    });

    if (error) throw error;
    
    return {
      success: data.success,
      error: data.error
    };
  } catch (error: any) {
    console.error('Verify email OTP error:', error);
    return {
      success: false,
      error: error.message || 'Неверный код'
    };
  }
};

// Resend Email OTP
export const resendEmailOTP = async (
  email: string, 
  type: 'email_verification' | 'login' = 'email_verification'
): Promise<{ success: boolean; error?: string; retryAfter?: number }> => {
  try {
    const { data, error } = await supabase.functions.invoke('auth-email-otp', {
      body: { action: 'resend', email, type }
    });

    if (error) throw error;
    
    return {
      success: data.success,
      error: data.error,
      retryAfter: data.retry_after
    };
  } catch (error: any) {
    console.error('Resend email OTP error:', error);
    return {
      success: false,
      error: error.message || 'Не удалось отправить код',
      retryAfter: error.retry_after
    };
  }
};

// Sign Up with Email OTP
export const signUpWithEmailOTP = async (data: SignUpData): Promise<{
  success: boolean;
  error?: string;
  requiresOTP?: boolean;
  userId?: string;
}> => {
  try {
    // Validate password
    const passwordValidation = validatePassword(data.password);
    if (!passwordValidation.valid) {
      return {
        success: false,
        error: passwordValidation.errors.join(', ')
      };
    }

    // Validate email
    if (!validateEmail(data.email)) {
      return {
        success: false,
        error: 'Неверный формат email'
      };
    }

    // Create user with pending status (email_confirm: false)
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          role: data.role
        },
        emailRedirectTo: `${window.location.origin}/auth`
      }
    });

    if (signUpError) throw signUpError;
    if (!authData.user) throw new Error('User creation failed');

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: authData.user.id,
        full_name: data.fullName,
        phone: data.phone?.replace(/\D/g, ''),
        account_status: 'pending' // Pending until email verified
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
    }

    // Assign role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: data.role
      });

    if (roleError) {
      console.error('Role assignment error:', roleError);
    }

    // Generate referral code
    const referralCode = `${data.role === 'client' ? 'C' : 'D'}${authData.user.id.substring(0, 6).toUpperCase()}`;
    await supabase.from('profiles').update({
      referral_code: referralCode
    }).eq('user_id', authData.user.id);

    // Handle referral if provided
    if (data.referralCode) {
      const { data: referrerProfile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('referral_code', data.referralCode.toUpperCase())
        .single();

      if (referrerProfile) {
        await supabase.from('referrals').insert({
          referrer_id: referrerProfile.user_id,
          referred_id: authData.user.id,
          referral_code: data.referralCode.toUpperCase()
        });
      }
    }

    // Send OTP
    const otpResult = await sendEmailOTP(data.email, 'email_verification');

    return {
      success: true,
      requiresOTP: true,
      userId: authData.user.id
    };
  } catch (error: any) {
    console.error('Sign up error:', error);
    return {
      success: false,
      error: error.message || 'Ошибка регистрации'
    };
  }
};

// Sign In with Email/Password
export const signInWithEmail = async (
  email: string, 
  password: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    // Update last login
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({
        last_login_at: new Date().toISOString()
      }).eq('user_id', user.id);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Sign in error:', error);
    return {
      success: false,
      error: error.message || 'Ошибка входа'
    };
  }
};

// Google OAuth Sign In/Up
export const signInWithGoogle = async (data: GoogleAuthData): Promise<{
  success: boolean;
  error?: string;
  action?: 'login' | 'signup';
  userId?: string;
}> => {
  try {
    const { data: result, error } = await supabase.functions.invoke('auth-google-oauth', {
      body: { 
        action: 'verify-id-token', 
        idToken: data.idToken,
        role: data.role || 'client'
      }
    });

    if (error) throw error;

    return {
      success: result.success,
      action: result.action,
      userId: result.user?.id,
      error: result.error
    };
  } catch (error: any) {
    console.error('Google OAuth error:', error);
    return {
      success: false,
      error: error.message || 'Ошибка Google OAuth'
    };
  }
};

// Request Password Reset
export const requestPasswordReset = async (
  emailOrPhone: string
): Promise<{ success: boolean; error?: string; method?: string }> => {
  try {
    const isEmail = validateEmail(emailOrPhone);
    
    const { data, error } = await supabase.functions.invoke('password-reset', {
      body: { 
        action: 'request',
        ...(isEmail ? { email: emailOrPhone } : { phone: emailOrPhone.replace(/\D/g, '') })
      }
    });

    if (error) throw error;

    return {
      success: data.success,
      method: data.method,
      error: data.error
    };
  } catch (error: any) {
    console.error('Password reset request error:', error);
    return {
      success: false,
      error: error.message || 'Ошибка запроса сброса пароля'
    };
  }
};

// Reset Password
export const resetPassword = async (data: PasswordResetData): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    // Validate password
    const passwordValidation = validatePassword(data.newPassword);
    if (!passwordValidation.valid) {
      return {
        success: false,
        error: passwordValidation.errors.join(', ')
      };
    }

    const { data: result, error } = await supabase.functions.invoke('password-reset', {
      body: { 
        action: 'reset',
        token: data.token,
        otp: data.otp,
        phone: data.phone,
        newPassword: data.newPassword
      }
    });

    if (error) throw error;

    return {
      success: result.success,
      error: result.error
    };
  } catch (error: any) {
    console.error('Password reset error:', error);
    return {
      success: false,
      error: error.message || 'Ошибка сброса пароля'
    };
  }
};

// Send Phone OTP via Telegram
export const sendPhoneOTP = async (
  phone: string,
  telegramChatId?: string,
  userId?: string
): Promise<{ success: boolean; error?: string; otpId?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('telegram-otp', {
      body: { 
        action: 'send', 
        phone: phone.replace(/\D/g, ''),
        telegramChatId,
        userId
      }
    });

    if (error) throw error;

    return {
      success: data.success,
      otpId: data.otpId,
      error: data.error
    };
  } catch (error: any) {
    console.error('Send phone OTP error:', error);
    return {
      success: false,
      error: error.message || 'Не удалось отправить код'
    };
  }
};

// Verify Phone OTP
export const verifyPhoneOTP = async (
  phone: string,
  code: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('telegram-otp', {
      body: { 
        action: 'verify', 
        phone: phone.replace(/\D/g, ''),
        code
      }
    });

    if (error) throw error;

    return {
      success: data.success,
      error: data.error
    };
  } catch (error: any) {
    console.error('Verify phone OTP error:', error);
    return {
      success: false,
      error: error.message || 'Неверный код'
    };
  }
};

// Sign Out
export const signOut = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    return { success: true };
  } catch (error: any) {
    console.error('Sign out error:', error);
    return {
      success: false,
      error: error.message || 'Ошибка выхода'
    };
  }
};
