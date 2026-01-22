import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  User, Truck, ArrowLeft, ArrowRight, Loader2, 
  Mail, Building, Globe, CheckCircle, Shield
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const emailSchema = z.string().email("Неверный формат email");
const passwordSchema = z.string().min(6, "Минимум 6 символов");
const nameSchema = z.string().min(2, "Минимум 2 символа");
const phoneSchema = z.string().min(10, "Введите корректный телефон");

type Role = "client" | "carrier";

interface RegistrationData {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  role: Role;
  companyName: string;
  businessType: string;
  country: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
}

const STEPS = [
  { id: 1, title: "Роль", icon: User },
  { id: 2, title: "Контакты", icon: Mail },
  { id: 3, title: "Компания", icon: Building },
  { id: 4, title: "Подтверждение", icon: CheckCircle },
];

const COUNTRIES = [
  "Узбекистан",
  "Казахстан",
  "Россия",
  "Кыргызстан",
  "Таджикистан",
  "Туркменистан",
  "Азербайджан",
];

const BUSINESS_TYPES = [
  "ИП (Индивидуальный предприниматель)",
  "ООО (Общество с ограниченной ответственностью)",
  "АО (Акционерное общество)",
  "Физическое лицо",
  "Государственная организация",
];

const MultiStepRegistration = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signUp, user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const [formData, setFormData] = useState<RegistrationData>({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    role: "client",
    companyName: "",
    businessType: "",
    country: "Узбекистан",
    termsAccepted: false,
    privacyAccepted: false,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof RegistrationData, string>>>({});

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      navigate("/dashboard");
    }
  }, [user, authLoading, navigate]);

  const updateField = <K extends keyof RegistrationData>(field: K, value: RegistrationData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<keyof RegistrationData, string>> = {};

    if (step === 1) {
      // Role selection - always valid
    }

    if (step === 2) {
      try {
        nameSchema.parse(formData.fullName);
      } catch {
        newErrors.fullName = "Введите имя (минимум 2 символа)";
      }

      try {
        emailSchema.parse(formData.email);
      } catch {
        newErrors.email = "Введите корректный email";
      }

      try {
        passwordSchema.parse(formData.password);
      } catch {
        newErrors.password = "Пароль минимум 6 символов";
      }

      try {
        phoneSchema.parse(formData.phone);
      } catch {
        newErrors.phone = "Введите корректный телефон";
      }
    }

    if (step === 3) {
      // Company info - optional for individuals
    }

    if (step === 4) {
      if (!formData.termsAccepted) {
        newErrors.termsAccepted = "Примите условия использования";
      }
      if (!formData.privacyAccepted) {
        newErrors.privacyAccepted = "Примите политику конфиденциальности";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) return;

    setLoading(true);

    try {
      const { error, data } = await signUp(
        formData.email,
        formData.password,
        formData.role,
        formData.fullName
      );

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
        setLoading(false);
        return;
      }

      // Update profile with additional info
      if (data?.user) {
        await supabase
          .from("profiles")
          .update({
            phone: formData.phone,
            company_name: formData.companyName || null,
          })
          .eq("user_id", data.user.id);

        // Create registration request for approval
        await supabase
          .from("registration_requests")
          .insert({
            user_id: data.user.id,
            company_name: formData.companyName || null,
            business_type: formData.businessType || null,
            country: formData.country,
            terms_accepted: formData.termsAccepted,
            privacy_accepted: formData.privacyAccepted,
            email_verified: true, // Auto-confirm enabled
            status: 'pending',
            onboarding_step: 4,
          });
      }

      setEmailSent(true);
      toast({
        title: "Регистрация успешна!",
        description: "Добро пожаловать на платформу",
      });

      // Redirect to dashboard
      setTimeout(() => navigate("/dashboard"), 1500);

    } catch (error) {
      console.error("Registration error:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось завершить регистрацию",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (emailSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">Регистрация завершена!</h2>
            <p className="text-muted-foreground mb-4">
              Вы успешно зарегистрированы. Перенаправляем вас в личный кабинет...
            </p>
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const progressPercent = (currentStep / 4) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center p-4">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-customer/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-driver/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">
        {/* Back button */}
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => currentStep > 1 ? handleBack() : navigate("/auth")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {currentStep > 1 ? "Назад" : "К входу"}
        </Button>

        <Card className="border-2">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold">Регистрация</CardTitle>
            <CardDescription>
              Создайте аккаунт на платформе AsiaLog
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                {STEPS.map((step) => {
                  const StepIcon = step.icon;
                  const isActive = currentStep === step.id;
                  const isCompleted = currentStep > step.id;
                  
                  return (
                    <div key={step.id} className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                        isActive 
                          ? "bg-primary text-primary-foreground" 
                          : isCompleted 
                            ? "bg-green-100 text-green-700"
                            : "bg-muted text-muted-foreground"
                      }`}>
                        {isCompleted ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <StepIcon className="w-5 h-5" />
                        )}
                      </div>
                      <span className={`text-xs mt-1 ${isActive ? "font-medium" : "text-muted-foreground"}`}>
                        {step.title}
                      </span>
                    </div>
                  );
                })}
              </div>
              <Progress value={progressPercent} className="h-1" />
            </div>

            {/* Step 1: Role Selection */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-center">Выберите вашу роль</h3>
                <RadioGroup
                  value={formData.role}
                  onValueChange={(value) => updateField("role", value as Role)}
                  className="grid grid-cols-2 gap-4"
                >
                  <Label
                    htmlFor="role-client"
                    className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 cursor-pointer transition-all ${
                      formData.role === "client"
                        ? "border-customer bg-customer/5"
                        : "border-border hover:border-customer/50"
                    }`}
                  >
                    <RadioGroupItem value="client" id="role-client" className="sr-only" />
                    <div className="w-16 h-16 rounded-full gradient-customer flex items-center justify-center">
                      <User className="w-8 h-8 text-white" />
                    </div>
                    <span className="font-semibold">Клиент</span>
                    <span className="text-xs text-muted-foreground text-center">
                      Заказываю грузоперевозки
                    </span>
                  </Label>

                  <Label
                    htmlFor="role-carrier"
                    className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 cursor-pointer transition-all ${
                      formData.role === "carrier"
                        ? "border-driver bg-driver/5"
                        : "border-border hover:border-driver/50"
                    }`}
                  >
                    <RadioGroupItem value="carrier" id="role-carrier" className="sr-only" />
                    <div className="w-16 h-16 rounded-full gradient-driver flex items-center justify-center">
                      <Truck className="w-8 h-8 text-white" />
                    </div>
                    <span className="font-semibold">Перевозчик</span>
                    <span className="text-xs text-muted-foreground text-center">
                      Выполняю заказы
                    </span>
                  </Label>
                </RadioGroup>
              </div>
            )}

            {/* Step 2: Contact Info */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Полное имя *</Label>
                  <Input
                    id="fullName"
                    placeholder="Иван Иванов"
                    value={formData.fullName}
                    onChange={(e) => updateField("fullName", e.target.value)}
                    className={errors.fullName ? "border-red-500" : ""}
                  />
                  {errors.fullName && <p className="text-xs text-red-500">{errors.fullName}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@mail.com"
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    className={errors.email ? "border-red-500" : ""}
                  />
                  {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Пароль *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Минимум 6 символов"
                    value={formData.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    className={errors.password ? "border-red-500" : ""}
                  />
                  {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Телефон *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+998 90 123 45 67"
                    value={formData.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    className={errors.phone ? "border-red-500" : ""}
                  />
                  {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
                </div>
              </div>
            )}

            {/* Step 3: Company Info */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="country">Страна *</Label>
                  <Select 
                    value={formData.country} 
                    onValueChange={(value) => updateField("country", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map(country => (
                        <SelectItem key={country} value={country}>{country}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyName">Название компании (необязательно)</Label>
                  <Input
                    id="companyName"
                    placeholder="ООО Логистика"
                    value={formData.companyName}
                    onChange={(e) => updateField("companyName", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessType">Тип бизнеса (необязательно)</Label>
                  <Select 
                    value={formData.businessType} 
                    onValueChange={(value) => updateField("businessType", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите тип" />
                    </SelectTrigger>
                    <SelectContent>
                      {BUSINESS_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 4: Confirmation */}
            {currentStep === 4 && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="glass-card p-4 space-y-3">
                  <h4 className="font-medium">Проверьте данные</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Роль:</span>
                    <span className="font-medium">{formData.role === "client" ? "Клиент" : "Перевозчик"}</span>
                    <span className="text-muted-foreground">Имя:</span>
                    <span className="font-medium">{formData.fullName}</span>
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium">{formData.email}</span>
                    <span className="text-muted-foreground">Телефон:</span>
                    <span className="font-medium">{formData.phone}</span>
                    <span className="text-muted-foreground">Страна:</span>
                    <span className="font-medium">{formData.country}</span>
                    {formData.companyName && (
                      <>
                        <span className="text-muted-foreground">Компания:</span>
                        <span className="font-medium">{formData.companyName}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Terms & Privacy */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="terms"
                      checked={formData.termsAccepted}
                      onCheckedChange={(checked) => updateField("termsAccepted", !!checked)}
                      className={errors.termsAccepted ? "border-red-500" : ""}
                    />
                    <Label htmlFor="terms" className="text-sm leading-snug cursor-pointer">
                      Я принимаю <a href="#" className="text-primary hover:underline">Условия использования</a> *
                    </Label>
                  </div>

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="privacy"
                      checked={formData.privacyAccepted}
                      onCheckedChange={(checked) => updateField("privacyAccepted", !!checked)}
                      className={errors.privacyAccepted ? "border-red-500" : ""}
                    />
                    <Label htmlFor="privacy" className="text-sm leading-snug cursor-pointer">
                      Я принимаю <a href="#" className="text-primary hover:underline">Политику конфиденциальности</a> *
                    </Label>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-3">
              {currentStep > 1 && (
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="flex-1"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Назад
                </Button>
              )}

              {currentStep < 4 ? (
                <Button
                  variant={formData.role === "client" ? "customer" : "driver"}
                  onClick={handleNext}
                  className="flex-1"
                >
                  Далее
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  variant="hero"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Регистрация...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Зарегистрироваться
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Login link */}
        <p className="text-center text-sm text-muted-foreground mt-4">
          Уже есть аккаунт?{" "}
          <a href="/auth" className="text-primary hover:underline">
            Войти
          </a>
        </p>
      </div>
    </div>
  );
};

export default MultiStepRegistration;
