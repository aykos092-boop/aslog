import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, Phone, MessageCircle, CheckCircle, AlertCircle } from "lucide-react";

interface PhoneOTPVerificationProps {
  phone: string;
  onPhoneChange: (phone: string) => void;
  onVerified: () => void;
  userId?: string;
  telegramChatId?: string;
}

export const PhoneOTPVerification = ({
  phone,
  onPhoneChange,
  onVerified,
  userId,
  telegramChatId,
}: PhoneOTPVerificationProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const formatPhone = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as +998 XX XXX XX XX
    if (digits.startsWith('998')) {
      const rest = digits.slice(3);
      let formatted = '+998';
      if (rest.length > 0) formatted += ' ' + rest.slice(0, 2);
      if (rest.length > 2) formatted += ' ' + rest.slice(2, 5);
      if (rest.length > 5) formatted += ' ' + rest.slice(5, 7);
      if (rest.length > 7) formatted += ' ' + rest.slice(7, 9);
      return formatted;
    }
    
    // Add +998 prefix if not present
    if (!digits.startsWith('998') && digits.length > 0) {
      return '+998 ' + digits.slice(0, 2) + (digits.length > 2 ? ' ' + digits.slice(2, 5) : '') + 
             (digits.length > 5 ? ' ' + digits.slice(5, 7) : '') + (digits.length > 7 ? ' ' + digits.slice(7, 9) : '');
    }
    
    return value;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    onPhoneChange(formatted);
  };

  const sendOTP = async () => {
    if (!phone || phone.replace(/\D/g, '').length < 12) {
      toast({
        title: "Ошибка",
        description: "Введите корректный номер телефона",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-otp', {
        body: {
          action: 'send',
          phone: phone.replace(/\D/g, ''),
          telegramChatId,
          userId,
        },
      });

      if (error) throw error;

      if (data.success) {
        setStep('otp');
        setCountdown(300); // 5 minutes
        
        // For development - show code if returned
        if (data.code) {
          setDevCode(data.code);
        }
        
        toast({
          title: telegramChatId ? "Код отправлен в Telegram" : "Код сгенерирован",
          description: telegramChatId 
            ? "Проверьте ваш Telegram для получения кода" 
            : "Введите код для подтверждения",
        });
      } else {
        throw new Error(data.error || 'Failed to send OTP');
      }
    } catch (error: any) {
      console.error('Send OTP error:', error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось отправить код",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (otp.length !== 6) {
      toast({
        title: "Ошибка",
        description: "Введите 6-значный код",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-otp', {
        body: {
          action: 'verify',
          phone: phone.replace(/\D/g, ''),
          code: otp,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Телефон подтверждён",
          description: "Ваш номер телефона успешно верифицирован",
        });
        onVerified();
      } else {
        throw new Error(data.error || 'Invalid OTP');
      }
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      toast({
        title: "Неверный код",
        description: error.message || "Проверьте код и попробуйте снова",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {step === 'phone' ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Номер телефона
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+998 90 123 45 67"
              value={phone}
              onChange={handlePhoneChange}
              className="text-lg"
            />
          </div>

          {telegramChatId && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm">Код будет отправлен в Telegram</span>
            </div>
          )}

          <Button
            onClick={sendOTP}
            disabled={loading || !phone}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Отправка...
              </>
            ) : (
              "Получить код"
            )}
          </Button>
        </>
      ) : (
        <>
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Код отправлен на {phone}
            </p>
            {countdown > 0 && (
              <p className="text-sm font-medium">
                Код действителен: {formatCountdown(countdown)}
              </p>
            )}
          </div>

          {/* Dev mode: show code */}
          {devCode && (
            <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 text-center">
              <p className="text-xs">Dev Mode - Ваш код:</p>
              <p className="text-xl font-mono font-bold">{devCode}</p>
            </div>
          )}

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

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setStep('phone');
                setOtp('');
                setDevCode(null);
              }}
              className="flex-1"
            >
              Изменить номер
            </Button>
            <Button
              onClick={verifyOTP}
              disabled={loading || otp.length !== 6}
              className="flex-1"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Подтвердить
                </>
              )}
            </Button>
          </div>

          {countdown === 0 && (
            <Button
              variant="ghost"
              onClick={sendOTP}
              disabled={loading}
              className="w-full"
            >
              Отправить код повторно
            </Button>
          )}
        </>
      )}
    </div>
  );
};