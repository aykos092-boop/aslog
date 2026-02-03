import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, ArrowLeft, CheckCircle, Clock, AlertCircle, ExternalLink, Copy, User, Truck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createTelegramSession, verifyTelegramCode } from '@/lib/telegram-api';
import { useFirebaseAuth } from '@/contexts/FirebaseAuthContext';

const TelegramRegister: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn } = useFirebaseAuth();
  
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'client' | 'carrier'>('client');
  const [step, setStep] = useState<'input' | 'telegram' | 'verify' | 'success'>('input');
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');
  const [sessionData, setSessionData] = useState<any>(null);
  const [countdown, setCountdown] = useState(0);

  // Обратный отсчет для повторной отправки
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

  // Создание сессии
  const handleCreateSession = async () => {
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
      const result = await createTelegramSession(phone);
      
      if (result.success && result.session_token && result.telegram_link) {
        setSessionData(result);
        setStep('telegram');
        setCountdown(300); // 5 минут
        
        toast({
          title: "Сессия создана",
          description: "Откройте Telegram бота для получения уникального кода",
        });
      } else {
        throw new Error(result.error || 'Failed to create session');
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось создать сессию. Попробуйте позже.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Копирование ссылки
  const copyTelegramLink = async () => {
    if (sessionData?.telegram_link) {
      try {
        await navigator.clipboard.writeText(sessionData.telegram_link);
        toast({
          title: "Ссылка скопирована",
          description: "Ссылка скопирована в буфер обмена"
        });
      } catch (error) {
        toast({
          title: "Ошибка",
          description: "Не удалось скопировать ссылку",
          variant: "destructive"
        });
      }
    }
  };

  // Открытие Telegram
  const openTelegram = () => {
    if (sessionData?.telegram_link) {
      window.open(sessionData.telegram_link, '_blank');
      setStep('verify');
    }
  };

  // Проверка кода
  const handleVerifyCode = async () => {
    if (!code || code.length !== 5) {
      toast({
        title: "Ошибка",
        description: "Введите 5-значный код",
        variant: "destructive"
      });
      return;
    }

    if (!sessionData?.session_token) {
      toast({
        title: "Ошибка",
        description: "Сессия истекла. Начните заново",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const result = await verifyTelegramCode(sessionData.session_token, code);
      
      if (result.success) {
        setStep('success');
        
        // Создаем пользователя в Firebase
        if (result.user) {
          try {
            // Создаем временный email и пароль для Firebase
            const tempEmail = `telegram_${result.user.telegram_id}@swiftship.com`;
            const tempPassword = `telegram_${Date.now()}`;
            
            // Здесь можно добавить логику для создания Firebase аккаунта
            // или использования custom token
            
            toast({
              title: "Регистрация успешна!",
              description: `Добро пожаловать, ${result.user.full_name}!`
            });
            
            // Перенаправляем в дашборд
            setTimeout(() => {
              navigate('/dashboard');
            }, 1500);
          } catch (firebaseError) {
            console.error('Firebase auth error:', firebaseError);
            toast({
              title: "Успешная верификация!",
              description: "Telegram аккаунт подтвержден"
            });
          }
        }
      } else {
        throw new Error(result.error || 'Invalid code');
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Неверный код. Попробуйте еще раз.",
        variant: "destructive"
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
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <Button variant="ghost" className="mb-4" onClick={() => navigate('/login')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад к входу
        </Button>

        <Card className="border-2">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
              <MessageCircle className="w-6 h-6 text-blue-500" />
              Регистрация через Telegram
            </CardTitle>
            <CardDescription>
              Быстрая регистрация с подтверждением через Telegram
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
                    Выберите роль и введите номер телефона для регистрации
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Выберите роль</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={role === 'client' ? 'default' : 'outline'}
                      onClick={() => setRole('client')}
                      className="flex items-center gap-2"
                    >
                      <User className="w-4 h-4" />
                      Клиент
                    </Button>
                    <Button
                      type="button"
                      variant={role === 'carrier' ? 'default' : 'outline'}
                      onClick={() => setRole('carrier')}
                      className="flex items-center gap-2"
                    >
                      <Truck className="w-4 h-4" />
                      Перевозчик
                    </Button>
                  </div>
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
                  onClick={handleCreateSession}
                  className="w-full"
                  disabled={loading || phone.length < 12}
                >
                  {loading ? "Создание сессии..." : "Продолжить"}
                </Button>

                <div className="text-xs text-muted-foreground text-center space-y-1">
                  <p>1. Выберите роль (Клиент/Перевозчик)</p>
                  <p>2. Введите ваш номер телефона</p>
                  <p>3. Откройте Telegram @asloguzbot</p>
                  <p>4. Получите УНИКАЛЬНЫЙ код в боте</p>
                  <p>5. Введите код на сайте (3 попытки)</p>
                </div>
              </div>
            )}

            {step === 'telegram' && (
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
                    <Clock className="w-8 h-8 text-yellow-600 animate-pulse" />
                  </div>
                  <h3 className="text-lg font-semibold">Откройте Telegram!</h3>
                  <p className="text-sm text-muted-foreground">
                    Нажмите на кнопку ниже или скопируйте ссылку
                  </p>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-xs text-yellow-600 font-medium">
                      📱 Уникальный код отправлен в Telegram @asloguzbot
                    </p>
                    <p className="text-xs text-yellow-600">
                      Проверьте Telegram и введите полученный код ниже
                    </p>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Сессия создана для {phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">Роль: {role === 'client' ? 'Клиент' : 'Перевозчик'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">Срок действия: 5 минут</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button 
                    onClick={openTelegram}
                    className="w-full"
                    variant="default"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Открыть Telegram
                  </Button>

                  <div className="flex gap-2">
                    <Input
                      value={sessionData?.telegram_link || ''}
                      readOnly
                      className="text-xs"
                      placeholder="Telegram ссылка"
                    />
                    <Button 
                      onClick={copyTelegramLink}
                      variant="outline"
                      size="sm"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="text-center text-sm text-muted-foreground">
                  <p>Осталось времени: {formatCountdown(countdown)}</p>
                </div>

                <Button 
                  onClick={() => setStep('input')}
                  className="w-full"
                  variant="ghost"
                  size="sm"
                >
                  Начать заново
                </Button>
              </div>
            )}

            {step === 'verify' && (
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                    <MessageCircle className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold">Введите код из Telegram</h3>
                  <p className="text-sm text-muted-foreground">
                    Введите 5-значный код который пришел от @asloguzbot
                  </p>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="text-xs text-orange-600 font-medium">
                      ⚠️ У вас 3 попытки ввода кода
                    </p>
                    <p className="text-xs text-orange-600">
                      После 3 неверных попыток сессия будет заблокирована
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="code">Код подтверждения</Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="12345"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    className="text-center text-lg font-mono"
                    maxLength={5}
                  />
                </div>

                <Button 
                  onClick={handleVerifyCode}
                  className="w-full"
                  disabled={loading || code.length !== 5}
                >
                  {loading ? "Проверка..." : "Зарегистрироваться"}
                </Button>

                <div className="text-center text-sm text-muted-foreground">
                  <p>Осталось времени: {formatCountdown(countdown)}</p>
                </div>

                <Button 
                  onClick={() => setStep('telegram')}
                  className="w-full"
                  variant="ghost"
                  size="sm"
                >
                  Назад
                </Button>
              </div>
            )}

            {step === 'success' && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-green-600">Регистрация успешна!</h3>
                <p className="text-sm text-muted-foreground">
                  Вы успешно зарегистрировались как {role === 'client' ? 'клиент' : 'перевозчик'}
                </p>
                <div className="text-xs text-muted-foreground">
                  Перенаправление в дашборд...
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TelegramRegister;
