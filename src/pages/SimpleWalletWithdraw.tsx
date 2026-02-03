import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Wallet, ArrowUpRight, AlertTriangle, CheckCircle } from "lucide-react";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WithdrawRequest {
  id: string;
  user_id: string;
  amount: number;
  card_number: string;
  card_holder: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  transaction_id?: string;
  admin_notes?: string;
  created_at: string;
  processed_at?: string;
}

const SimpleWalletWithdraw = () => {
  const navigate = useNavigate();
  const { user } = useFirebaseAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [amount, setAmount] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [myRequests, setMyRequests] = useState<WithdrawRequest[]>([]);

  const quickAmounts = [50000, 100000, 500000, 1000000];

  // Загрузка баланса и заявок
  useState(() => {
    loadBalance();
    loadMyRequests();
  });

  const loadBalance = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('balance')
        .eq('user_id', user?.uid || "")
        .single();

      if (!error && data) {
        setCurrentBalance(data.balance || 0);
      }
    } catch (error) {
      console.error('Error loading balance:', error);
    }
  };

  const loadMyRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('withdraw_requests')
        .select('*')
        .eq('user_id', user?.uid || "")
        .order('created_at', { ascending: false });

      if (!error && data) {
        setMyRequests(data);
      }
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  };

  const handleSubmit = async () => {
    if (!amount || !cardNumber || !cardHolder) {
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

    if (withdrawAmount < 10000) {
      toast({
        title: "Минимальная сумма",
        description: "Минимальная сумма вывода: 10,000 UZS",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Создаем заявку на вывод
      const { data, error } = await supabase
        .from('withdraw_requests')
        .insert({
          user_id: user?.uid || "",
          amount: withdrawAmount,
          card_number: cardNumber,
          card_holder: cardHolder,
          description: description,
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      toast({
        title: "✅ Заявка отправлена!",
        description: `Заявка на вывод ${withdrawAmount.toLocaleString()} UZS отправлена на обработку`,
      });

      // Очищаем форму
      setAmount("");
      setCardNumber("");
      setCardHolder("");
      setDescription("");
      
      // Обновляем баланс и заявки
      await loadBalance();
      await loadMyRequests();

    } catch (error) {
      console.error('Error submitting withdraw request:', error);
      toast({
        title: "❌ Ошибка",
        description: "Не удалось отправить заявку. Попробуйте позже.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">На проверке</Badge>;
      case 'approved':
        return <Badge className="bg-blue-100 text-blue-800">Одобрено</Badge>;
      case 'processed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Выплачено</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">Отклонено</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

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
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Текущий баланс */}
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

          {/* Информация */}
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-6">
              <h3 className="font-medium mb-4 text-orange-900">📋 Условия вывода:</h3>
              <ul className="text-sm text-orange-800 space-y-2">
                <li>• Минимальная сумма вывода: <strong>10,000 UZS</strong></li>
                <li>• Комиссия за быстрый вывод: <strong>2%</strong></li>
                <li>• Стандартный вывод: <strong>без комиссии</strong></li>
                <li>• Обработка: <strong>1-3 рабочих дня</strong></li>
                <li>• Деньги поступят на указанную карту</li>
              </ul>
            </CardContent>
          </Card>

          {/* Форма вывода */}
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-4">
                <ArrowUpRight className="w-8 h-8 text-orange-600" />
              </div>
              <CardTitle>Заявка на вывод</CardTitle>
              <CardDescription>
                Укажите сумму и реквизиты для вывода
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Сумма */}
              <div className="space-y-2">
                <Label htmlFor="amount">Сумма вывода (UZS)</Label>
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

              {/* Быстрые суммы */}
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

              {/* Номер карты */}
              <div className="space-y-2">
                <Label htmlFor="card-number">Номер карты</Label>
                <Input
                  id="card-number"
                  placeholder="8600 1234 5678 9012"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                />
              </div>

              {/* Держатель карты */}
              <div className="space-y-2">
                <Label htmlFor="card-holder">Держатель карты</Label>
                <Input
                  id="card-holder"
                  placeholder="Иванов Иван Иванович"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                />
              </div>

              {/* Описание */}
              <div className="space-y-2">
                <Label htmlFor="description">Комментарий</Label>
                <Textarea
                  id="description"
                  placeholder="Вывод заработанных средств"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Кнопка отправки */}
              <Button 
                onClick={handleSubmit} 
                className="w-full" 
                size="lg"
                disabled={loading || !amount || parseFloat(amount) > currentBalance}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Отправка...
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

          {/* Мои заявки */}
          {myRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Мои заявки на вывод</CardTitle>
                <CardDescription>
                  История заявок на вывод средств
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {myRequests.map((request) => (
                    <div key={request.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">
                          {request.amount.toLocaleString()} UZS
                        </div>
                        {getStatusBadge(request.status)}
                      </div>
                      <div className="text-sm text-muted-foreground mb-1">
                        Карта: ****{request.card_number.slice(-4)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(request.created_at).toLocaleString('ru-RU')}
                      </div>
                      {request.admin_notes && (
                        <div className="text-sm mt-2 p-2 bg-muted rounded">
                          <strong>Комментарий админа:</strong> {request.admin_notes}
                        </div>
                      )}
                      {request.transaction_id && (
                        <div className="text-sm mt-2 p-2 bg-green-50 rounded">
                          <strong>ID транзакции:</strong> {request.transaction_id}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default SimpleWalletWithdraw;
