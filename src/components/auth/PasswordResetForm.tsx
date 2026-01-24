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
import { 
  Loader2, Mail, Phone, ArrowLeft, CheckCircle, 
  KeyRound, Eye, EyeOff 
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

  const requestReset = async () => {
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
      const { data, error } = await supabase.functions.invoke('password-reset', {
        body: {
          action: 'request',
          email: method === 'email' ? email : undefined,
          phone: method === 'phone' ? phone.replace(/\D/g, '') : undefined,
        },
      });

      if (error) throw error;

      if (data.success) {
        setResetMethod(data.method || 'email');
        
        if (data.method === 'telegram') {
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

  const resetPassword = async () => {
    if (newPassword.length < 8) {
      toast({ title: "Ошибка", description: "Пароль должен быть не менее 8 символов", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Ошибка", description: "Пароли не совпадают", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('password-reset', {
        body: {
          action: 'reset',
          otp,
          phone: phone.replace(/\D/g, ''),
          newPassword,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Пароль изменён",
          description: "Теперь вы можете войти с новым паролем",
        });
        onSuccess();
      } else {
        throw new Error(data.error);
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
              onClick={requestReset}
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
            <div className="space-y-2">
              <Label htmlFor="new-password">Новый пароль</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Минимум 8 символов"
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
              onClick={resetPassword}
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