import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Wallet, ArrowUpRight, AlertTriangle, CheckCircle } from "lucide-react";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WalletService } from "@/modules/wallet/wallet.service";
import { useToast } from "@/hooks/use-toast";

const WalletWithdraw = () => {
  const navigate = useNavigate();
  const { user } = useFirebaseAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [amount, setAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(0);

  // Загрузка текущего баланса
  useState(() => {
    const loadBalance = async () => {
      try {
        const balanceData = await WalletService.getBalance(user?.uid || "");
        setCurrentBalance(balanceData?.balance || 0);
      } catch (error) {
        console.error('Error loading balance:', error);
      }
    };
    loadBalance();
  });

  const handleWithdraw = async () => {
    if (!amount || !withdrawMethod || !cardNumber) {
      toast({
        title: "Ошибка",
        description: "Заполните все поля",
        variant: "destructive",
      });
      return;
    }

    const withdrawAmount = parseFloat(amount);
    if (withdrawAmount <= 0) {
      toast({
        title: "Ошибка", 
        description: "Сумма должна быть больше 0",
        variant: "destructive",
      });
      return;
    }

    if (withdrawAmount > currentBalance) {
      toast({
        title: "Недостаточно средств",
        description: `Доступно: ${currentBalance.toLocaleString()} UZS`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const transaction = await WalletService.withdraw(user?.uid || "", withdrawAmount, {
        description: `Вывод на ${withdrawMethod}`
      });

      if (transaction) {
        toast({
          title: "✅ Заявка создана!",
          description: `Заявка на вывод ${withdrawAmount.toLocaleString()} UZS отправлена на обработку`,
        });
        setAmount("");
        setWithdrawMethod("");
        setCardNumber("");
        setCurrentBalance(currentBalance - withdrawAmount);
        setTimeout(() => navigate('/profile'), 2000);
      } else {
        throw new Error("Не удалось создать заявку на вывод");
      }
    } catch (error) {
      toast({
        title: "❌ Ошибка",
        description: "Не удалось создать заявку. Попробуйте позже.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [50000, 100000, 500000, 1000000];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Вывод средств</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-md mx-auto space-y-6">
          {/* Current Balance Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Wallet className="w-8 h-8 mx-auto mb-2 text-primary" />
                <h3 className="text-lg font-medium">Текущий баланс</h3>
                <div className="text-2xl font-bold text-primary">
                  {currentBalance.toLocaleString()} UZS
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Withdraw Form */}
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-4">
                <ArrowUpRight className="w-8 h-8 text-orange-600" />
              </div>
              <CardTitle>Вывести средства</CardTitle>
              <CardDescription>
                Укажите сумму и реквизиты для вывода
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Withdraw Method */}
              <div className="space-y-2">
                <Label htmlFor="withdraw-method">Способ вывода</Label>
                <Select value={withdrawMethod} onValueChange={setWithdrawMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите способ вывода" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="click">Click</SelectItem>
                    <SelectItem value="payme">Payme</SelectItem>
                    <SelectItem value="uzum">Uzum Bank</SelectItem>
                    <SelectItem value="bank_account">Банковский счет</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Card Number */}
              <div className="space-y-2">
                <Label htmlFor="card-number">
                  {withdrawMethod === 'bank_account' ? 'Номер счета' : 'Номер карты'}
                </Label>
                <Input
                  id="card-number"
                  placeholder={withdrawMethod === 'bank_account' ? '1234 5678 9012 3456' : '8600 1234 5678 9012'}
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                />
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
                  min="10000"
                  max={currentBalance}
                  step="1000"
                />
                {amount && parseFloat(amount) > currentBalance && (
                  <p className="text-sm text-red-500">
                    Превышает доступный баланс
                  </p>
                )}
              </div>

              {/* Quick Amounts */}
              <div className="space-y-2">
                <Label>Быстрые суммы</Label>
                <div className="grid grid-cols-2 gap-2">
                  {quickAmounts.map((quickAmount) => (
                    <Button
                      key={quickAmount}
                      variant="outline"
                      size="sm"
                      onClick={() => setAmount(quickAmount.toString())}
                      disabled={quickAmount > currentBalance}
                    >
                      {(quickAmount / 1000).toFixed(0)}K
                    </Button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <Button 
                onClick={handleWithdraw} 
                className="w-full" 
                size="lg"
                disabled={loading || !amount || parseFloat(amount) > currentBalance}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Обработка...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4" />
                    Вывести {amount && `${parseInt(amount).toLocaleString()} UZS`}
                  </div>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Info Cards */}
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  Важно знать:
                </h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Минимальная сумма вывода: 10,000 UZS</li>
                  <li>• Обработка занимает 1-3 рабочих дня</li>
                  <li>• Комиссия за быстрый вывод: 2%</li>
                  <li>• Стандартный вывод: без комиссии</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Безопасность:
                </h3>
                <p className="text-sm text-muted-foreground">
                  Все заявки на вывод проверяются вручную для обеспечения безопасности 
                  ваших средств. Мы можем запросить дополнительную верификацию.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="font-medium mb-2">📞 Поддержка:</h3>
                <p className="text-sm text-muted-foreground">
                  Если у вас возникли вопросы по выводу средств, 
                  свяжитесь с нашей службой поддержки.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default WalletWithdraw;
