import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { User, Truck, ArrowLeft, Loader2, Gift } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/config/brand";
import { EmailVerificationTimer } from "@/components/auth/EmailVerificationTimer";
import { AppRole } from "@/contexts/FirebaseAuthContext";

type Role = "client" | "carrier";

const Signup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    user,
    signUp,
    loading: authLoading
  } = useFirebaseAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const emailSchema = z.string().email(t("auth.invalidEmail"));
  const nameSchema = z.string().min(2, `${t("auth.minChars")} 2 ${t("auth.chars")}`);

  // Signup state
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupRole, setSignupRole] = useState<Role>("client");
  const [signupLoading, setSignupLoading] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [referralValid, setReferralValid] = useState<boolean | null>(null);
  const [showEmailVerification, setShowEmailVerification] = useState(false);

  useEffect(() => {
    const refCode = searchParams.get("ref");
    if (refCode) {
      setReferralCode(refCode.toUpperCase());
      validateReferralCode(refCode.toUpperCase());
    }
  }, [searchParams]);

  // Remove automatic redirect to dashboard since EmailVerificationWrapper will handle it

  const validateReferralCode = async (code: string) => {
    if (!code.trim()) {
      setReferralValid(null);
      return;
    }
    const { data } = await supabase.from("profiles").select("user_id").eq("referral_code", code.toUpperCase()).single();
    setReferralValid(!!data);
  };

  const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    try {
      emailSchema.parse(signupEmail);
      nameSchema.parse(signupName);
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

    const passwordValidation = validatePassword(signupPassword);
    if (!passwordValidation.valid) {
      toast({
        title: "Пароль не соответствует требованиям",
        description: passwordValidation.errors.join(', '),
        variant: "destructive"
      });
      return;
    }

    setSignupLoading(true);
    
    const result = await signUp(
      signupEmail,
      signupPassword,
      signupRole as AppRole,
      signupName,
      undefined, // phone removed
      referralCode
    );

    if (result.success && result.requiresEmailVerification) {
      setShowEmailVerification(true);
      toast({
        title: "Подтвердите профиль",
        description: "Письмо отправлено на email",
      });
    } else if (result.error) {
      let message = "Ошибка регистрации";
      if (result.error.message.includes("email-already-in-use")) message = "Этот email уже зарегистрирован";
      else if (result.error.message.includes("weak-password")) message = "Пароль слишком слабый";
      else if (result.error.message.includes("invalid-email")) message = "Неверный формат email";
      else message = result.error.message;
      
      toast({
        title: "Ошибка регистрации",
        description: message,
        variant: "destructive"
      });
    }
    
    setSignupLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setSignupLoading(true);
    const { error } = await signUp(signupEmail, "", signupRole as AppRole, signupName);
    
    if (error) {
      toast({
        title: "Ошибка Google регистрации",
        description: error.message,
        variant: "destructive"
      });
    } else {
      const { error: googleError } = await signUp(signupEmail, "", signupRole as AppRole, signupName);
      if (googleError) {
        toast({
          title: "Ошибка",
          description: googleError.message,
          variant: "destructive"
        });
      }
    }
    
    setSignupLoading(false);
  };

  const handleEmailVerified = () => {
    setShowEmailVerification(false);
    navigate("/dashboard");
  };

  const handleEmailVerificationError = (error: string) => {
    toast({
      title: "Ошибка проверки email",
      description: error,
      variant: "destructive"
    });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (showEmailVerification) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center p-4">
        <EmailVerificationTimer
          email={signupEmail}
          onVerified={handleEmailVerified}
          onError={handleEmailVerificationError}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center p-4">
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
            <CardDescription>Создайте новый аккаунт</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">{t("profile.name")}</Label>
                <Input 
                  id="signup-name" 
                  type="text" 
                  placeholder={t("auth.namePlaceholder")} 
                  value={signupName} 
                  onChange={e => setSignupName(e.target.value)} 
                  required 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email">{t("auth.email")}</Label>
                <Input 
                  id="signup-email" 
                  type="email" 
                  placeholder="example@mail.com" 
                  value={signupEmail} 
                  onChange={e => setSignupEmail(e.target.value)} 
                  required 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">{t("auth.password")}</Label>
                <Input 
                  id="signup-password" 
                  type="password" 
                  placeholder={t("auth.passwordPlaceholder")} 
                  value={signupPassword} 
                  onChange={e => setSignupPassword(e.target.value)} 
                  required 
                />
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
                <Input 
                  id="referral-code" 
                  type="text" 
                  placeholder={t("auth.enterFriendCode")} 
                  value={referralCode} 
                  onChange={e => {
                    const code = e.target.value.toUpperCase();
                    setReferralCode(code);
                    validateReferralCode(code);
                  }} 
                  className={referralValid === true ? "border-green-500" : referralValid === false ? "border-red-500" : ""} 
                />
                {referralValid === true && <p className="text-xs text-green-600">✓ {t("auth.codeValid")}</p>}
                {referralValid === false && referralCode && <p className="text-xs text-red-600">✗ {t("auth.codeNotFound")}</p>}
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                variant={signupRole === "client" ? "customer" : "driver"} 
                size="lg" 
                disabled={signupLoading}
              >
                {signupLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("auth.registering")}
                  </>
                ) : (
                  `${t("auth.registerAs")} ${signupRole === "client" ? t("role.client") : t("role.carrier")}`
                )}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Или</span>
                </div>
              </div>

              <Button 
                type="button" 
                className="w-full" 
                variant="outline" 
                onClick={handleGoogleSignIn}
                disabled={signupLoading}
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path 
                    fill="#4285F4" 
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path 
                    fill="#34A853" 
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path 
                    fill="#FBBC05" 
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path 
                    fill="#EA4335" 
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Зарегистрироваться через Google
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Signup;
