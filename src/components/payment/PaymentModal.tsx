import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, CheckCircle, AlertCircle, Calendar, User, Receipt } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  price: number;
  planId: string;
}

export const PaymentModal = ({ isOpen, onClose, planName, price, planId }: PaymentModalProps) => {
  const { user } = useFirebaseAuth();
  const { toast } = useToast();
  
  const [step, setStep] = useState<'form' | 'processing' | 'success' | 'error'>('form');
  const [cardNumber, setCardNumber] = useState('');
  const [amount, setAmount] = useState(price);
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [loading, setLoading] = useState(false);

  const generateTransactionId = () => {
    return 'TXN' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    setCardNumber(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Ошибка",
        description: "Пользователь не найден",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setStep('processing');

    // Simulate payment processing
    setTimeout(async () => {
      const txnId = generateTransactionId();
      setTransactionId(txnId);

      try {
        // Create payment record
        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            user_id: user.uid,
            plan_id: planId,
            plan_name: planName,
            amount: amount,
            card_number: cardNumber.slice(-4), // Only last 4 digits
            transaction_id: txnId,
            status: 'pending',
            payment_method: 'card',
            created_at: new Date().toISOString()
          });

        if (paymentError) {
          console.error('Payment error:', paymentError);
          setStep('error');
          toast({
            title: "Ошибка оплаты",
            description: "Не удалось обработать платеж",
            variant: "destructive"
          });
        } else {
          setStep('success');
          toast({
            title: "Платеж отправлен на проверку",
            description: "Администратор подтвердит вашу подписку в ближайшее время",
          });
        }
      } catch (error) {
        console.error('Payment error:', error);
        setStep('error');
        toast({
          title: "Ошибка оплаты",
          description: "Произошла ошибка при обработке платежа",
          variant: "destructive"
        });
      }

      setLoading(false);
    }, 2000);
  };

  const handleClose = () => {
    if (step === 'success') {
      onClose();
      // Reset form after successful payment
      setStep('form');
      setCardNumber('');
      setAmount(price);
      setExpiry('');
      setCvv('');
      setCardHolder('');
      setTransactionId('');
    } else {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Оплата подписки
          </DialogTitle>
          <DialogDescription>
            {step === 'form' && `План "${planName}" - ${price.toLocaleString('ru-RU')} UZS`}
            {step === 'processing' && 'Обработка платежа...'}
            {step === 'success' && 'Платеж успешно отправлен!'}
            {step === 'error' && 'Ошибка при обработке платежа'}
          </DialogDescription>
        </DialogHeader>

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cardNumber">Номер карты</Label>
              <Input
                id="cardNumber"
                placeholder="1234 5678 9012 3456"
                value={cardNumber}
                onChange={handleCardNumberChange}
                maxLength={19}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cardHolder">Держатель карты</Label>
              <Input
                id="cardHolder"
                placeholder="IVAN IVANOV"
                value={cardHolder}
                onChange={(e) => setCardHolder(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expiry">Срок действия</Label>
                <Input
                  id="expiry"
                  placeholder="MM/YY"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  maxLength={5}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cvv">CVV</Label>
                <Input
                  id="cvv"
                  placeholder="123"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                  maxLength={3}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Сумма (UZS)</Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                min={price}
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? 'Обработка...' : `Оплатить ${amount.toLocaleString('ru-RU')} UZS`}
            </Button>
          </form>
        )}

        {step === 'processing' && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Обработка платежа...</p>
          </div>
        )}

        {step === 'success' && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-700">Платеж отправлен!</h3>
            </div>

            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-green-600" />
                    <span className="font-medium">Чек #{transactionId}</span>
                  </div>
                  <div className="text-sm text-green-700 space-y-1">
                    <p>План: {planName}</p>
                    <p>Сумма: {amount.toLocaleString('ru-RU')} UZS</p>
                    <p>Карта: **** **** **** {cardNumber.slice(-4)}</p>
                    <p>Дата: {format(new Date(), 'dd.MM.yyyy HH:mm', { locale: ru })}</p>
                    <p>Статус: <Badge className="bg-yellow-100 text-yellow-800">Ожидает подтверждения</Badge></p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="text-sm text-muted-foreground text-center">
              <p>Ваш платеж отправлен администратору на подтверждение.</p>
              <p>Подписка будет активирована в течение 24 часов.</p>
            </div>

            <Button onClick={handleClose} className="w-full">
              Закрыть
            </Button>
          </div>
        )}

        {step === 'error' && (
          <div className="text-center py-8">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-700">Ошибка оплаты</h3>
            <p className="text-muted-foreground mb-4">Не удалось обработать платеж. Попробуйте еще раз.</p>
            <Button onClick={() => setStep('form')} variant="outline">
              Попробовать снова
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
