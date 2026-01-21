import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { User, Truck, ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const emailSchema = z.string().email("Неверный формат email");
const passwordSchema = z.string().min(6, "Минимум 6 символов");
const nameSchema = z.string().min(2, "Минимум 2 символа");

type Role = "client" | "carrier";

const Auth = () => {
  const navigate = useNavigate();
  const { user, signIn, signUp, loading: authLoading } = useAuth();
  const { toast } = useToast();

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

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      navigate("/dashboard");
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      emailSchema.parse(loginEmail);
      passwordSchema.parse(loginPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Ошибка валидации",
          description: error.errors[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    setLoginLoading(true);

    const { error } = await signIn(loginEmail, loginPassword);

    if (error) {
      let message = "Произошла ошибка при входе";
      if (error.message.includes("Invalid login credentials")) {
        message = "Неверный email или пароль";
      } else if (error.message.includes("Email not confirmed")) {
        message = "Email не подтверждён";
      }
      toast({
        title: "Ошибка входа",
        description: message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Добро пожаловать!",
        description: "Вы успешно вошли в систему",
      });
      navigate("/dashboard");
    }

    setLoginLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      emailSchema.parse(signupEmail);
      passwordSchema.parse(signupPassword);
      nameSchema.parse(signupName);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Ошибка валидации",
          description: error.errors[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    setSignupLoading(true);

    const { error } = await signUp(signupEmail, signupPassword, signupRole, signupName);

    if (error) {
      let message = "Произошла ошибка при регистрации";
      if (error.message.includes("already registered")) {
        message = "Этот email уже зарегистрирован";
      }
      toast({
        title: "Ошибка регистрации",
        description: message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Регистрация успешна!",
        description: "Добро пожаловать в LogiFlow",
      });
      navigate("/dashboard");
    }

    setSignupLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center p-4">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-customer/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-driver/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Back button */}
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          На главную
        </Button>

        <Card className="border-2">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">LogiFlow</CardTitle>
            <CardDescription>
              Платформа для грузоперевозок
            </CardDescription>
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
                    <Label htmlFor="login-password">Пароль</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    variant="hero"
                    size="lg"
                    disabled={loginLoading}
                  >
                    {loginLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Вход...
                      </>
                    ) : (
                      "Войти"
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* Signup Form */}
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Имя</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Иван Иванов"
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
                      placeholder="Минимум 6 символов"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                    />
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
                          signupRole === "client"
                            ? "border-customer bg-customer-light"
                            : "border-border hover:border-customer/50"
                        }`}
                      >
                        <RadioGroupItem
                          value="client"
                          id="role-client"
                          className="sr-only"
                        />
                        <div className="w-12 h-12 rounded-full gradient-customer flex items-center justify-center">
                          <User className="w-6 h-6 text-white" />
                        </div>
                        <span className="font-medium">Клиент</span>
                        <span className="text-xs text-muted-foreground text-center">
                          Заказываю перевозки
                        </span>
                      </Label>

                      <Label
                        htmlFor="role-carrier"
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          signupRole === "carrier"
                            ? "border-driver bg-driver-light"
                            : "border-border hover:border-driver/50"
                        }`}
                      >
                        <RadioGroupItem
                          value="carrier"
                          id="role-carrier"
                          className="sr-only"
                        />
                        <div className="w-12 h-12 rounded-full gradient-driver flex items-center justify-center">
                          <Truck className="w-6 h-6 text-white" />
                        </div>
                        <span className="font-medium">Перевозчик</span>
                        <span className="text-xs text-muted-foreground text-center">
                          Выполняю заказы
                        </span>
                      </Label>
                    </RadioGroup>
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
                        Регистрация...
                      </>
                    ) : (
                      `Зарегистрироваться как ${signupRole === "client" ? "Клиент" : "Перевозчик"}`
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
