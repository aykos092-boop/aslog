import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { User, Truck, ArrowLeft, Loader2, Gift, Phone, Mail, KeyRound, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/config/brand";
import { ConfirmationResult } from "@/lib/firebase";

type Role = "client" | "carrier";
type AuthMethod = "email" | "phone";
type AuthView = "login" | "signup" | "reset" | "phone-verify";

const AuthPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    user,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    sendPhoneCode,
    verifyPhoneCode,
    sendPasswordReset,
    loading: authLoading,
  } = useFirebaseAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const emailSchema = z.string().email(t("auth.invalidEmail"));
  const passwordSchema = z.string().min(6, `${t("auth.minChars")} 6 ${t("auth.chars")}`);
  const nameSchema = z.string().min(2, `${t("auth.minChars")} 2 ${t("auth.chars")}`); // View state

  const [authView, setAuthView] = useState<AuthView>("login");
  const [authMethod, setAuthMethod] = useState<AuthMethod>("email"); // Login state

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // Signup state

  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupRole, setSignupRole] = useState<Role>("client");
  const [signupLoading, setSignupLoading] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [referralValid, setReferralValid] = useState<boolean | null>(null); // Phone verification state

  const [phoneOtp, setPhoneOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [phoneVerifyLoading, setPhoneVerifyLoading] = useState(false);
  const [pendingRole, setPendingRole] = useState<Role>("client"); // Password reset state

  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

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
    const { data } = await supabase.from("profiles").select("user_id").eq("referral_code", code.toUpperCase()).single();
    setReferralValid(!!data);
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.startsWith("998")) {
      const rest = digits.slice(3);
      let formatted = "+998";
      if (rest.length > 0) formatted += " " + rest.slice(0, 2);
      if (rest.length > 2) formatted += " " + rest.slice(2, 5);
      if (rest.length > 5) formatted += " " + rest.slice(5, 7);
      if (rest.length > 7) formatted += " " + rest.slice(7, 9);
      return formatted;
    }
    if (!digits.startsWith("998") && digits.length > 0) {
      return "+998 " + digits.slice(0, 9);
    }
    return value;
  };

  const getFirebaseErrorMessage = (code: string) => {
    const errors: Record<string, string> = {
      "auth/user-not-found": "Пользователь не найден",
      "auth/wrong-password": "Неверный пароль",
      "auth/email-already-in-use": "Email уже используется",
      "auth/weak-password": "Слишком простой пароль",
      "auth/invalid-email": "Неверный формат email",
      "auth/too-many-requests": "Слишком много попыток. Попробуйте позже",
      "auth/invalid-verification-code": "Неверный код подтверждения",
      "auth/invalid-phone-number": "Неверный номер телефона",
      "auth/popup-closed-by-user": "Окно авторизации закрыто",
      "auth/invalid-credential": "Неверные данные для входа",
    };
    return errors[code] || "Произошла ошибка";
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(loginEmail);
      passwordSchema.parse(loginPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: t("auth.validationError"),
          description: error.errors[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    setLoginLoading(true);
    const { error } = await signInWithEmail(loginEmail, loginPassword);
    if (error) {
      toast({
        title: t("auth.loginError"),
        description: getFirebaseErrorMessage((error as any).code),
        variant: "destructive",
      });
    } else {
      toast({ title: t("auth.welcome"), description: t("auth.loginSuccess") });
      navigate("/dashboard");
    }
    setLoginLoading(false);
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const phoneDigits = loginPhone.replace(/\D/g, "");
    if (phoneDigits.length < 12) {
      toast({
        title: "Ошибка",
        description: "Введите полный номер телефона",
        variant: "destructive",
      });
      return;
    }

    setLoginLoading(true);
    setPendingRole("client");
    const { error, confirmationResult: result } = await sendPhoneCode("+" + phoneDigits, "recaptcha-container");
    if (error) {
      toast({
        title: "Ошибка",
        description: getFirebaseErrorMessage((error as any).code),
        variant: "destructive",
      });
      setLoginLoading(false);
      return;
    }

    if (result) {
      setConfirmationResult(result);
      setAuthView("phone-verify");
    }
    setLoginLoading(false);
  };

  const handleVerifyPhoneCode = async () => {
    if (!confirmationResult || phoneOtp.length !== 6) return;

    setPhoneVerifyLoading(true);
    const { error } = await verifyPhoneCode(confirmationResult, phoneOtp, pendingRole);
    if (error) {
      toast({
        title: "Ошибка",
        description: getFirebaseErrorMessage((error as any).code),
        variant: "destructive",
      });
    } else {
      toast({ title: "Успешно!", description: "Вы вошли в систему" });
      navigate("/dashboard");
    }
    setPhoneVerifyLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const { error } = await signInWithGoogle(signupRole);
    if (error) {
      toast({
        title: t("auth.loginError"),
        description: getFirebaseErrorMessage((error as any).code),
        variant: "destructive",
      });
      setGoogleLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(signupEmail);
      passwordSchema.parse(signupPassword);
      nameSchema.parse(signupName);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: t("auth.validationError"),
          description: error.errors[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    setSignupLoading(true);
    const { error } = await signUpWithEmail(signupEmail, signupPassword, signupRole, signupName);
    if (error) {
      toast({
        title: t("auth.registrationError"),
        description: getFirebaseErrorMessage((error as any).code),
        variant: "destructive",
      });
      setSignupLoading(false);
      return;
    }

    toast({
      title: t("auth.registrationSuccess"),
      description: t("auth.welcomeToPlatform"),
    });
    navigate("/dashboard");
    setSignupLoading(false);
  };

  const handlePhoneSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const phoneDigits = signupPhone.replace(/\D/g, "");
    if (phoneDigits.length < 12) {
      toast({
        title: "Ошибка",
        description: "Введите полный номер телефона",
        variant: "destructive",
      });
      return;
    }

    setSignupLoading(true);
    setPendingRole(signupRole);
    try {
      const { error, confirmationResult: result } = await sendPhoneCode("+" + phoneDigits, "recaptcha-container");
      if (error) {
        console.error("Phone signup error:", error);
        const errorCode = (error as any).code || "";
        let errorMessage = getFirebaseErrorMessage(errorCode); // More specific error messages
        if (errorCode === "auth/invalid-app-credential" || errorCode === "auth/operation-not-allowed") {
          errorMessage = "Телефонная аутентификация не настроена. Используйте Email или Google.";
        } else if (errorCode === "auth/captcha-check-failed") {
          errorMessage = "Ошибка проверки reCAPTCHA. Попробуйте снова.";
        } else if (errorCode === "auth/quota-exceeded") {
          errorMessage = "Превышен лимит SMS. Попробуйте позже.";
        }
        toast({
          title: "Ошибка отправки кода",
          description: errorMessage,
          variant: "destructive",
        });
        setSignupLoading(false);
        return;
      }

      if (result) {
        setConfirmationResult(result);
        setAuthView("phone-verify");
        toast({
          title: "Код отправлен",
          description: "Введите код из SMS",
        });
      }
    } catch (err: any) {
      console.error("Phone signup exception:", err);
      toast({
        title: "Ошибка",
        description: "Телефонная аутентификация недоступна. Используйте Email или Google.",
        variant: "destructive",
      });
    }
    setSignupLoading(false);
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(resetEmail);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: t("auth.validationError"),
          description: error.errors[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    setResetLoading(true);
    const { error } = await sendPasswordReset(resetEmail);
    if (error) {
      toast({
        title: "Ошибка",
        description: getFirebaseErrorMessage((error as any).code),
        variant: "destructive",
      });
    } else {
      setResetSent(true);
      toast({
        title: "Письмо отправлено!",
        description: "Проверьте почту для восстановления пароля",
      });
    }
    setResetLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />     {" "}
      </div>
    );
  } // Password Reset View

  if (authView === "reset") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center p-4">
               {" "}
        <div className="w-full max-w-md">
                   {" "}
          <Button variant="ghost" className="mb-4" onClick={() => setAuthView("login")}>
                        <ArrowLeft className="w-4 h-4 mr-2" />            Назад          {" "}
          </Button>
                   {" "}
          <Card className="border-2">
                       {" "}
            <CardHeader className="text-center">
                           {" "}
              <CardTitle className="flex items-center justify-center gap-2">
                                <KeyRound className="w-5 h-5" />                Восстановление пароля              {" "}
              </CardTitle>
                           {" "}
              <CardDescription>
                                Введите email для получения ссылки восстановления              {" "}
              </CardDescription>
                         {" "}
            </CardHeader>
                       {" "}
            <CardContent>
                           {" "}
              {resetSent ? (
                <div className="text-center space-y-4">
                                   {" "}
                  <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                        <Mail className="w-8 h-8 text-green-600 dark:text-green-400" />               
                     {" "}
                  </div>
                                   {" "}
                  <p className="text-sm text-muted-foreground">
                                        Письмо отправлено на <strong>{resetEmail}</strong>.                     
                    Проверьте почту и следуйте инструкциям.                  {" "}
                  </p>
                                   {" "}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setResetSent(false);
                      setAuthView("login");
                    }}
                  >
                                        Вернуться к входу                  {" "}
                  </Button>
                                 {" "}
                </div>
              ) : (
                <form onSubmit={handlePasswordReset} className="space-y-4">
                                   {" "}
                  <div className="space-y-2">
                                        <Label htmlFor="reset-email">Email</Label>
                                       {" "}
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="example@mail.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                    />
                                     {" "}
                  </div>
                                   {" "}
                  <Button type="submit" className="w-full" disabled={resetLoading}>
                                       {" "}
                    {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Отправить ссылку"}               
                     {" "}
                  </Button>
                                 {" "}
                </form>
              )}
                         {" "}
            </CardContent>
                     {" "}
          </Card>
                 {" "}
        </div>
             {" "}
      </div>
    );
  } // Phone Verification View

  if (authView === "phone-verify") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center p-4">
                <div id="recaptcha-container"></div>       {" "}
        <div className="w-full max-w-md">
                   {" "}
          <Button
            variant="ghost"
            className="mb-4"
            onClick={() => {
              setAuthView("login");
              setPhoneOtp("");
            }}
          >
                        <ArrowLeft className="w-4 h-4 mr-2" />            Назад          {" "}
          </Button>
                   {" "}
          <Card className="border-2">
                       {" "}
            <CardHeader className="text-center">
                           {" "}
              <CardTitle className="flex items-center justify-center gap-2">
                                <Phone className="w-5 h-5" />                Подтверждение номера              {" "}
              </CardTitle>
                           {" "}
              <CardDescription>                Введите 6-значный код из SMS               </CardDescription>         
               {" "}
            </CardHeader>
                       {" "}
            <CardContent className="space-y-6">
                           {" "}
              <div className="flex justify-center">
                               {" "}
                <InputOTP maxLength={6} value={phoneOtp} onChange={setPhoneOtp}>
                                   {" "}
                  <InputOTPGroup>
                                        <InputOTPSlot index={0} />
                                        <InputOTPSlot index={1} />
                                        <InputOTPSlot index={2} />
                                        <InputOTPSlot index={3} />
                                        <InputOTPSlot index={4} />
                                        <InputOTPSlot index={5} />                 {" "}
                  </InputOTPGroup>
                                 {" "}
                </InputOTP>
                             {" "}
              </div>
                                          {" "}
              <Button
                className="w-full"
                onClick={handleVerifyPhoneCode}
                disabled={phoneOtp.length !== 6 || phoneVerifyLoading}
              >
                                {phoneVerifyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Подтвердить"}     
                       {" "}
              </Button>
                         {" "}
            </CardContent>
                     {" "}
          </Card>
                 {" "}
        </div>
             {" "}
      </div>
    );
  } // Google Icon Component

  const GoogleIcon = () => (
    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
           {" "}
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
           {" "}
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
           {" "}
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
           {" "}
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
         {" "}
    </svg>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center p-4">
            {/* Recaptcha container - must be present */}      <div id="recaptcha-container"></div>     {" "}
      {/* Background decorations */}     {" "}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />     {" "}
      </div>
           {" "}
      <div className="relative w-full max-w-md">
               {" "}
        <Button variant="ghost" className="mb-4" onClick={() => navigate("/")}>
                    <ArrowLeft className="w-4 h-4 mr-2" />          {t("auth.backToHome")}       {" "}
        </Button>
               {" "}
        <Card className="border-2">
                   {" "}
          <CardHeader className="text-center">
                        <CardTitle className="text-2xl font-bold">{BRAND.name}</CardTitle>           {" "}
            <CardDescription>{t("auth.platformDesc")}</CardDescription>         {" "}
          </CardHeader>
                   {" "}
          <CardContent>
                       {" "}
            <Tabs defaultValue="login" className="w-full">
                           {" "}
              <TabsList className="grid w-full grid-cols-2 mb-6">
                                <TabsTrigger value="login">{t("auth.loginTab")}</TabsTrigger>               {" "}
                <TabsTrigger value="signup">{t("auth.registerTab")}</TabsTrigger>             {" "}
              </TabsList>
                            {/* Login Form */}             {" "}
              <TabsContent value="login">
                                {/* Auth Method Toggle */}               {" "}
                <div className="flex rounded-lg border p-1 gap-1 mb-4">
                                   {" "}
                  <Button
                    type="button"
                    variant={authMethod === "email" ? "default" : "ghost"}
                    className="flex-1"
                    size="sm"
                    onClick={() => setAuthMethod("email")}
                  >
                                        <Mail className="w-4 h-4 mr-2" />                    Email                
                     {" "}
                  </Button>
                                   {" "}
                  <Button
                    type="button"
                    variant={authMethod === "phone" ? "default" : "ghost"}
                    className="flex-1"
                    size="sm"
                    onClick={() => setAuthMethod("phone")}
                  >
                                        <Phone className="w-4 h-4 mr-2" />                    Телефон                
                     {" "}
                  </Button>
                                 {" "}
                </div>
                               {" "}
                {authMethod === "email" ? (
                  <form onSubmit={handleEmailLogin} className="space-y-4">
                                       {" "}
                    <div className="space-y-2">
                                            <Label htmlFor="login-email">{t("auth.email")}</Label>
                                           {" "}
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="example@mail.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                      />
                                         {" "}
                    </div>
                                       {" "}
                    <div className="space-y-2">
                                           {" "}
                      <div className="flex items-center justify-between">
                                                <Label htmlFor="login-password">{t("auth.password")}</Label>           
                                   {" "}
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0 text-xs"
                          onClick={() => setAuthView("reset")}
                        >
                                                    <KeyRound className="w-3 h-3 mr-1" />                         
                          Забыли пароль?                        {" "}
                        </Button>
                                             {" "}
                      </div>
                                           {" "}
                      <div className="relative">
                                               {" "}
                        <Input
                          id="login-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          required
                        />
                                               {" "}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                                                   {" "}
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}                 
                               {" "}
                        </Button>
                                             {" "}
                      </div>
                                         {" "}
                    </div>
                                       {" "}
                    <Button type="submit" className="w-full" size="lg" disabled={loginLoading}>
                                           {" "}
                      {loginLoading ? (
                        <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />                   
                                {t("auth.loggingIn")}                       {" "}
                        </>
                      ) : (
                        t("auth.login")
                      )}
                                         {" "}
                    </Button>
                                     {" "}
                  </form>
                ) : (
                  <form onSubmit={handlePhoneLogin} className="space-y-4">
                                       {" "}
                    <div className="space-y-2">
                                            <Label htmlFor="login-phone">Телефон</Label>
                                           {" "}
                      <Input
                        id="login-phone"
                        type="tel"
                        placeholder="+998 90 123 45 67"
                        value={loginPhone}
                        onChange={(e) => setLoginPhone(formatPhone(e.target.value))}
                        required
                      />
                                         {" "}
                    </div>
                                       {" "}
                    <Button type="submit" className="w-full" size="lg" disabled={loginLoading}>
                                           {" "}
                      {loginLoading ? (
                        <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />                   
                                Отправка кода...                        {" "}
                        </>
                      ) : (
                        <>
                                                    <Phone className="w-4 h-4 mr-2" />                          Получить
                          код                        {" "}
                        </>
                      )}
                                         {" "}
                    </Button>
                                     {" "}
                  </form>
                )}
                                {/* Divider */}               {" "}
                <div className="relative my-6">
                                   {" "}
                  <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t" />                 {" "}
                  </div>
                                   {" "}
                  <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-card px-2 text-muted-foreground">или</span>               
                     {" "}
                  </div>
                                 {" "}
                </div>
                                {/* Google Sign In */}               {" "}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  size="lg"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                >
                                    {googleLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <GoogleIcon />}
                                    Войти через Google                {" "}
                </Button>
                             {" "}
              </TabsContent>
                            {/* Signup Form */}             {" "}
              <TabsContent value="signup">
                                {/* Auth Method Toggle */}               {" "}
                <div className="flex rounded-lg border p-1 gap-1 mb-4">
                                   {" "}
                  <Button
                    type="button"
                    variant={authMethod === "email" ? "default" : "ghost"}
                    className="flex-1"
                    size="sm"
                    onClick={() => setAuthMethod("email")}
                  >
                                        <Mail className="w-4 h-4 mr-2" />                    Email                
                     {" "}
                  </Button>
                                   {" "}
                  <Button
                    type="button"
                    variant={authMethod === "phone" ? "default" : "ghost"}
                    className="flex-1"
                    size="sm"
                    onClick={() => setAuthMethod("phone")}
                  >
                                        <Phone className="w-4 h-4 mr-2" />                    Телефон                
                     {" "}
                  </Button>
                                 {" "}
                </div>
                               {" "}
                {authMethod === "email" ? (
                  <form onSubmit={handleEmailSignup} className="space-y-4">
                                       {" "}
                    <div className="space-y-2">
                                            <Label htmlFor="signup-name">{t("profile.name")}</Label>
                                           {" "}
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder={t("auth.namePlaceholder")}
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        required
                      />
                                         {" "}
                    </div>
                                       {" "}
                    <div className="space-y-2">
                                            <Label htmlFor="signup-email">{t("auth.email")}</Label>
                                           {" "}
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="example@mail.com"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        required
                      />
                                         {" "}
                    </div>
                                       {" "}
                    <div className="space-y-2">
                                            <Label htmlFor="signup-password">{t("auth.password")}</Label>               
                           {" "}
                      <div className="relative">
                                               {" "}
                        <Input
                          id="signup-password"
                          type={showPassword ? "text" : "password"}
                          placeholder={t("auth.passwordPlaceholder")}
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          required
                        />
                                               {" "}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                                                   {" "}
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}                 
                               {" "}
                        </Button>
                                             {" "}
                      </div>
                                         {" "}
                    </div>
                                        {/* Role Selection */}                   {" "}
                    <div className="space-y-3">
                                            <Label>{t("auth.selectRole")}</Label>                     {" "}
                      <RadioGroup
                        value={signupRole}
                        onValueChange={(value) => setSignupRole(value as Role)}
                        className="grid grid-cols-2 gap-4"
                      >
                                               {" "}
                        <Label
                          htmlFor="role-client"
                          className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            signupRole === "client"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                                                   {" "}
                          <RadioGroupItem value="client" id="role-client" className="sr-only" />                       
                           {" "}
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                                        <User className="w-6 h-6 text-primary" />                       
                             {" "}
                          </div>
                                                    <span className="font-medium">{t("role.client")}</span>             
                                     {" "}
                          <span className="text-xs text-muted-foreground text-center">
                                                        {t("auth.iOrderDelivery")}                         {" "}
                          </span>
                                                 {" "}
                        </Label>
                                               {" "}
                        <Label
                          htmlFor="role-carrier"
                          className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            signupRole === "carrier"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                                                   {" "}
                          <RadioGroupItem value="carrier" id="role-carrier" className="sr-only" />                     
                             {" "}
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                                        <Truck className="w-6 h-6 text-primary" />                     
                               {" "}
                          </div>
                                                    <span className="font-medium">{t("role.carrier")}</span>           
                                       {" "}
                          <span className="text-xs text-muted-foreground text-center">
                                                        {t("auth.iExecuteOrders")}                         {" "}
                          </span>
                                                 {" "}
                        </Label>
                                             {" "}
                      </RadioGroup>
                                         {" "}
                    </div>
                                        {/* Referral Code */}                   {" "}
                    <div className="space-y-2">
                                           {" "}
                      <Label htmlFor="referral-code" className="flex items-center gap-2">
                                                <Gift className="w-4 h-4" />                       {" "}
                        {t("auth.referralCode")}                     {" "}
                      </Label>
                                           {" "}
                      <Input
                        id="referral-code"
                        type="text"
                        placeholder={t("auth.enterFriendCode")}
                        value={referralCode}
                        onChange={(e) => {
                          const code = e.target.value.toUpperCase();
                          setReferralCode(code);
                          validateReferralCode(code);
                        }}
                        className={
                          referralValid === true ? "border-green-500" : referralValid === false ? "border-red-500" : ""
                        }
                      />
                                           {" "}
                      {referralValid === true && <p className="text-xs text-green-600">✓ {t("auth.codeValid")}</p>}     
                                     {" "}
                      {referralValid === false && referralCode && (
                        <p className="text-xs text-red-600">✗ {t("auth.codeNotFound")}</p>
                      )}
                                         {" "}
                    </div>
                                       {" "}
                    <Button type="submit" className="w-full" size="lg" disabled={signupLoading}>
                                           {" "}
                      {signupLoading ? (
                        <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />                   
                                {t("auth.registering")}                       {" "}
                        </>
                      ) : (
                        `${t("auth.registerAs")} ${signupRole === "client" ? t("role.client") : t("role.carrier")}`
                      )}
                                         {" "}
                    </Button>
                                     {" "}
                  </form>
                ) : (
                  <form onSubmit={handlePhoneSignup} className="space-y-4">
                                       {" "}
                    <div className="space-y-2">
                                            <Label htmlFor="signup-phone">Телефон</Label>
                                           {" "}
                      <Input
                        id="signup-phone"
                        type="tel"
                        placeholder="+998 90 123 45 67"
                        value={signupPhone}
                        onChange={(e) => setSignupPhone(formatPhone(e.target.value))}
                        required
                      />
                                         {" "}
                    </div>
                                        {/* Role Selection */}                   {" "}
                    <div className="space-y-3">
                                            <Label>{t("auth.selectRole")}</Label>                     {" "}
                      <RadioGroup
                        value={signupRole}
                        onValueChange={(value) => setSignupRole(value as Role)}
                        className="grid grid-cols-2 gap-4"
                      >
                                               {" "}
                        <Label
                          htmlFor="role-client-phone"
                          className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            signupRole === "client"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                                                   {" "}
                          <RadioGroupItem value="client" id="role-client-phone" className="sr-only" />                 
                                 {" "}
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                                        <User className="w-6 h-6 text-primary" />                       
                             {" "}
                          </div>
                                                    <span className="font-medium">{t("role.client")}</span>             
                                   {" "}
                        </Label>
                                               {" "}
                        <Label
                          htmlFor="role-carrier-phone"
                          className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            signupRole === "carrier"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                                                   {" "}
                          <RadioGroupItem value="carrier" id="role-carrier-phone" className="sr-only" />               
                                   {" "}
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                                        <Truck className="w-6 h-6 text-primary" />                     
                               {" "}
                          </div>
                                                    <span className="font-medium">{t("role.carrier")}</span>           
                                     {" "}
                        </Label>
                                             {" "}
                      </RadioGroup>
                                         {" "}
                    </div>
                                       {" "}
                    <Button type="submit" className="w-full" size="lg" disabled={signupLoading}>
                                           {" "}
                      {signupLoading ? (
                        <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />                   
                                Отправка кода...                        {" "}
                        </>
                      ) : (
                        <>
                                                    <Phone className="w-4 h-4 mr-2" />                          Получить
                          код                        {" "}
                        </>
                      )}
                                         {" "}
                    </Button>
                                     {" "}
                  </form>
                )}
                                {/* Divider */}               {" "}
                <div className="relative my-6">
                                   {" "}
                  <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t" />                 {" "}
                  </div>
                                   {" "}
                  <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-card px-2 text-muted-foreground">или</span>               
                     {" "}
                  </div>
                                 {" "}
                </div>
                                {/* Google Sign Up */}               {" "}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  size="lg"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                >
                                    {googleLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <GoogleIcon />}
                                    Зарегистрироваться через Google                {" "}
                </Button>
                             {" "}
              </TabsContent>
                         {" "}
            </Tabs>
                     {" "}
          </CardContent>
                 {" "}
        </Card>
             {" "}
      </div>
         {" "}
    </div>
  );
};

export default AuthPage;
