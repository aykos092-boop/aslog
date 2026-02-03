import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, ArrowLeft, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendCode, checkVerificationStatus } from '@/lib/telegram-api';

const TelegramPhoneVerification: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'input' | 'sent' | 'verified'>('input');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Обратный отсчет для повторной отправки кода
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Форматирование телефона
  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.startsWith('998')) {
      return `+${cleaned.slice(0, 12)}`;
    }
    return value;
  };

  // Отправка кода
  const handleSendCode = async () => {
    if (!phone || phone.length < 12) {
      toast({
        title: "Ошибка",
        description: "Введите корректный номер телефона",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      // Вызываем наш backend API
      const result = await sendCode(phone);
      
      if (result.success) {
        setStep('sent');
        setCountdown(60); // 60 секунд до повторной отправки
        
        toast({
          title: "Код отправлен",
          description: "Проверьте Telegram бот @asloguzbot"
        });
      } else {
        throw new Error(result.error || 'Failed to send code');
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось отправить код. Попробуйте позже.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Проверка статуса верификации
  const checkVerificationStatusHandler = async () => {
    try {
      const result = await checkVerificationStatus(phone);

      if (result.verified) {
        setStep('verified');
        toast({
          title: "Успешно!",
          description: "Номер телефона подтвержден"
        });
        
        // Перенаправляем через 2 секунды
        setTimeout(() => {
          navigate('/profile');
        }, 2000);
      }
    } catch (error) {
      console.error('Error checking verification status:', error);
    }
  };

  // Периодическая проверка статуса
  useEffect(() => {
    if (step === 'sent') {
      const interval = setInterval(checkVerificationStatusHandler, 3000); // Проверяем каждые 3 секунды
      return () => clearInterval(interval);
    }
  }, [step, phone]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <Button variant="ghost" className="mb-4" onClick={() => navigate('/profile')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад к профилю
        </Button>

        <Card className="border-2">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
              <MessageCircle className="w-6 h-6 text-blue-500" />
              Подтверждение телефона
            </CardTitle>
            <CardDescription>
              Привяжите Telegram к вашему аккаунту
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {step === 'input' && (
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                    <MessageCircle className="w-8 h-8 text-blue-600" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Введите номер телефона для привязки Telegram
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Номер телефона</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+998901234567"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    className="text-center text-lg"
                  />
                </div>

                <Button 
                  onClick={handleSendCode}
                  className="w-full"
                  disabled={loading || phone.length < 12}
                >
                  {loading ? "Отправка..." : "Отправить код в Telegram"}
                </Button>

                <div className="text-xs text-muted-foreground text-center space-y-1">
                  <p>1. Введите ваш номер телефона</p>
                  <p>2. Откройте Telegram бот @asloguzbot</p>
                  <p>3. Отправьте /start и введите номер</p>
                  <p>4. Введите полученный код</p>
                </div>
              </div>
            )}

            {step === 'sent' && (
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
                    <Clock className="w-8 h-8 text-yellow-600 animate-pulse" />
                  </div>
                  <h3 className="text-lg font-semibold">Код отправлен!</h3>
                  <p className="text-sm text-muted-foreground">
                    Проверьте Telegram бот @asloguzbot
                  </p>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Код отправлен на {phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">Откройте @asloguzbot в Telegram</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">Отправьте /start и введите номер</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">Введите код подтверждения</span>
                  </div>
                </div>

                <div className="text-center text-sm text-muted-foreground">
                  <p>Ожидание подтверждения...</p>
                  <p className="text-xs">Статус проверяется автоматически</p>
                </div>

                <Button 
                  onClick={handleSendCode}
                  className="w-full"
                  variant="outline"
                  disabled={countdown > 0 || loading}
                >
                  {countdown > 0 
                    ? `Повторить через ${formatCountdown(countdown)}`
                    : "Отправить код повторно"
                  }
                </Button>
              </div>
            )}

            {step === 'verified' && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-green-600">Успешно!</h3>
                <p className="text-sm text-muted-foreground">
                  Номер телефона подтвержден и привязан к Telegram
                </p>
                <div className="text-xs text-muted-foreground">
                  Перенаправление в профиль...
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TelegramPhoneVerification;
