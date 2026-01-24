import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { BRAND } from "@/config/brand";
import { z } from "zod";
import { Mail, Phone, KeyRound, Eye, EyeOff, Loader2, ArrowLeft, User, Truck, Gift } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const emailSchema = z.string().email("Неверный формат почты");
const passwordSchema = z.string().min(6, "Пароль минимум 6 символов");
const nameSchema = z.string().min(2, "Имя слишком короткое");

type AuthView = "login" | "signup" | "reset" | "phone-verify";
type Role = "client" | "carrier";

const AuthPage = () => {
  // Removed useTranslation - using direct text
  const { toast } = useToast();
  const navigate = useNavigate();
  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    sendPhoneCode,
    verifyPhoneCode,
    sendPasswordReset,
    loading: authLoading,
  } = useFirebaseAuth();

  const [authView, setAuthView] = useState<AuthView>("login");
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");
  const [showPassword, setShowPassword] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupRole, setSignupRole] = useState<Role>("client");

  const [loginPhone, setLoginPhone] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  const [isLoading, setIsLoading] = useState(false);

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, "");
    return digits ? "+" + digits.slice(0, 12) : "";
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signInWithEmail(loginEmail, loginPassword);
    if (error) {
      toast({
        title: "Ошибка входа",
        description: error.message || "Проверьте данные",
        variant: "destructive",
      });
    } else {
      navigate("/dashboard");
    }
    setIsLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const { error } = await signInWithGoogle(signupRole);
    if (error) {
      toast({ title: "Ошибка Google", description: error.message, variant: "destructive" });
    } else {
      navigate("/dashboard");
    }
    setIsLoading(false);
  };

  if (authLoading)
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-950">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );

  return (
    <div className="min-h-screen bg-[#0a0e14] text-white flex flex-col items-center justify-center p-4">
      <div id="recaptcha-container"></div>

      <div className="w-full max-w-[440px] space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">{BRAND.name}</h1>
          <p className="text-slate-400">Платформа для грузоперевозок</p>
        </div>

        <Card className="bg-[#111827] border-slate-800 shadow-2xl">
          <CardContent className="pt-6">
            <Tabs value={authView} onValueChange={(v) => setAuthView(v as AuthView)}>
              <TabsList className="grid w-full grid-cols-2 bg-slate-900 mb-6">
                <TabsTrigger value="login">Вход</TabsTrigger>
                <TabsTrigger value="signup">Регистрация</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-4">
                <div className="flex bg-slate-900 p-1 rounded-lg gap-1">
                  <Button
                    variant={authMethod === "email" ? "default" : "ghost"}
                    className="flex-1"
                    onClick={() => setAuthMethod("email")}
                  >
                    <Mail className="w-4 h-4 mr-2" /> Email
                  </Button>
                  <Button
                    variant={authMethod === "phone" ? "default" : "ghost"}
                    className="flex-1"
                    onClick={() => setAuthMethod("phone")}
                  >
                    <Phone className="w-4 h-4 mr-2" /> Телефон
                  </Button>
                </div>

                {authMethod === "email" ? (
                  <form onSubmit={handleEmailLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Email</Label>
                      <Input
                        className="bg-slate-900 border-slate-700"
                        placeholder="example@mail.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="text-slate-300">Пароль</Label>
                        <button type="button" className="text-xs text-blue-400 hover:underline">
                          Забыли пароль?
                        </button>
                      </div>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          className="bg-slate-900 border-slate-700 pr-10"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                      {isLoading ? <Loader2 className="animate-spin" /> : "Войти"}
                    </Button>
                  </form>
                ) : (
                  <div className="text-center py-4 text-slate-400 text-sm">Вход по номеру в разработке...</div>
                )}
              </TabsContent>

              {/* Секция регистрации (аналогично) */}
              <TabsContent value="signup">
                <p className="text-center text-slate-400 py-10">Выберите роль и способ регистрации выше</p>
              </TabsContent>
            </Tabs>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-800"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#111827] px-2 text-slate-500">или</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full border-slate-700 bg-transparent hover:bg-slate-800"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              {!isLoading && (
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5.04c1.64 0 3.1.56 4.26 1.67l3.18-3.18C17.47 1.63 14.94 1 12 1 7.73 1 4.05 3.43 2.18 7l3.66 2.84C6.71 7.25 9.14 5.04 12 5.04z"
                  />
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                </svg>
              )}
              {isLoading ? <Loader2 className="animate-spin" /> : "Войти через Google"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthPage;
