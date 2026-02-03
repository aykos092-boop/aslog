import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Wallet, Plus, Upload, CheckCircle, Clock } from "lucide-react";
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

interface DepositRequest {
  id: string;
  user_id: string;
  amount: number;
  card_number: string;
  card_holder: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  receipt_url?: string;
  created_at: string;
  updated_at?: string;
  admin_notes?: string;
}

const SimpleWalletDeposit = () => {
  const navigate = useNavigate();
  const { user } = useFirebaseAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [amount, setAmount] = useState("");
  const [cardNumber, setCardNumber] = useState("5614681812274623");
  const [cardHolder, setCardHolder] = useState("");
  const [description, setDescription] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [myRequests, setMyRequests] = useState<DepositRequest[]>([]);

  const quickAmounts = [50000, 100000, 500000, 1000000, 5000000];

  // Загрузка заявок пользователя
  useState(() => {
    loadMyRequests();
  });

  const loadMyRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('deposit_requests')
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Проверяем что это изображение
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Ошибка",
          description: "Пожалуйста, загрузите изображение чека",
          variant: "destructive",
        });
        return;
      }
      setReceiptFile(file);
    }
  };

  const handleSubmit = async () => {
    if (!amount || !cardHolder || !description || !receiptFile) {
      toast({
        title: "Ошибка",
        description: "Заполните все поля и загрузите чек",
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
      // Загружаем чек в storage
      const fileName = `receipts/${user?.uid}/${Date.now()}_${receiptFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, receiptFile);

      if (uploadError) {
        throw uploadError;
      }

      // Получаем public URL
      const { data: urlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName);

      // Создаем заявку на пополнение
      const { data, error } = await supabase
        .from('deposit_requests')
        .insert({
          user_id: user?.uid || "",
          amount: depositAmount,
          card_number: cardNumber,
          card_holder: cardHolder,
          description: description,
          receipt_url: urlData.publicUrl,
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      toast({
        title: "✅ Заявка отправлена!",
        description: `Заявка на пополнение ${depositAmount.toLocaleString()} UZS отправлена на проверку`,
      });

      // Очищаем форму
      setAmount("");
      setCardHolder("");
      setDescription("");
      setReceiptFile(null);
      
      // Обновляем список заявок
      await loadMyRequests();

    } catch (error) {
      console.error('Error submitting deposit request:', error);
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
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />На проверке</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Одобрено</Badge>;
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
            <h1 className="text-xl font-bold">Пополнение баланса</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Инструкция */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <h3 className="font-medium mb-4 text-blue-900">📋 Как пополнить баланс:</h3>
              <ol className="text-sm text-blue-800 space-y-2">
                <li>1. Переведите деньги на карту: <strong>5614 6818 1227 4623</strong></li>
                <li>2. Получатель: <strong>Swift Ship Connect</strong></li>
                <li>3. Сделайте скриншот чека перевода</li>
                <li>4. Заполните форму ниже и загрузите чек</li>
                <li>5. Админ проверит и пополнит ваш баланс</li>
              </ol>
            </CardContent>
          </Card>

          {/* Форма пополнения */}
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Wallet className="w-8 h-8 text-primary" />
              </div>
              <CardTitle>Заявка на пополнение</CardTitle>
              <CardDescription>
                Заполните форму и загрузите чек перевода
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Карта получателя */}
              <div className="space-y-2">
                <Label>Карта для пополнения</Label>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="font-mono text-lg">5614 6818 1227 4623</div>
                  <div className="text-sm text-muted-foreground">Swift Ship Connect</div>
                </div>
              </div>

              {/* Сумма */}
              <div className="space-y-2">
                <Label htmlFor="amount">Сумма перевода (UZS)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Введите сумму"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="10000"
                  step="1000"
                />
              </div>

              {/* Быстрые суммы */}
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

              {/* Данные отправителя */}
              <div className="space-y-2">
                <Label htmlFor="card-holder">Ваше ФИО (как на карте)</Label>
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
                  placeholder="Пополнение баланса для перевозок"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Загрузка чека */}
              <div className="space-y-2">
                <Label htmlFor="receipt">Чек перевода *</Label>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4">
                  <input
                    id="receipt"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="receipt" className="cursor-pointer">
                    <div className="text-center">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {receiptFile ? receiptFile.name : "Нажмите для загрузки чека"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        JPG, PNG до 10MB
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Кнопка отправки */}
              <Button 
                onClick={handleSubmit} 
                className="w-full" 
                size="lg"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Отправка...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Отправить заявку {amount && `(${parseInt(amount).toLocaleString()} UZS)`}
                  </div>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Мои заявки */}
          {myRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Мои заявки</CardTitle>
                <CardDescription>
                  История заявок на пополнение баланса
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
                      <div className="text-sm text-muted-foreground">
                        {new Date(request.created_at).toLocaleString('ru-RU')}
                      </div>
                      {request.admin_notes && (
                        <div className="text-sm mt-2 p-2 bg-muted rounded">
                          <strong>Комментарий админа:</strong> {request.admin_notes}
                        </div>
                      )}
                      {request.receipt_url && (
                        <div className="mt-2">
                          <a 
                            href={request.receipt_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm underline"
                          >
                            Посмотреть чек
                          </a>
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

export default SimpleWalletDeposit;
