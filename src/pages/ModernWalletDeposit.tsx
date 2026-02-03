import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Wallet, Plus, Upload, CheckCircle, Clock, CreditCard, 
  User, Smartphone, Save, Eye, Globe, Calendar, Shield, TrendingUp,
  AlertCircle, Check, X, Copy, RefreshCw, Edit, Banknote, ArrowRight,
  Sparkles, Zap, Lock, Star, ChevronRight, Info
} from "lucide-react";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BRAND_CONFIG } from "@/config/brand";

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

interface DepositRequest {
  id: string;
  user_id: string;
  amount: number;
  card_number: string;
  card_holder: string;
  description: string;
  receipt_url: string;
  status: 'pending' | 'checking' | 'approved' | 'rejected';
  admin_notes?: string;
  created_at: string;
  updated_at?: string;
  processed_at?: string;
  payment_method_id?: string;
  payment_method?: PaymentMethod;
}

const ModernWalletDeposit = () => {
  const navigate = useNavigate();
  const { user } = useFirebaseAuth();
  const { t, language, setLanguage } = useLanguage();
  const { toast } = useToast();

  const [amount, setAmount] = useState("");
  const [cardNumber, setCardNumber] = useState("5614681812274623");
  const [cardHolder, setCardHolder] = useState("");
  const [description, setDescription] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [myRequests, setMyRequests] = useState<DepositRequest[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [userContacts, setUserContacts] = useState<UserContact | null>(null);
  
  // UI States
  const [showSaveMethodDialog, setShowSaveMethodDialog] = useState(false);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [showUserId, setShowUserId] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  // Form states
  const [newCardNumber, setNewCardNumber] = useState("");
  const [newCardHolder, setNewCardHolder] = useState("");
  const [newBankName, setNewBankName] = useState("");
  const [newCardType, setNewCardType] = useState("humo");
  const [isDefault, setIsDefault] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [telegramUserId, setTelegramUserId] = useState("");

  const quickAmounts = [50000, 100000, 500000, 1000000, 5000000];
  
  const languages = [
    { code: "ru", name: "Русский", flag: "🇷🇺" },
    { code: "en", name: "English", flag: "🇬🇧" },
    { code: "uz", name: "O'zbekcha", flag: "🇺🇿" }
  ];

  // Load data
  useEffect(() => {
    loadUserData();
    loadMyRequests();
  }, []);

  const loadUserData = async () => {
    try {
      // Load payment methods
      const { data: methodsData, error: methodsError } = await supabase
        .from('user_payment_methods')
        .select('*')
        .eq('user_id', user?.uid || "")
        .eq('is_active', true)
        .order('is_default', { ascending: false });

      if (!methodsError && methodsData) {
        setPaymentMethods(methodsData);
      }

      // Load contacts
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
        .from('deposit_requests')
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
        setMyRequests(data as DepositRequest[]);
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

      // Reset form
      setNewCardNumber("");
      setNewCardHolder("");
      setNewBankName("");
      setNewCardType("humo");
      setIsDefault(false);
      setShowSaveMethodDialog(false);
      
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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

  const handleUploadReceipt = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const fileName = `receipts/${user?.uid}/${Date.now()}_${file.name}`;
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, file);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName);

      return urlData.publicUrl;

    } catch (error) {
      console.error('Error uploading receipt:', error);
      throw error;
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
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
      // Upload receipt
      const receiptUrl = await handleUploadReceipt(receiptFile);

      // Create deposit request
      const { data, error } = await supabase
        .from('deposit_requests')
        .insert({
          user_id: user?.uid || "",
          amount: depositAmount,
          card_number: cardNumber,
          card_holder: cardHolder,
          description: `${description}\n\n📞 Телефон: ${phoneNumber || 'Не указан'}\n📱 Telegram: @${telegramUsername || 'Не указан'}\n🆔 UID: ${user?.uid}\n📧 Email: ${user?.email}`,
          receipt_url: receiptUrl,
          status: 'checking'
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

      // Reset form
      setAmount("");
      setCardHolder("");
      setDescription("");
      setReceiptFile(null);
      
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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Скопировано!",
      description: `${label} скопирован в буфер обмена`,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'checking':
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" />На проверке</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Ожидание</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Одобрено</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">Отклонено</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Animated Background Pattern */}
      <div className="fixed inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(59 130 246) 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}></div>
      </div>
      {/* Header */}
      <header className="border-b border-blue-100 bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate(-1)}
                className="hover:bg-blue-50 hover:text-blue-600 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Пополнение баланса</h1>
                  <p className="text-xs text-gray-500">{BRAND_CONFIG.fullName}</p>
                </div>
              </div>
            </div>
            
            {/* Language Selector */}
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-36 border-blue-200 focus:border-blue-400">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    <span className="flex items-center gap-2">
                      <span>{lang.flag}</span>
                      <span>{lang.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* User Info Card */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
            <CardContent className="pt-6 relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-lg">Ваша информация</h3>
                    <p className="text-blue-100 text-sm">Управление профилем</p>
                    <div className="flex items-center gap-2 mt-2">
                      <code className="bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg text-sm font-mono text-blue-100 border border-white/20">
                        {showUserId ? user?.uid : '••••••••••••••••'}
                      </code>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setShowUserId(!showUserId)}
                        className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                      >
                        {showUserId ? 'Скрыть' : 'Показать'}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => copyToClipboard(user?.uid || '', 'ID пользователя')}
                        className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setShowContactDialog(true)} className="bg-white/20 hover:bg-white/30 text-white border-white/30">
                    <Smartphone className="w-4 h-4 mr-1" />
                    Контакты
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setShowSaveMethodDialog(true)} className="bg-white/20 hover:bg-white/30 text-white border-white/30">
                    <Save className="w-4 h-4 mr-1" />
                    Сохранить карту
                  </Button>
                </div>
              </div>
              
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className="w-4 h-4 text-blue-200" />
                    <span className="text-blue-200 font-medium text-sm">Email</span>
                  </div>
                  <div className="text-white text-sm font-medium">{user?.email || 'Не указан'}</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Smartphone className="w-4 h-4 text-blue-200" />
                    <span className="text-blue-200 font-medium text-sm">Телефон</span>
                  </div>
                  <div className="text-white text-sm font-medium">{phoneNumber || 'Не указан'}</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Smartphone className="w-4 h-4 text-blue-200" />
                    <span className="text-blue-200 font-medium text-sm">Telegram</span>
                  </div>
                  <div className="text-white text-sm font-medium">@{telegramUsername || 'Не указан'}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 overflow-hidden">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">Как пополнить баланс</h3>
                  <p className="text-gray-600">Следуйте простой инструкции за 5 шагов</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="group relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl opacity-0 group-hover:opacity-20 transition-opacity blur"></div>
                  <div className="relative bg-white rounded-2xl p-4 border border-emerald-100 hover:border-emerald-300 transition-all">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mx-auto mb-3">
                      <span className="text-white font-bold">1</span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-3 text-center">Переведите деньги</p>
                    <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-3 border border-emerald-200">
                      <div className="font-mono text-xs text-center mb-1">5614 6818 1227 4623</div>
                      <div className="text-xs text-center text-emerald-700 font-medium">{BRAND_CONFIG.name}</div>
                    </div>
                  </div>
                </div>
                
                <div className="group relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl opacity-0 group-hover:opacity-20 transition-opacity blur"></div>
                  <div className="relative bg-white rounded-2xl p-4 border border-emerald-100 hover:border-emerald-300 transition-all">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mx-auto mb-3">
                      <span className="text-white font-bold">2</span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-3 text-center">Сделайте скриншот</p>
                    <div className="w-12 h-12 mx-auto bg-gradient-to-br from-emerald-100 to-green-100 rounded-xl flex items-center justify-center">
                      <Upload className="w-6 h-6 text-emerald-600" />
                    </div>
                  </div>
                </div>
                
                <div className="group relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl opacity-0 group-hover:opacity-20 transition-opacity blur"></div>
                  <div className="relative bg-white rounded-2xl p-4 border border-emerald-100 hover:border-emerald-300 transition-all">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mx-auto mb-3">
                      <span className="text-white font-bold">3</span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-3 text-center">Заполните форму</p>
                    <div className="w-12 h-12 mx-auto bg-gradient-to-br from-emerald-100 to-green-100 rounded-xl flex items-center justify-center">
                      <Edit className="w-6 h-6 text-emerald-600" />
                    </div>
                  </div>
                </div>
                
                <div className="group relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl opacity-0 group-hover:opacity-20 transition-opacity blur"></div>
                  <div className="relative bg-white rounded-2xl p-4 border border-emerald-100 hover:border-emerald-300 transition-all">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mx-auto mb-3">
                      <span className="text-white font-bold">4</span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-3 text-center">Загрузите чек</p>
                    <div className="w-12 h-12 mx-auto bg-gradient-to-br from-emerald-100 to-green-100 rounded-xl flex items-center justify-center">
                      <Upload className="w-6 h-6 text-emerald-600" />
                    </div>
                  </div>
                </div>
                
                <div className="group relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl opacity-0 group-hover:opacity-20 transition-opacity blur"></div>
                  <div className="relative bg-white rounded-2xl p-4 border border-emerald-100 hover:border-emerald-300 transition-all">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mx-auto mb-3">
                      <span className="text-white font-bold">5</span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-3 text-center">Ожидайте проверки</p>
                    <div className="w-12 h-12 mx-auto bg-gradient-to-br from-emerald-100 to-green-100 rounded-xl flex items-center justify-center">
                      <Clock className="w-6 h-6 text-emerald-600" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Saved Cards */}
          {paymentMethods.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Ваши сохраненные карты
                </CardTitle>
                <CardDescription>
                  Быстрый выбор сохраненных карт
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {paymentMethods.map((method) => (
                    <div 
                      key={method.id} 
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        cardNumber === method.card_number 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setCardNumber(method.card_number)}
                    >
                      <div className="flex items-center justify-between">
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
                        {cardNumber === method.card_number && (
                          <Check className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Deposit Form */}
          <Card className="border-blue-200 bg-white">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-r from-blue-100 to-indigo-100 flex items-center justify-center mb-4">
                <Wallet className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle className="text-2xl">Заявка на пополнение</CardTitle>
              <CardDescription>
                Заполните форму и загрузите чек перевода
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-base font-medium">Сумма пополнения (UZS)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Введите сумму"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="10000"
                  step="1000"
                  className="text-lg"
                />
                <div className="grid grid-cols-3 gap-2">
                  {quickAmounts.map((quickAmount) => (
                    <Button
                      key={quickAmount}
                      variant="outline"
                      onClick={() => setAmount(quickAmount.toString())}
                      className="h-12"
                    >
                      {(quickAmount / 1000).toFixed(0)}K
                    </Button>
                  ))}
                </div>
              </div>

              {/* Card Holder */}
              <div className="space-y-2">
                <Label htmlFor="card-holder" className="text-base font-medium">Держатель карты</Label>
                <Input
                  id="card-holder"
                  placeholder="Иванов Иван Иванович"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  className="text-lg"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-base font-medium">Комментарий</Label>
                <Textarea
                  id="description"
                  placeholder="Пополнение баланса для перевозок"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="text-lg"
                />
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label htmlFor="receipt" className="text-base font-medium">Чек перевода *</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                  <input
                    id="receipt"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="receipt" className="cursor-pointer">
                    <div className="space-y-4">
                      {receiptFile ? (
                        <div className="flex items-center justify-center">
                          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                          <p className="text-lg font-medium text-green-700">{receiptFile.name}</p>
                          <p className="text-sm text-gray-500">Нажмите чтобы изменить</p>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                          <p className="text-lg font-medium text-gray-700">Загрузите чек перевода</p>
                          <p className="text-sm text-gray-500">JPG, PNG до 10MB</p>
                        </div>
                      )}
                    </div>
                  </label>
                </div>
                
                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Загрузка...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="w-full" />
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <Button 
                onClick={handleSubmit} 
                className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                size="lg"
                disabled={loading || !amount || !cardHolder || !description || !receiptFile || isUploading}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Отправка...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Отправить заявку {amount && `(${parseInt(amount).toLocaleString()} UZS)`}
                  </div>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Recent Requests */}
          {myRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>История заявок</CardTitle>
                <CardDescription>
                  Ваши последние заявки на пополнение
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {myRequests.slice(0, 5).map((request) => (
                    <div key={request.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="font-semibold text-lg">
                            {request.amount.toLocaleString()} UZS
                          </div>
                          {getStatusBadge(request.status)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(request.created_at).toLocaleString('ru-RU')}
                        </div>
                      </div>
                      {request.description && (
                        <div className="text-sm p-2 bg-gray-50 rounded">
                          <strong>Комментарий:</strong> {request.description}
                        </div>
                      )}
                      {request.admin_notes && (
                        <div className="text-sm mt-2 p-2 bg-blue-50 rounded">
                          <strong>Комментарий админа:</strong> {request.admin_notes}
                        </div>
                      )}
                      {request.receipt_url && (
                        <div className="mt-2">
                          <a 
                            href={request.receipt_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm underline flex items-center gap-1"
                          >
                            <Eye className="w-4 h-4" />
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

      {/* Dialogs */}
      <Dialog open={showSaveMethodDialog} onOpenChange={setShowSaveMethodDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Сохранить карту</DialogTitle>
            <DialogDescription>
              Сохраните вашу карту для быстрого пополнения в будущем
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Form fields */}
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

      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Контактные данные</DialogTitle>
            <DialogDescription>
              Обновите ваши контактные данные для связи
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Form fields */}
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

export default ModernWalletDeposit;
