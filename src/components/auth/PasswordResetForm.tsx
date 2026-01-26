import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { validatePassword, requestPasswordReset, resetPassword as resetPasswordService } from "@/services/authService";
import { 
  Loader2, Mail, Phone, ArrowLeft, CheckCircle, 
  KeyRound, Eye, EyeOff, AlertCircle 
} from "lucide-react";

interface PasswordResetFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

export const PasswordResetForm = ({ onBack, onSuccess }: PasswordResetFormProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const [step, setStep] = useState<'request' | 'verify' | 'reset'>('request');
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetMethod, setResetMethod] = useState<'email' | 'telegram'>('email');

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

  const handleRequestReset = async () => {
    if (method === 'email' && !email) {
      toast({ title: "Ошибка", description: "Введите email", variant: "destructive" });
      return;
    }
    if (method === 'phone' && !phone) {
      toast({ title: "Ошибка", description: "Введите номер телефона", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const result = await requestPasswordReset(
        method === 'email' ? email : phone
      );

      if (result.success) {
        setResetMethod((result.method as 'email' | 'telegram') || 'email');
        
        if (result.method === 'telegram') {
          setStep('verify');
          toast({
            title: "Код отправлен",
            description: "Проверьте Telegram для получения кода",
          });
        } else {
          toast({
            title: "Письмо отправлено",
            description: "Проверьте вашу почту для инструкций по сбросу пароля",
          });
          onSuccess();
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось отправить запрос",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyAndReset = async () => {
    if (otp.length !== 6) {
      toast({ title: "Ошибка", description: "Введите 6-значный код", variant: "destructive" });
      return;
    }
    setStep('reset');
  };

  const handleResetPassword = async () => {
    // Validate password
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      toast({ 
        title: "Пароль не соответствует требованиям", 
        description: validation.errors.join(', '), 
        variant: "destructive" 
      });
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast({ title: "Ошибка", description: "Пароли не совпадают", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const result = await resetPasswordService({
        otp,
        phone: phone.replace(/\D/g, ''),
        newPassword,
      });

      if (result.success) {
        toast({
          title: "✅ Пароль изменён",
          description: "Теперь вы можете войти с новым паролем",
        });
        onSuccess();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось изменить пароль",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="w-fit -ml-2 mb-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад
        </Button>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="w-5 h-5" />
          Восстановление пароля
        </CardTitle>
        <CardDescription>
          {step === 'request' && "Введите email или телефон для восстановления"}
          {step === 'verify' && "Введите код из Telegram"}
          {step === 'reset' && "Придумайте новый пароль"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {step === 'request' && (
          <>
            <Tabs value={method} onValueChange={(v) => setMethod(v as 'email' | 'phone')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </TabsTrigger>
                <TabsTrigger value="phone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Телефон
                </TabsTrigger>
              </TabsList>

              <TabsContent value="email" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="example@mail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </TabsContent>

              <TabsContent value="phone" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-phone">Номер телефона</Label>
                  <Input
                    id="reset-phone"
                    type="tel"
                    placeholder="+998 90 123 45 67"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Код будет отправлен в привязанный Telegram
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <Button
              onClick={handleRequestReset}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Отправить"
              )}
            </Button>
          </>
        )}

        {step === 'verify' && (
          <>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Введите код из Telegram
              </p>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={setOtp}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>

            <Button
              onClick={verifyAndReset}
              disabled={otp.length !== 6}
              className="w-full"
            >
              Продолжить
            </Button>
          </>
        )}

        {step === 'reset' && (
          <>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-xs text-blue-800 dark:text-blue-200 font-semibold mb-2">
                🔒 Требования к паролю:
              </p>
              <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <li>• Минимум 8 символов</li>
                <li>• Заглавная буква (A-Z)</li>
                <li>• Строчная буква (a-z)</li>
                <li>• Цифра (0-9)</li>
                <li>• Спецсимвол (!@#$%...)</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">Новый пароль</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Введите новый пароль"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Подтвердите пароль</Label>
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Повторите пароль"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <Button
              onClick={handleResetPassword}
              disabled={loading || !newPassword || !confirmPassword}
              className="w-full"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Сохранить пароль
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};