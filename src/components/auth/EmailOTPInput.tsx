import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, RefreshCw, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { sendEmailOTP, verifyEmailOTP, resendEmailOTP } from "@/services/authService";

interface EmailOTPInputProps {
  email: string;
  type?: 'email_verification' | 'login';
  onVerified: () => void;
  onError?: (error: string) => void;
}

export const EmailOTPInput = ({ email, type = 'email_verification', onVerified, onError }: EmailOTPInputProps) => {
  const { toast } = useToast();
  const [code, setCode] = useState(['', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [canResend, setCanResend] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verified, setVerified] = useState(false);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-send OTP on mount
  useEffect(() => {
    handleSendOTP();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) {
      setCanResend(true);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = setInterval(() => {
      setResendCooldown(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSendOTP = async () => {
    setSending(true);
    const result = await sendEmailOTP(email, type);
    
    if (result.success) {
      toast({
        title: "Код отправлен",
        description: `Проверьте почту ${email}`,
      });
      setTimeLeft(300); // Reset timer
      setCanResend(false);
    } else {
      toast({
        title: "Ошибка",
        description: result.error || 'Не удалось отправить код',
        variant: "destructive"
      });
      onError?.(result.error || 'Failed to send OTP');
    }
    
    setSending(false);
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;
    
    setSending(true);
    const result = await resendEmailOTP(email, type);
    
    if (result.success) {
      toast({
        title: "Код отправлен повторно",
        description: "Проверьте почту",
      });
      setTimeLeft(300);
      setCanResend(false);
      setResendCooldown(0);
    } else {
      if (result.retryAfter) {
        setResendCooldown(result.retryAfter);
        toast({
          title: "Подождите",
          description: `Повторная отправка через ${result.retryAfter} сек`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Ошибка",
          description: result.error || 'Не удалось отправить код',
          variant: "destructive"
        });
      }
    }
    
    setSending(false);
  };

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 4) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all digits entered
    if (newCode.every(digit => digit !== '')) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    
    if (/^\d{5}$/.test(pastedData)) {
      const digits = pastedData.split('');
      setCode(digits);
      
      // Focus last input
      inputRefs.current[4]?.focus();
      
      // Auto-verify
      handleVerify(pastedData);
    }
  };

  const handleVerify = async (codeStr: string) => {
    setLoading(true);
    
    const result = await verifyEmailOTP(email, codeStr);
    
    if (result.success) {
      setVerified(true);
      toast({
        title: "✅ Email подтверждён",
        description: "Добро пожаловать!",
      });
      setTimeout(() => onVerified(), 500);
    } else {
      toast({
        title: "Неверный код",
        description: result.error || 'Проверьте правильность кода',
        variant: "destructive"
      });
      setCode(['', '', '', '', '']);
      inputRefs.current[0]?.focus();
      onError?.(result.error || 'Invalid code');
    }
    
    setLoading(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (verified) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <p className="text-lg font-semibold text-green-600">Email подтверждён!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Подтвердите Email</h3>
        <p className="text-sm text-muted-foreground">
          Мы отправили 5-значный код на<br />
          <span className="font-semibold text-foreground">{email}</span>
        </p>
      </div>

      <div>
        <Label className="text-center block mb-3">Введите код подтверждения</Label>
        <div className="flex gap-3 justify-center" onPaste={handlePaste}>
          {code.map((digit, index) => (
            <Input
              key={index}
              ref={el => inputRefs.current[index] = el}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleCodeChange(index, e.target.value)}
              onKeyDown={e => handleKeyDown(index, e)}
              className="w-14 h-14 text-center text-2xl font-bold"
              disabled={loading || verified}
              autoFocus={index === 0}
            />
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Проверка кода...</span>
        </div>
      )}

      <div className="space-y-3">
        {timeLeft > 0 && (
          <div className="text-center text-sm text-muted-foreground">
            ⏰ Код действителен ещё <span className="font-semibold text-foreground">{formatTime(timeLeft)}</span>
          </div>
        )}

        <div className="flex items-center justify-center gap-2">
          <span className="text-sm text-muted-foreground">Не получили код?</span>
          <Button
            variant="link"
            size="sm"
            onClick={handleResendOTP}
            disabled={sending || resendCooldown > 0 || !canResend}
            className="h-auto p-0"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Отправка...
              </>
            ) : resendCooldown > 0 ? (
              `Повторить через ${resendCooldown}с`
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-1" />
                Отправить повторно
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
        <p className="text-xs text-yellow-800 dark:text-yellow-200">
          ⚠️ <strong>Важно:</strong> Проверьте папку "Спам", если не видите письмо во "Входящих"
        </p>
      </div>
    </div>
  );
};
