import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { firebaseSendEmailVerification } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, Clock, RefreshCw, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmailVerificationTimerProps {
  email: string;
  onVerified: () => void;
  onError: (error: string) => void;
}

export const EmailVerificationTimer: React.FC<EmailVerificationTimerProps> = ({
  email,
  onVerified,
  onError
}) => {
  const { user, checkEmailVerification, signOut } = useFirebaseAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [timeLeft, setTimeLeft] = useState(120); // 2 minutes in seconds
  const [isChecking, setIsChecking] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Check email verification status
  const checkVerification = useCallback(async () => {
    if (!user) return;
    
    setIsChecking(true);
    try {
      const isVerified = await checkEmailVerification();
      if (isVerified) {
        setIsVerified(true);
        setShowSuccessAnimation(true);
        toast({
          title: "🎉 Email подтверждён!",
          description: "Добро пожаловать в Swift Ship Connect!",
        });
        
        // Show success animation for 2 seconds, then redirect
        setTimeout(() => {
          onVerified();
        }, 2000);
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Ошибка проверки email');
    } finally {
      setIsChecking(false);
    }
  }, [user, checkEmailVerification, onVerified, onError, toast]);

  // Handle timer expiration
  const handleExpiration = useCallback(async () => {
    setIsExpired(true);
    toast({
      title: "⏰ Время истекло",
      description: "Email не был подтверждён в течение 2 минут. Регистрация отменена.",
      variant: "destructive"
    });
    
    // Delete user account and sign out
    await signOut();
    setTimeout(() => {
      navigate('/signup');
    }, 3000);
  }, [toast, signOut, navigate]);

  // Timer effect
  useEffect(() => {
    if (timeLeft > 0 && !isExpired) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && !isExpired) {
      handleExpiration();
    }
  }, [timeLeft, isExpired, handleExpiration]);

  // Auto-check verification every 3 seconds
  useEffect(() => {
    if (!isExpired && user && !user.emailVerified && !isVerified) {
      const interval = setInterval(() => {
        checkVerification();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [checkVerification, isExpired, user, isVerified]);

  // Manual check
  const handleManualCheck = () => {
    checkVerification();
  };

  // Resend verification email
  const handleResendEmail = async () => {
    if (!user) return;
    
    try {
      await firebaseSendEmailVerification(user);
      
      toast({
        title: "📧 Письмо отправлено",
        description: "Проверьте вашу почту для подтверждения",
      });
      
      // Reset timer
      setTimeLeft(120);
      setIsExpired(false);
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось отправить письмо повторно",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* Success Animation Overlay */}
      {showSuccessAnimation && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm rounded-lg">
          <div className="text-center animate-fade-in">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center animate-bounce">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-green-600 mb-2">Успешно!</h3>
            <p className="text-muted-foreground">Перенаправление в дашборд...</p>
          </div>
        </div>
      )}

      <Card className={cn(
        "w-full transition-all duration-300",
        isExpired && "border-destructive/50 bg-destructive/5",
        isVerified && "border-green-500/50 bg-green-50"
      )}>
        <CardHeader className="text-center">
          <CardTitle className={cn(
            "flex items-center justify-center gap-2 text-xl",
            isExpired && "text-destructive",
            isVerified && "text-green-600"
          )}>
            {isVerified ? (
              <CheckCircle className="w-6 h-6" />
            ) : isExpired ? (
              <AlertCircle className="w-6 h-6" />
            ) : (
              <Mail className="w-6 h-6 text-primary" />
            )}
            {isVerified ? "Email подтверждён!" : isExpired ? "Время истекло" : "Подтвердите профиль"}
          </CardTitle>
          <CardDescription className={cn(
            isExpired && "text-destructive/80",
            isVerified && "text-green-600/80"
          )}>
            {isVerified 
              ? "Добро пожаловать в Swift Ship Connect!"
              : isExpired 
                ? "Регистрация отменена" 
                : `Письмо отправлено на <strong>${email}</strong>`
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Timer Display */}
          {!isVerified && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className={cn(
                  "w-5 h-5 transition-colors",
                  isExpired ? 'text-destructive animate-pulse' : 
                  timeLeft <= 30 ? 'text-orange-500 animate-pulse' : 'text-primary'
                )} />
                <span className={cn(
                  "text-3xl font-mono font-bold transition-all",
                  isExpired ? 'text-destructive' : 
                  timeLeft <= 30 ? 'text-orange-500' : 'text-primary'
                )}>
                  {formatTime(timeLeft)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {isExpired 
                  ? "Время подтверждения истекло" 
                  : timeLeft <= 30
                    ? "Осталось мало времени!"
                    : "Осталось времени для подтверждения email"
                }
              </p>
            </div>
          )}

          {!isVerified && !isExpired && (
            <>
              {/* Instructions */}
              <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Что нужно сделать:
                </h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">1.</span>
                    <span>Откройте вашу почту ({email})</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">2.</span>
                    <span>Найдите письмо от Firebase</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">3.</span>
                    <span>Нажмите на ссылку подтверждения</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">4.</span>
                    <span>Страница обновится автоматически</span>
                  </li>
                </ol>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button 
                  onClick={handleManualCheck}
                  disabled={isChecking || isExpired}
                  className="w-full"
                  variant="default"
                  size="lg"
                >
                  {isChecking ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Проверка...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Я подтвердил email
                    </>
                  )}
                </Button>

                <Button 
                  onClick={handleResendEmail}
                  disabled={isExpired}
                  variant="outline"
                  className="w-full"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Отправить письмо повторно
                </Button>
              </div>
            </>
          )}

          {/* Warning/Success Messages */}
          {isExpired && (
            <div className="text-center space-y-3">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
                <p className="text-sm text-destructive font-medium">
                  Регистрация отменена
                </p>
                <p className="text-xs text-destructive/80 mt-1">
                  Вы будете перенаправлены на страницу регистрации через несколько секунд...
                </p>
              </div>
            </div>
          )}

          {isVerified && (
            <div className="text-center">
              <div className="bg-green-100 border border-green-200 rounded-lg p-4">
                <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-sm text-green-700 font-medium">
                  Отлично! Ваш аккаунт подтверждён
                </p>
                <p className="text-xs text-green-600 mt-1">
                  Перенаправление в дашборд...
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
