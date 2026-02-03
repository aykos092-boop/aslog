import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Wallet, Plus, CreditCard, Smartphone } from "lucide-react";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WalletService } from "@/modules/wallet/wallet.service";
import { ClickService } from "@/integrations/payments/click.service";
import { PaymeService } from "@/integrations/payments/payme.service";
import { useToast } from "@/hooks/use-toast";

const WalletDeposit = () => {
  const navigate = useNavigate();
  const { user } = useFirebaseAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDeposit = async () => {
    if (!amount || !paymentMethod) {
      toast({
        title: "Ошибка",
        description: "Заполните все поля",
        variant: "destructive",
      });
      return;
    }

    const depositAmount = parseFloat(amount);
    if (depositAmount <= 0) {
      toast({
        title: "Ошибка", 
        description: "Сумма должна быть больше 0",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const transaction = await WalletService.deposit(user?.uid || "", depositAmount, {
        description: `Пополнение через ${paymentMethod}`
      });

      if (transaction) {
        toast({
          title: "✅ Успешно!",
          description: `Баланс пополнен на ${depositAmount.toLocaleString()} UZS`,
        });
        setAmount("");
        setPaymentMethod("");
        // Можно добавить редирект на страницу транзакций
        setTimeout(() => navigate('/profile'), 2000);
      } else {
        throw new Error("Не удалось создать транзакцию");
      }
    } catch (error) {
      toast({
        title: "❌ Ошибка",
        description: "Не удалось пополнить баланс. Попробуйте позже.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [50000, 100000, 500000, 1000000, 5000000];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Пополнение баланса</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-md mx-auto space-y-6">
          {/* Deposit Card */}
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Wallet className="w-8 h-8 text-primary" />
              </div>
              <CardTitle>Пополнить баланс</CardTitle>
              <CardDescription>
                Выберите способ и сумму пополнения
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Payment Method */}
              <div className="space-y-2">
                <Label htmlFor="payment-method">Способ оплаты</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите способ оплаты" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="click">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        Click
                      </div>
                    </SelectItem>
                    <SelectItem value="payme">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4" />
                        Payme
                      </div>
                    </SelectItem>
                    <SelectItem value="uzum">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4" />
                        Uzum Bank
                      </div>
                    </SelectItem>
                    <SelectItem value="bank_transfer">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4" />
                        Банковский перевод
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount">Сумма (UZS)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Введите сумму"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1000"
                  step="1000"
                />
              </div>

              {/* Quick Amounts */}
              <div className="space-y-2">
                <Label>Быстрые суммы</Label>
                <div className="grid grid-cols-3 gap-2">
                  {quickAmounts.map((quickAmount) => (
                    <Button
                      key={quickAmount}
                      variant="outline"
                      size="sm"
                      onClick={() => setAmount(quickAmount.toString())}
                    >
                      {(quickAmount / 1000).toFixed(0)}K
                    </Button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <Button 
                onClick={handleDeposit} 
                className="w-full" 
                size="lg"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Обработка...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Пополнить {amount && `${parseInt(amount).toLocaleString()} UZS`}
                  </div>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Info Cards */}
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-medium mb-2">💡 Как это работает:</h3>
                <ol className="text-sm text-muted-foreground space-y-1">
                  <li>1. Выберите удобный способ оплаты</li>
                  <li>2. Укажите сумму пополнения</li>
                  <li>3. Нажмите "Пополнить"</li>
                  <li>4. Следуйте инструкциям платежной системы</li>
                  <li>5. Средства поступят на ваш баланс</li>
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="font-medium mb-2">⚡ Мгновенное пополнение:</h3>
                <p className="text-sm text-muted-foreground">
                  Пополнение через Click, Payme и Uzum Bank происходит мгновенно. 
                  Банковские переводы могут занять 1-3 рабочих дня.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="font-medium mb-2">🔒 Безопасность:</h3>
                <p className="text-sm text-muted-foreground">
                  Все платежи защищены и проходят через надежные платежные системы. 
                  Ваши средства в безопасности.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default WalletDeposit;
