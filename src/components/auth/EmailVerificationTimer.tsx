import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { firebaseSendEmailVerification } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, Clock, RefreshCw } from "lucide-react";

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
        toast({
          title: "✅ Email подтверждён!",
          description: "Добро пожаловать в систему!",
        });
        onVerified();
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
      description: "Email не был подтверждён в течение 2 минут. Пожалуйста, зарегистрируйтесь заново.",
      variant: "destructive"
    });
    
    // Sign out and redirect to registration
    await signOut();
    setTimeout(() => {
      navigate('/auth');
    }, 2000);
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

  // Auto-check verification every 5 seconds
  useEffect(() => {
    if (!isExpired && user && !user.emailVerified) {
      const interval = setInterval(() => {
        checkVerification();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [checkVerification, isExpired, user]);

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
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Mail className="w-6 h-6 text-primary" />
          Подтвердите профиль
        </CardTitle>
        <CardDescription>
          Письмо отправлено на <strong>{email}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Timer Display */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className={`w-5 h-5 ${isExpired ? 'text-destructive' : 'text-primary'}`} />
            <span className={`text-2xl font-mono font-bold ${isExpired ? 'text-destructive' : 'text-primary'}`}>
              {formatTime(timeLeft)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {isExpired 
              ? "Время подтверждения истекло" 
              : "Осталось времени для подтверждения email"
            }
          </p>
        </div>

        {/* Instructions */}
        <div className="bg-muted/50 rounded-lg p-4">
          <h4 className="font-medium mb-2">Что нужно сделать:</h4>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Откройте вашу почту</li>
            <li>Найдите письмо от Firebase</li>
            <li>Нажмите на ссылку подтверждения</li>
            <li>Страница обновится автоматически</li>
          </ol>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button 
            onClick={handleManualCheck}
            disabled={isChecking || isExpired}
            className="w-full"
            variant="default"
          >
            {isChecking ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Проверка...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Проверить статус
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

        {/* Warning message */}
        {isExpired && (
          <div className="text-center text-sm text-destructive">
            <p>Вы будете перенаправлены на страницу регистрации через несколько секунд...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
