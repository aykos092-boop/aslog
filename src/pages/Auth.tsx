import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, Eye, EyeOff, Loader2, ArrowLeft, User, Truck, Smartphone } from "lucide-react";

// ВНИМАНИЕ: Проверь наличие этих файлов! Если их нет, проект выдаст ошибку Build Error.
import { useFirebaseAuth } from "@/contexts/useFirebaseAuth";
import { BRAND } from "@/constants/brand";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type AuthView = "login" | "signup" | "reset" | "phone-verify";
type Role = "client" | "carrier";

const AuthPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    sendPhoneCode,
    verifyPhoneCode,
    sendPasswordReset,
    user,
    loading: authLoading,
  } = useFirebaseAuth();

  // Состояния
  const [authView, setAuthView] = useState<AuthView>("login");
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("client");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  // Фикс мерцания: редирект только когда загрузка окончена и юзер есть
  useEffect(() => {
    if (user && !authLoading) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, authLoading, navigate]);

  // --- ЛОГИКА ---

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const { error } = await signInWithEmail(email.trim(), password);
    if (error) {
      toast({
        title: "Ошибка данных",
        description: "Неверный логин или пароль. Проверьте правильность ввода.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const { error, confirmationResult: result } = await sendPhoneCode(phone, "recaptcha-container");
    if (error) {
      toast({ title: "Ошибка", description: "Не удалось отправить СМС", variant: "destructive" });
      setIsSubmitting(false);
    } else {
      setConfirmationResult(result);
      setAuthView("phone-verify");
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    setIsSubmitting(true);
    const { error } = await verifyPhoneCode(confirmationResult, otp, role);
    if (error) {
      toast({ title: "Код неверный", variant: "destructive" });
      setIsSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsSubmitting(true);
    const { error } = await signInWithGoogle(role);
    if (error) {
      toast({
        title: "Ошибка домена",
        description: "Убедитесь, что домен lovable.app добавлен в Firebase Console.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  if (authLoading && !user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#0a0e14]">
        <Loader2 className="animate-spin text-blue-500 w-12 h-12" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e14] text-white flex flex-col items-center justify-center p-4 font-sans">
      <div id="recaptcha-container"></div>

      <div className="w-full max-w-[400px] space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-black text-blue-500 tracking-tighter uppercase mb-1">
            {BRAND?.name || "AsLogUz"}
          </h1>
          <p className="text-slate-500 text-sm italic">Логистика нового поколения</p>
        </div>

        <Card className="bg-[#111827] border-slate-800 shadow-2xl border-t-4 border-t-blue-600">
          <CardContent className="pt-6">
            {/* ВОССТАНОВЛЕНИЕ ПАРОЛЯ */}
            {authView === "reset" && (
              <div className="space-y-4">
                <Button variant="ghost" className="p-0 text-slate-400" onClick={() => setAuthView("login")}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Назад
                </Button>
                <div className="space-y-1">
                  <h2 className="text-xl font-bold">Сброс пароля</h2>
                  <p className="text-sm text-slate-400">Ссылка придет на вашу почту</p>
                </div>
                <Input
                  className="bg-slate-900 border-slate-700"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Button className="w-full bg-blue-600" onClick={() => sendPasswordReset(email)} disabled={isSubmitting}>
                  Отправить ссылку
                </Button>
              </div>
            )}

            {/* ВЕРИФИКАЦИЯ СМС */}
            {authView === "phone-verify" && (
              <div className="space-y-6 text-center">
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-blue-400 text-center">Введите код</h2>
                  <p className="text-sm text-slate-400">Код отправлен на {phone}</p>
                </div>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup className="gap-2">
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <InputOTPSlot key={i} index={i} className="bg-slate-900 border-slate-700 w-12 h-12 text-xl" />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button
                  className="w-full bg-blue-600 h-12"
                  onClick={handleVerifyOtp}
                  disabled={isSubmitting || otp.length < 6}
                >
                  Подтвердить вход
                </Button>
              </div>
            )}

            {/* ВХОД И РЕГИСТРАЦИЯ */}
            {(authView === "login" || authView === "signup") && (
              <Tabs value={authView} onValueChange={(v) => setAuthView(v as AuthView)}>
                <TabsList className="grid w-full grid-cols-2 bg-slate-950 mb-6 p-1 h-12">
                  <TabsTrigger value="login" className="data-[state=active]:bg-blue-600">
                    Вход
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="data-[state=active]:bg-blue-600">
                    Регистрация
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="space-y-4">
                  <div className="flex bg-slate-950 p-1 rounded-lg gap-1 mb-4 border border-slate-800">
                    <Button
                      variant={authMethod === "email" ? "secondary" : "ghost"}
                      className="flex-1 h-8 text-xs"
                      onClick={() => setAuthMethod("email")}
                    >
                      <Mail className="w-3 h-3 mr-2" /> Email
                    </Button>
                    <Button
                      variant={authMethod === "phone" ? "secondary" : "ghost"}
                      className="flex-1 h-8 text-xs"
                      onClick={() => setAuthMethod("phone")}
                    >
                      <Smartphone className="w-3 h-3 mr-2" /> Телефон
                    </Button>
                  </div>

                  {authMethod === "email" ? (
                    <form onSubmit={handleEmailLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          className="bg-slate-900 border-slate-700"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label>Пароль</Label>
                          <button
                            type="button"
                            onClick={() => setAuthView("reset")}
                            className="text-xs text-blue-500 hover:underline"
                          >
                            Забыли?
                          </button>
                        </div>
                        <div className="relative">
                          <Input
                            className="bg-slate-900 border-slate-700 pr-10"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-3 text-slate-500"
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                      <Button type="submit" className="w-full bg-blue-600 h-11 font-bold" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin" /> : "Войти в аккаунт"}
                      </Button>
                    </form>
                  ) : (
                    <form onSubmit={handlePhoneSubmit} className="space-y-4">
                      <Label>Ваш номер телефона</Label>
                      <Input
                        className="bg-slate-900 border-slate-700"
                        placeholder="+998 90 123 45 67"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                      />
                      <Button type="submit" className="w-full bg-blue-600" disabled={isSubmitting}>
                        Отправить код
                      </Button>
                    </form>
                  )}
                </TabsContent>

                <TabsContent value="signup" className="space-y-4">
                  <Input
                    className="bg-slate-900 border-slate-700"
                    placeholder="Полное имя"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <Input
                    className="bg-slate-900 border-slate-700"
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <Input
                    className="bg-slate-900 border-slate-700"
                    type="password"
                    placeholder="Пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />

                  <div className="pt-2">
                    <Label className="text-xs text-slate-500 mb-2 block uppercase">Выберите роль:</Label>
                    <RadioGroup
                      value={role}
                      onValueChange={(v) => setRole(v as Role)}
                      className="grid grid-cols-2 gap-3"
                    >
                      <div className="relative">
                        <RadioGroupItem value="client" id="r-client" className="peer sr-only" />
                        <Label
                          htmlFor="r-client"
                          className="flex flex-col items-center p-3 border-2 border-slate-800 rounded-xl cursor-pointer peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:bg-blue-500/5"
                        >
                          <User className="w-5 h-5 mb-1 text-slate-400" />{" "}
                          <span className="text-[10px] font-bold">КЛИЕНТ</span>
                        </Label>
                      </div>
                      <div className="relative">
                        <RadioGroupItem value="carrier" id="r-carrier" className="peer sr-only" />
                        <Label
                          htmlFor="r-carrier"
                          className="flex flex-col items-center p-3 border-2 border-slate-800 rounded-xl cursor-pointer peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:bg-blue-500/5"
                        >
                          <Truck className="w-5 h-5 mb-1 text-slate-400" />{" "}
                          <span className="text-[10px] font-bold">ВОДИТЕЛЬ</span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <Button
                    className="w-full bg-blue-600 h-11 font-bold"
                    onClick={() => signUpWithEmail(email, password, role, name)}
                    disabled={isSubmitting}
                  >
                    Зарегистрироваться
                  </Button>
                </TabsContent>
              </Tabs>
            )}

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-800"></span>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-500">
                <span className="bg-[#111827] px-4 italic">Быстрый вход</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full border-slate-700 hover:bg-slate-800 h-11 text-sm transition-all"
              onClick={handleGoogleAuth}
              disabled={isSubmitting}
            >
              <svg className="w-4 h-4 mr-3" viewBox="0 0 24 24">
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
                  d="M12 5.04c1.64 0 3.1.56 4.26 1.67l3.18-3.18C17.47 1.63 14.94 1 12 1 7.73 1 4.05 3.43 2.18 7l3.66 2.84C6.71 7.25 9.14 5.04 12 5.04z"
                />
              </svg>
              Продолжить через Google
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthPage;
