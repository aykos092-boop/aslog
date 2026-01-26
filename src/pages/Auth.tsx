import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { User, Truck, ArrowLeft, Loader2, Gift, Phone, Mail, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/config/brand";
import { PhoneOTPVerification } from "@/components/auth/PhoneOTPVerification";
import { PasswordResetForm } from "@/components/auth/PasswordResetForm";
import { EmailOTPInput } from "@/components/auth/EmailOTPInput";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { validatePassword, validateEmail, signUpWithEmailOTP, AppRole } from "@/services/authService";
type Role = "client" | "carrier";
type AuthMethod = "email" | "phone";
const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    user,
    signIn,
    signUp,
    loading: authLoading
  } = useAuth();
  const {
    toast
  } = useToast();
  const {
    t
  } = useLanguage();
  const emailSchema = z.string().email(t("auth.invalidEmail"));
  const passwordSchema = z.string().min(6, `${t("auth.minChars")} 6 ${t("auth.chars")}`);
  const nameSchema = z.string().min(2, `${t("auth.minChars")} 2 ${t("auth.chars")}`);

  // View state
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>("email");

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Signup state
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupRole, setSignupRole] = useState<Role>("client");
  const [signupLoading, setSignupLoading] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [referralValid, setReferralValid] = useState<boolean | null>(null);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [signupStep, setSignupStep] = useState<'info' | 'email-verify' | 'phone-verify'>('info');
  const [showEmailOTP, setShowEmailOTP] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  useEffect(() => {
    const refCode = searchParams.get("ref");
    if (refCode) {
      setReferralCode(refCode.toUpperCase());
      validateReferralCode(refCode.toUpperCase());
    }
  }, [searchParams]);
  useEffect(() => {
    if (user && !authLoading) {
      navigate("/dashboard");
    }
  }, [user, authLoading, navigate]);
  const validateReferralCode = async (code: string) => {
    if (!code.trim()) {
      setReferralValid(null);
      return;
    }
    const {
      data
    } = await supabase.from("profiles").select("user_id").eq("referral_code", code.toUpperCase()).single();
    setReferralValid(!!data);
  };
  const formatPhone = (value: string) => {
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
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMethod === 'email') {
      try {
        emailSchema.parse(loginEmail);
        passwordSchema.parse(loginPassword);
      } catch (error) {
        if (error instanceof z.ZodError) {
          toast({
            title: t("auth.validationError"),
            description: error.errors[0].message,
            variant: "destructive"
          });
          return;
        }
      }
      setLoginLoading(true);
      const {
        error
      } = await signIn(loginEmail, loginPassword);
      if (error) {
        let message = t("auth.loginFailed");
        if (error.message.includes("Invalid login credentials")) message = t("auth.invalidCredentials");else if (error.message.includes("Email not confirmed")) message = t("auth.emailNotConfirmed");
        toast({
          title: t("auth.loginError"),
          description: message,
          variant: "destructive"
        });
      } else {
        toast({
          title: t("auth.welcome"),
          description: t("auth.loginSuccess")
        });
        navigate("/dashboard");
      }
      setLoginLoading(false);
    } else {
      // Phone login - find user by phone, then login with email
      setLoginLoading(true);
      const phoneDigits = loginPhone.replace(/\D/g, '');
      const {
        data: profile
      } = await supabase.from('profiles').select('user_id').eq('phone', phoneDigits).single();
      if (!profile) {
        toast({
          title: t("auth.loginError"),
          description: "Пользователь с таким телефоном не найден",
          variant: "destructive"
        });
        setLoginLoading(false);
        return;
      }

      // Get user email
      const {
        data: userData
      } = await supabase.auth.admin.getUserById(profile.user_id);
      if (userData?.user?.email) {
        const {
          error
        } = await signIn(userData.user.email, loginPassword);
        if (error) {
          toast({
            title: t("auth.loginError"),
            description: t("auth.invalidCredentials"),
            variant: "destructive"
          });
        } else {
          navigate("/dashboard");
        }
      } else {
        toast({
          title: t("auth.loginError"),
          description: t("auth.invalidCredentials"),
          variant: "destructive"
        });
      }
      setLoginLoading(false);
    }
  };
  const handleSignupContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    if (!validateEmail(signupEmail)) {
      toast({
        title: t("auth.validationError"),
        description: "Неверный формат email",
        variant: "destructive"
      });
      return;
    }

    const passwordValidation = validatePassword(signupPassword);
    if (!passwordValidation.valid) {
      toast({
        title: "Пароль не соответствует требованиям",
        description: passwordValidation.errors.join(', '),
        variant: "destructive"
      });
      return;
    }

    if (signupName.length < 2) {
      toast({
        title: t("auth.validationError"),
        description: "Имя должно содержать минимум 2 символа",
        variant: "destructive"
      });
      return;
    }

    // Start signup with email OTP verification
    setSignupLoading(true);
    const result = await signUpWithEmailOTP({
      email: signupEmail,
      password: signupPassword,
      fullName: signupName,
      role: signupRole as AppRole,
      phone: signupPhone,
      referralCode
    });

    if (result.success && result.requiresOTP) {
      setPendingUserId(result.userId || null);
      setSignupStep('email-verify');
      toast({
        title: "Проверьте email",
        description: `Мы отправили код на ${signupEmail}`
      });
    } else if (result.error) {
      toast({
        title: "Ошибка регистрации",
        description: result.error,
        variant: "destructive"
      });
    }
    setSignupLoading(false);
  };
  const completeSignup = async () => {
    setSignupLoading(true);
    const {
      error,
      data
    } = await signUp(signupEmail, signupPassword, signupRole, signupName);
    if (error) {
      let message = t("auth.registrationFailed");
      if (error.message.includes("already registered")) message = t("auth.emailAlreadyRegistered");
      toast({
        title: t("auth.registrationError"),
        description: message,
        variant: "destructive"
      });
      setSignupLoading(false);
      return;
    }

    // Update profile with phone
    if (data?.user && signupPhone) {
      await supabase.from('profiles').update({
        phone: signupPhone.replace(/\D/g, ''),
        phone_verified: phoneVerified
      }).eq('user_id', data.user.id);
    }

    // Handle referral
    if (referralCode && referralValid && data?.user) {
      const {
        data: referrerProfile
      } = await supabase.from("profiles").select("user_id").eq("referral_code", referralCode.toUpperCase()).single();
      if (referrerProfile) {
        await supabase.from("referrals").insert({
          referrer_id: referrerProfile.user_id,
          referred_id: data.user.id,
          referral_code: referralCode.toUpperCase()
        });
      }
    }
    toast({
      title: t("auth.registrationSuccess"),
      description: t("auth.welcomeToPlatform")
    });
    navigate("/dashboard");
    setSignupLoading(false);
  };
  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>;
  }
  if (showPasswordReset) {
    return <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center p-4">
        <PasswordResetForm onBack={() => setShowPasswordReset(false)} onSuccess={() => setShowPasswordReset(false)} />
      </div>;
  }
  return <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-customer/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-driver/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <Button variant="ghost" className="mb-4" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t("auth.backToHome")}
        </Button>

        <Card className="border-2">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">{BRAND.name}</CardTitle>
            <CardDescription>{t("auth.platformDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">{t("auth.loginTab")}</TabsTrigger>
                <TabsTrigger value="signup">{t("auth.registerTab")}</TabsTrigger>
              </TabsList>

              {/* Login Form */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  {/* Auth Method Toggle */}
                  <div className="flex rounded-lg border p-1 gap-1">
                    <Button type="button" variant={authMethod === 'email' ? 'default' : 'ghost'} className="flex-1" size="sm" onClick={() => setAuthMethod('email')}>
                      <Mail className="w-4 h-4 mr-2" />
                      Email
                    </Button>
                    <Button type="button" variant={authMethod === 'phone' ? 'default' : 'ghost'} className="flex-1" size="sm" onClick={() => setAuthMethod('phone')}>
                      <Phone className="w-4 h-4 mr-2" />
                      Телефон
                    </Button>
                  </div>

                  {authMethod === 'email' ? <div className="space-y-2">
                      <Label htmlFor="login-email">{t("auth.email")}</Label>
                      <Input id="login-email" type="email" placeholder="example@mail.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
                    </div> : <div className="space-y-2">
                      <Label htmlFor="login-phone">Телефон</Label>
                      <Input id="login-phone" type="tel" placeholder="+998 90 123 45 67" value={loginPhone} onChange={e => setLoginPhone(formatPhone(e.target.value))} required />
                    </div>}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password">{t("auth.password")}</Label>
                      <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => setShowPasswordReset(true)}>
                        <KeyRound className="w-3 h-3 mr-1" />
                        Забыли пароль?
                      </Button>
                    </div>
                    <Input id="login-password" type="password" placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                  </div>

                  <Button type="submit" className="w-full" variant="hero" size="lg" disabled={loginLoading}>
                    {loginLoading ? <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t("auth.loggingIn")}
                      </> : t("auth.login")}
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Или</span>
                    </div>
                  </div>

                  <GoogleSignInButton 
                    role="client"
                    onSuccess={() => {
                      toast({
                        title: "✅ Вход выполнен",
                        description: "Добро пожаловать!"
                      });
                      navigate("/dashboard");
                    }}
                  />
                </form>
              </TabsContent>

              {/* Signup Form */}
              <TabsContent value="signup">
                {signupStep === 'email-verify' ? <div className="space-y-4">
                    <EmailOTPInput
                      email={signupEmail}
                      type="email_verification"
                      onVerified={() => {
                        toast({
                          title: "✅ Email подтверждён",
                          description: "Добро пожаловать!"
                        });
                        
                        // Check if phone needs verification
                        if (signupPhone && !phoneVerified) {
                          setSignupStep('phone-verify');
                        } else {
                          navigate("/dashboard");
                        }
                      }}
                      onError={(error) => {
                        console.error('Email OTP error:', error);
                      }}
                    />
                    <Button variant="ghost" className="w-full" onClick={() => setSignupStep('info')}>
                      Назад
                    </Button>
                  </div> : signupStep === 'phone-verify' ? <div className="space-y-4">
                    <div className="text-center mb-4">
                      <h3 className="font-semibold">Подтвердите телефон</h3>
                      <p className="text-sm text-muted-foreground">
                        Мы отправим код на {signupPhone}
                      </p>
                    </div>
                    <PhoneOTPVerification phone={signupPhone} onPhoneChange={setSignupPhone} onVerified={() => {
                  setPhoneVerified(true);
                  completeSignup();
                }} />
                    <Button variant="ghost" className="w-full" onClick={() => setSignupStep('info')}>
                      Назад
                    </Button>
                  </div> : <form onSubmit={handleSignupContinue} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">{t("profile.name")}</Label>
                      <Input id="signup-name" type="text" placeholder={t("auth.namePlaceholder")} value={signupName} onChange={e => setSignupName(e.target.value)} required />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-email">{t("auth.email")}</Label>
                      <Input id="signup-email" type="email" placeholder="example@mail.com" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} required />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-phone">
                        Телефон <span className="text-muted-foreground">(опционально)</span>
                      </Label>
                      <Input id="signup-phone" type="tel" placeholder="+998 90 123 45 67" value={signupPhone} onChange={e => setSignupPhone(formatPhone(e.target.value))} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-password">{t("auth.password")}</Label>
                      <Input id="signup-password" type="password" placeholder={t("auth.passwordPlaceholder")} value={signupPassword} onChange={e => setSignupPassword(e.target.value)} required />
                    </div>

                    {/* Role Selection */}
                    <div className="space-y-3">
                      <Label>{t("auth.selectRole")}</Label>
                      <RadioGroup value={signupRole} onValueChange={value => setSignupRole(value as Role)} className="grid grid-cols-2 gap-4">
                        <Label htmlFor="role-client" className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${signupRole === "client" ? "border-customer bg-customer-light" : "border-border hover:border-customer/50"}`}>
                          <RadioGroupItem value="client" id="role-client" className="sr-only" />
                          <div className="w-12 h-12 rounded-full gradient-customer flex items-center justify-center">
                            <User className="w-6 h-6 text-white" />
                          </div>
                          <span className="font-medium">{t("role.client")}</span>
                          <span className="text-xs text-muted-foreground text-center">
                            {t("auth.iOrderDelivery")}
                          </span>
                        </Label>

                        <Label htmlFor="role-carrier" className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${signupRole === "carrier" ? "border-driver bg-driver-light" : "border-border hover:border-driver/50"}`}>
                          <RadioGroupItem value="carrier" id="role-carrier" className="sr-only" />
                          <div className="w-12 h-12 rounded-full gradient-driver flex items-center justify-center">
                            <Truck className="w-6 h-6 text-white" />
                          </div>
                          <span className="font-medium">{t("role.carrier")}</span>
                          <span className="text-xs text-muted-foreground text-center">
                            {t("auth.iExecuteOrders")}
                          </span>
                        </Label>
                      </RadioGroup>
                    </div>

                    {/* Referral Code */}
                    <div className="space-y-2">
                      <Label htmlFor="referral-code" className="flex items-center gap-2">
                        <Gift className="w-4 h-4" />
                        {t("auth.referralCode")}
                      </Label>
                      <Input id="referral-code" type="text" placeholder={t("auth.enterFriendCode")} value={referralCode} onChange={e => {
                    const code = e.target.value.toUpperCase();
                    setReferralCode(code);
                    validateReferralCode(code);
                  }} className={referralValid === true ? "border-green-500" : referralValid === false ? "border-red-500" : ""} />
                      {referralValid === true && <p className="text-xs text-green-600">✓ {t("auth.codeValid")}</p>}
                      {referralValid === false && referralCode && <p className="text-xs text-red-600">✗ {t("auth.codeNotFound")}</p>}
                    </div>

                    {/* Google Sign-In */}
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">Или</span>
                      </div>
                    </div>

                    <GoogleSignInButton 
                      role={signupRole as AppRole}
                      onSuccess={() => {
                        toast({
                          title: "✅ Вход выполнен",
                          description: "Добро пожаловать!"
                        });
                        navigate("/dashboard");
                      }}
                    />

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">Или зарегистрируйтесь</span>
                      </div>
                    </div>

                    <Button type="submit" className="w-full" variant={signupRole === "client" ? "customer" : "driver"} size="lg" disabled={signupLoading}>
                      {signupLoading ? <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {t("auth.registering")}
                        </> : signupPhone && !phoneVerified ? <>
                          <Phone className="w-4 h-4 mr-2" />
                          Подтвердить телефон
                        </> : `${t("auth.registerAs")} ${signupRole === "client" ? t("role.client") : t("role.carrier")}`}
                    </Button>

                    <div className="text-center">
                      
                      
                    </div>
                  </form>}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>;
};
export default Auth;