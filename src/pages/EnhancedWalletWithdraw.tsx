import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Wallet, ArrowUpRight, AlertTriangle, CheckCircle, Save, CreditCard, User, Smartphone, Eye } from "lucide-react";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PaymentMethod {
  id: string;
  card_number: string;
  card_holder: string;
  bank_name: string;
  card_type: string;
  is_default: boolean;
}

interface UserContact {
  id: string;
  phone: string;
  telegram_username: string;
  telegram_user_id: number;
  email: string;
  is_primary: boolean;
}

interface WithdrawRequest {
  id: string;
  user_id: string;
  amount: number;
  card_number: string;
  card_holder: string;
  description: string;
  status: 'pending' | 'checking' | 'approved' | 'rejected' | 'processed';
  transaction_id?: string;
  admin_notes?: string;
  created_at: string;
  processed_at?: string;
  payment_method_id?: string;
  payment_method?: PaymentMethod;
}

const EnhancedWalletWithdraw = () => {
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
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [userContacts, setUserContacts] = useState<UserContact | null>(null);

  // Форма для сохранения реквизитов
  const [showSaveMethodDialog, setShowSaveMethodDialog] = useState(false);
  const [newCardNumber, setNewCardNumber] = useState("");
  const [newCardHolder, setNewCardHolder] = useState("");
  const [newBankName, setNewBankName] = useState("");
  const [newCardType, setNewCardType] = useState("humo");
  const [isDefault, setIsDefault] = useState(false);

  // Форма для контактных данных
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [telegramUserId, setTelegramUserId] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);

  const quickAmounts = [50000, 100000, 500000, 1000000];

  // Загрузка данных
  useEffect(() => {
    loadUserData();
    loadMyRequests();
  }, []);

  const loadUserData = async () => {
    try {
      // Загружаем баланс
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('balance')
        .eq('user_id', user?.uid || "")
        .single();

      if (!profileError && profileData) {
        setCurrentBalance(profileData.balance || 0);
      }

      // Загружаем реквизиты
      const { data: methodsData, error: methodsError } = await supabase
        .from('user_payment_methods')
        .select('*')
        .eq('user_id', user?.uid || "")
        .eq('is_active', true)
        .order('is_default', { ascending: false });

      if (!methodsError && methodsData) {
        setPaymentMethods(methodsData);
      }

      // Загружаем контактные данные
      const { data: contactsData, error: contactsError } = await supabase
        .from('user_contacts')
        .select('*')
        .eq('user_id', user?.uid || "");

      if (!contactsError && contactsData && contactsData.length > 0) {
        setUserContacts(contactsData[0]);
        setPhoneNumber(contactsData[0].phone || "");
        setTelegramUsername(contactsData[0].telegram_username || "");
        setTelegramUserId(contactsData[0].telegram_user_id?.toString() || "");
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadMyRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('withdraw_requests')
        .select(`
          *,
          user_payment_methods!inner(
            card_number,
            card_holder,
            bank_name,
            card_type
          )
        `)
        .eq('user_id', user?.uid || "")
        .order('created_at', { ascending: false });

      if (!error && data) {
        setMyRequests(data as WithdrawRequest[]);
      }
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  };

  const handleSavePaymentMethod = async () => {
    if (!newCardNumber || !newCardHolder) {
      toast({
        title: "Ошибка",
        description: "Заполните номер карты и имя держателя",
        variant: "destructive",
      });
      return;
    }

    try {
      // Если устанавливаем как default, убираем default у других
      if (isDefault) {
        await supabase
          .from('user_payment_methods')
          .update({ is_default: false })
          .eq('user_id', user?.uid || "");
      }

      const { data, error } = await supabase
        .from('user_payment_methods')
        .insert({
          user_id: user?.uid || "",
          card_number: newCardNumber,
          card_holder: newCardHolder,
          bank_name: newBankName,
          card_type: newCardType,
          is_default: isDefault
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "✅ Сохранено!",
        description: "Реквизиты сохранены в вашем профиле",
      });

      // Очищаем форму
      setNewCardNumber("");
      setNewCardHolder("");
      setNewBankName("");
      setNewCardType("humo");
      setIsDefault(false);
      setShowSaveMethodDialog(false);
      
      // Обновляем список
      await loadUserData();

    } catch (error) {
      console.error('Error saving payment method:', error);
      toast({
        title: "❌ Ошибка",
        description: "Не удалось сохранить реквизиты",
        variant: "destructive",
      });
    }
  };

  const handleSaveContact = async () => {
    try {
      const { error } = await supabase
        .from('user_contacts')
        .upsert({
          user_id: user?.uid || "",
          phone: phoneNumber,
          telegram_username: telegramUsername,
          telegram_user_id: telegramUserId ? parseInt(telegramUserId) : null,
          email: user?.email || "",
          is_primary: true
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "✅ Сохранено!",
        description: "Контактные данные обновлены",
      });

      setShowContactDialog(false);
      await loadUserData();

    } catch (error) {
      console.error('Error saving contact:', error);
      toast({
        title: "❌ Ошибка",
        description: "Не удалось сохранить контактные данные",
        variant: "destructive",
      });
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
      // Создаем заявку на вывод с контактными данными
      const { data, error } = await supabase
        .from('withdraw_requests')
        .insert({
          user_id: user?.uid || "",
          amount: withdrawAmount,
          card_number: cardNumber,
          card_holder: cardHolder,
          description: `${description}\n\n📞 Телефон: ${phoneNumber || 'Не указан'}\n📱 Telegram: @${telegramUsername || 'Не указан'}\n🆔 UID: ${user?.uid}\n📧 Email: ${user?.email}`,
          status: 'checking'
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
      setCurrentBalance(currentBalance - withdrawAmount);
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
      case 'checking':
        return <Badge className="bg-blue-100 text-blue-800">На проверке</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Ожидание</Badge>;
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
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Информация о пользователе */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <h3 className="font-medium mb-4 text-blue-900">👤 Ваша информация:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
                <div>
                  <strong>UID:</strong> {user?.uid || 'Неизвестно'}
                </div>
                <div>
                  <strong>Email:</strong> {user?.email || 'Неизвестно'}
                </div>
                <div>
                  <strong>Телефон:</strong> {phoneNumber || 'Не указан'}
                </div>
                <div>
                  <strong>Telegram:</strong> @{telegramUsername || 'Не указан'}
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={() => setShowContactDialog(true)}>
                  <Smartphone className="w-4 h-4 mr-1" />
                  Обновить контакты
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowSaveMethodDialog(true)}>
                  <Save className="w-4 h-4 mr-1" />
                  Сохранить карту
                </Button>
              </div>
            </CardContent>
          </Card>

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

          {/* Сохраненные карты */}
          {paymentMethods.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Ваши сохраненные карты
                </CardTitle>
                <CardDescription>
                  Выберите карту для вывода или добавьте новую
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {paymentMethods.map((method) => (
                    <div key={method.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-medium">****{method.card_number.slice(-4)}</div>
                          <div className="text-sm text-muted-foreground">{method.card_holder}</div>
                          {method.bank_name && (
                            <div className="text-xs text-muted-foreground">{method.bank_name}</div>
                          )}
                        </div>
                        {method.is_default && (
                          <Badge variant="secondary" className="text-xs">По умолчанию</Badge>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={cardNumber === method.card_number ? "default" : "outline"}
                        onClick={() => setCardNumber(method.card_number)}
                      >
                        {cardNumber === method.card_number ? "Выбрано" : "Выбрать"}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

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

              {/* Выбор карты */}
              <div className="space-y-2">
                <Label>Карта для вывода</Label>
                <Select value={cardNumber} onValueChange={setCardNumber}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите карту" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((method) => (
                      <SelectItem key={method.id} value={method.card_number}>
                        ****{method.card_number.slice(-4)} - {method.card_holder}
                      </SelectItem>
                    ))}
                    <SelectItem value="5614681812274623">5614****4623 - Swift Ship Connect</SelectItem>
                  </SelectContent>
                </Select>
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
                      {request.description && (
                        <div className="text-sm mt-2 p-2 bg-muted rounded">
                          <strong>Комментарий:</strong> {request.description}
                        </div>
                      )}
                      {request.admin_notes && (
                        <div className="text-sm mt-2 p-2 bg-blue-50 rounded">
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

      {/* Диалог сохранения карты */}
      <Dialog open={showSaveMethodDialog} onOpenChange={setShowSaveMethodDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Сохранить карту</DialogTitle>
            <DialogDescription>
              Сохраните вашу карту для быстрого вывода в будущем
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-card-number">Номер карты</Label>
              <Input
                id="new-card-number"
                placeholder="8600 1234 5678 9012"
                value={newCardNumber}
                onChange={(e) => setNewCardNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-card-holder">Держатель карты</Label>
              <Input
                id="new-card-holder"
                placeholder="Иванов Иван Иванович"
                value={newCardHolder}
                onChange={(e) => setNewCardHolder(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-bank-name">Банк</Label>
              <Input
                id="new-bank-name"
                placeholder="TBC Bank"
                value={newBankName}
                onChange={(e) => setNewBankName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-card-type">Тип карты</Label>
              <Select value={newCardType} onValueChange={setNewCardType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="humo">Humo</SelectItem>
                  <SelectItem value="uzcard">Uzcard</SelectItem>
                  <SelectItem value="visa">Visa</SelectItem>
                  <SelectItem value="mastercard">Mastercard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is-default"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="is-default">Использовать по умолчанию</Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowSaveMethodDialog(false)}>
                Отмена
              </Button>
              <Button onClick={handleSavePaymentMethod}>
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог контактных данных */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Контактные данные</DialogTitle>
            <DialogDescription>
              Обновите ваши контактные данные для связи
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input
                id="phone"
                placeholder="+998 90 123-45-67"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telegram-username">Telegram username</Label>
              <Input
                id="telegram-username"
                placeholder="@username"
                value={telegramUsername}
                onChange={(e) => setTelegramUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telegram-user-id">Telegram User ID</Label>
              <Input
                id="telegram-user-id"
                placeholder="123456789"
                value={telegramUserId}
                onChange={(e) => setTelegramUserId(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowContactDialog(false)}>
                Отмена
              </Button>
              <Button onClick={handleSaveContact}>
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EnhancedWalletWithdraw;
