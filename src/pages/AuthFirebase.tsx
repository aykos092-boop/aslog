import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { User, Truck, ArrowLeft, Loader2, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BRAND } from "@/config/brand";
import { 
  signUpWithEmail, 
  signInWithEmail, 
  validateEmail, 
  validatePassword,
  AppRole,
  requestPasswordReset,
} from "@/services/firebaseAuthService";
import { EmailOTPInputFirebase } from "@/components/auth/EmailOTPInputFirebase";
import { GoogleSignInButtonFirebase } from "@/components/auth/GoogleSignInButtonFirebase";

type Role = "client" | "carrier";

const AuthFirebase = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useFirebaseAuth();
  const { toast } = useToast();

  // View state
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [signupStep, setSignupStep] = useState<'info' | 'email-verify'>('info');

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Signup state
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupRole, setSignupRole] = useState<Role>("client");
  const [signupLoading, setSignupLoading] = useState(false);

  // Password reset state
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (user && !authLoading) {
      navigate("/dashboard");
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(loginEmail)) {
      toast({
        title: "Ошибка",
        description: "Неверный формат email",
        variant: "destructive"
      });
      return;
    }

    setLoginLoading(true);
    const result = await signInWithEmail(loginEmail, loginPassword);

    if (result.success) {
      toast({
        title: "Добро пожаловать!",
        description: "Вход выполнен успешно",
      });
      navigate("/dashboard");
    } else {
      toast({
        title: "Ошибка входа",
        description: result.error,
        variant: "destructive"
      });
    }

    setLoginLoading(false);
  };

  const handleSignupContinue = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate inputs
    if (!validateEmail(signupEmail)) {
      toast({
        title: "Ошибка",
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
        title: "Ошибка",
        description: "Имя должно содержать минимум 2 символа",
        variant: "destructive"
      });
      return;
    }

    // Start signup
    setSignupLoading(true);
    const result = await signUpWithEmail({
      email: signupEmail,
      password: signupPassword,
      fullName: signupName,
      role: signupRole as AppRole,
    });

    if (result.success) {
      setSignupStep('email-verify');
      toast({
        title: "Проверьте email",
        description: `Мы отправили письмо на ${signupEmail}`,
      });
    } else {
      toast({
        title: "Ошибка регистрации",
        description: result.error,
        variant: "destructive"
      });
    }

    setSignupLoading(false);
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(resetEmail)) {
      toast({
        title: "Ошибка",
        description: "Неверный формат email",
        variant: "destructive"
      });
      return;
    }

    setResetLoading(true);
    const result = await requestPasswordReset(resetEmail);

    if (result.success) {
      toast({
        title: "✅ Письмо отправлено",
        description: `Проверьте почту ${resetEmail}`,
      });
      setShowPasswordReset(false);
    } else {
      toast({
        title: "Ошибка",
        description: result.error,
        variant: "destructive"
      });
    }

    setResetLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (showPasswordReset) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPasswordReset(false)}
              className="w-fit -ml-2 mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
            <CardTitle>Восстановление пароля</CardTitle>
            <CardDescription>Введите email для восстановления пароля</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="example@mail.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={resetLoading}>
                {resetLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Отправка...
                  </>
                ) : (
                  "Отправить письмо"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
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
          На главную
        </Button>

        <Card className="border-2">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">{BRAND.name}</CardTitle>
            <CardDescription>Платформа международной логистики</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Вход</TabsTrigger>
                <TabsTrigger value="signup">Регистрация</TabsTrigger>
              </TabsList>

              {/* Login Form */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="example@mail.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password">Пароль</Label>
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-xs"
                        onClick={() => setShowPasswordReset(true)}
                      >
                        Забыли пароль?
                      </Button>
                    </div>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full" variant="hero" size="lg" disabled={loginLoading}>
                    {loginLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Вход...
                      </>
                    ) : (
                      "Войти"
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

                  <GoogleSignInButtonFirebase role="client" />
                </form>
              </TabsContent>

              {/* Signup Form */}
              <TabsContent value="signup">
                {signupStep === 'email-verify' ? (
                  <div className="space-y-4">
                    <EmailOTPInputFirebase
                      email={signupEmail}
                      type="email_verification"
                      onVerified={() => {
                        toast({
                          title: "✅ Email подтверждён",
                          description: "Добро пожаловать!",
                        });
                        navigate("/dashboard");
                      }}
                    />
                    <Button variant="ghost" className="w-full" onClick={() => setSignupStep('info')}>
                      Назад
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSignupContinue} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Имя</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Ваше имя"
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="example@mail.com"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Пароль</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Минимум 8 символов"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        required
                      />
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>• Минимум 8 символов</div>
                        <div>• Заглавная и строчная буквы</div>
                        <div>• Цифра и спецсимвол</div>
                      </div>
                    </div>

                    {/* Role Selection */}
                    <div className="space-y-3">
                      <Label>Выберите роль</Label>
                      <RadioGroup
                        value={signupRole}
                        onValueChange={(value) => setSignupRole(value as Role)}
                        className="grid grid-cols-2 gap-4"
                      >
                        <Label
                          htmlFor="role-client"
                          className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            signupRole === "client" ? "border-customer bg-customer-light" : "border-border hover:border-customer/50"
                          }`}
                        >
                          <RadioGroupItem value="client" id="role-client" className="sr-only" />
                          <div className="w-12 h-12 rounded-full gradient-customer flex items-center justify-center">
                            <User className="w-6 h-6 text-white" />
                          </div>
                          <span className="font-medium">Клиент</span>
                          <span className="text-xs text-muted-foreground text-center">Заказываю доставку</span>
                        </Label>

                        <Label
                          htmlFor="role-carrier"
                          className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            signupRole === "carrier" ? "border-driver bg-driver-light" : "border-border hover:border-driver/50"
                          }`}
                        >
                          <RadioGroupItem value="carrier" id="role-carrier" className="sr-only" />
                          <div className="w-12 h-12 rounded-full gradient-driver flex items-center justify-center">
                            <Truck className="w-6 h-6 text-white" />
                          </div>
                          <span className="font-medium">Перевозчик</span>
                          <span className="text-xs text-muted-foreground text-center">Выполняю заказы</span>
                        </Label>
                      </RadioGroup>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">Или</span>
                      </div>
                    </div>

                    <GoogleSignInButtonFirebase role={signupRole as AppRole} />

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
                          Регистрация...
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4 mr-2" />
                          Зарегистрироваться
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthFirebase;
