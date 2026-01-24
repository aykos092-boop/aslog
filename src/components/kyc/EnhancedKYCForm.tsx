import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, Upload, Camera, FileCheck, AlertCircle, CheckCircle, 
  XCircle, Clock, User, Shield, Scan, Brain, Eye
} from "lucide-react";

interface KYCDocument {
  id: string;
  passport_front_url: string | null;
  passport_back_url: string | null;
  selfie_url: string | null;
  video_selfie_url: string | null;
  status: 'not_started' | 'pending' | 'verified' | 'rejected' | 'manual_review';
  rejection_reason: string | null;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  date_of_birth: string | null;
  passport_series: string | null;
  passport_number: string | null;
  passport_country: string | null;
  passport_expiry: string | null;
  address: string | null;
  ocr_extracted_name: string | null;
  ocr_extracted_surname: string | null;
  ocr_extracted_passport_number: string | null;
  ocr_confidence: number | null;
  data_match_score: number | null;
  fraud_score?: number | null;
  risk_level?: string | null;
  auto_verified?: boolean | null;
  created_at: string;
  updated_at: string;
}

const statusConfig = {
  not_started: { label: "Не начато", icon: Clock, color: "bg-gray-100 text-gray-700" },
  pending: { label: "На проверке", icon: Clock, color: "bg-yellow-100 text-yellow-700" },
  verified: { label: "Подтверждено", icon: CheckCircle, color: "bg-green-100 text-green-700" },
  rejected: { label: "Отклонено", icon: XCircle, color: "bg-red-100 text-red-700" },
  manual_review: { label: "Ручная проверка", icon: AlertCircle, color: "bg-blue-100 text-blue-700" },
};

const COUNTRIES = [
  { code: 'UZ', name: 'Узбекистан' },
  { code: 'KZ', name: 'Казахстан' },
  { code: 'RU', name: 'Россия' },
  { code: 'KG', name: 'Кыргызстан' },
  { code: 'TJ', name: 'Таджикистан' },
];

export const EnhancedKYCForm = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const [kycDoc, setKycDoc] = useState<KYCDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");

  // Form data
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    dateOfBirth: '',
    passportSeries: '',
    passportNumber: '',
    passportCountry: 'UZ',
    passportExpiry: '',
    address: '',
  });

  // File URLs
  const [passportFront, setPassportFront] = useState<string | null>(null);
  const [passportBack, setPassportBack] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);

  useEffect(() => {
    fetchKYCDocument();
  }, [user]);

  const fetchKYCDocument = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("kyc_documents")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setKycDoc(data as unknown as KYCDocument);
      setPassportFront(data.passport_front_url);
      setPassportBack(data.passport_back_url);
      setSelfie(data.selfie_url);
      setFormData({
        firstName: data.first_name || '',
        lastName: data.last_name || '',
        middleName: data.middle_name || '',
        dateOfBirth: data.date_of_birth || '',
        passportSeries: data.passport_series || '',
        passportNumber: data.passport_number || '',
        passportCountry: data.passport_country || 'UZ',
        passportExpiry: data.passport_expiry || '',
        address: data.address || '',
      });
    }
    setLoading(false);
  };

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'passport_front' | 'passport_back' | 'selfie'
  ) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: "Ошибка", description: "Пожалуйста, загрузите изображение", variant: "destructive" });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Ошибка", description: "Файл слишком большой (максимум 10 МБ)", variant: "destructive" });
      return;
    }

    setUploading(type);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${type}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("kyc-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("kyc-documents")
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      if (type === 'passport_front') setPassportFront(publicUrl);
      else if (type === 'passport_back') setPassportBack(publicUrl);
      else if (type === 'selfie') setSelfie(publicUrl);

      toast({ title: "Загружено", description: "Файл успешно загружен" });
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "Ошибка загрузки", description: "Не удалось загрузить файл", variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  const runAIVerification = async (docId: string) => {
    if (!passportFront) return;

    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('kyc-ai-verify', {
        body: {
          kycDocumentId: docId,
          passportImageUrl: passportFront,
          userInput: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            dateOfBirth: formData.dateOfBirth,
            passportNumber: formData.passportNumber,
          },
        },
      });

      if (error) throw error;

      if (data.success) {
        const result = data.result;
        
        toast({
          title: result.autoVerified ? "Автоматически подтверждено!" : "Проверка завершена",
          description: result.autoVerified 
            ? "Ваши документы успешно верифицированы" 
            : `Уровень риска: ${result.riskLevel}. Документы будут проверены вручную.`,
          variant: result.autoVerified ? "default" : "default",
        });

        fetchKYCDocument();
      }
    } catch (error: any) {
      console.error("AI verification error:", error);
      toast({ 
        title: "Ошибка AI проверки", 
        description: error.message || "Не удалось выполнить проверку",
        variant: "destructive" 
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmitVerification = async () => {
    if (!user) return;

    if (!passportFront || !selfie) {
      toast({ title: "Недостаточно документов", description: "Загрузите паспорт и селфи", variant: "destructive" });
      return;
    }

    if (!formData.firstName || !formData.lastName || !formData.dateOfBirth || !formData.passportNumber) {
      toast({ title: "Заполните данные", description: "Все обязательные поля должны быть заполнены", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      const docData = {
        user_id: user.id,
        passport_front_url: passportFront,
        passport_back_url: passportBack,
        selfie_url: selfie,
        first_name: formData.firstName,
        last_name: formData.lastName,
        middle_name: formData.middleName || null,
        date_of_birth: formData.dateOfBirth,
        passport_series: formData.passportSeries || null,
        passport_number: formData.passportNumber,
        passport_country: formData.passportCountry,
        passport_expiry: formData.passportExpiry || null,
        address: formData.address || null,
        status: 'pending' as const,
      };

      let docId: string;

      if (kycDoc) {
        const { error } = await supabase
          .from("kyc_documents")
          .update(docData)
          .eq("id", kycDoc.id);
        if (error) throw error;
        docId = kycDoc.id;
      } else {
        const { data, error } = await supabase
          .from("kyc_documents")
          .insert(docData)
          .select()
          .single();
        if (error) throw error;
        docId = data.id;
      }

      toast({ title: "Документы сохранены", description: "Запускаем AI проверку..." });

      // Run AI verification
      await runAIVerification(docId);

    } catch (error) {
      console.error("Submit error:", error);
      toast({ title: "Ошибка", description: "Не удалось отправить документы", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        </CardContent>
      </Card>
    );
  }

  const status = kycDoc?.status ? statusConfig[kycDoc.status] : statusConfig.not_started;
  const StatusIcon = status.icon;
  const canEdit = !kycDoc?.status || kycDoc.status === 'not_started' || kycDoc.status === 'rejected';
  
  const docsComplete = [passportFront, selfie].filter(Boolean).length;
  const dataComplete = [formData.firstName, formData.lastName, formData.dateOfBirth, formData.passportNumber].filter(Boolean).length;
  const completionPercent = ((docsComplete / 2) * 50) + ((dataComplete / 4) * 50);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            KYC Верификация
          </CardTitle>
          <div className="flex items-center gap-2">
            {kycDoc?.auto_verified && (
              <Badge className="bg-green-100 text-green-700">
                <Brain className="w-3 h-3 mr-1" />
                AI Verified
              </Badge>
            )}
            <Badge className={status.color}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {status.label}
            </Badge>
          </div>
        </div>
        <CardDescription>
          Подтвердите вашу личность для полного доступа к платформе
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Прогресс заполнения</span>
            <span className="font-medium">{Math.round(completionPercent)}%</span>
          </div>
          <Progress value={completionPercent} className="h-2" />
        </div>

        {/* AI Verification Results */}
        {kycDoc?.ocr_confidence && (
          <div className="p-4 rounded-lg bg-muted/50 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Brain className="w-4 h-4" />
              Результаты AI проверки
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">OCR точность</span>
                <p className="font-medium">{Math.round((kycDoc.ocr_confidence || 0) * 100)}%</p>
              </div>
              <div>
                <span className="text-muted-foreground">Совпадение данных</span>
                <p className="font-medium">{Math.round((kycDoc.data_match_score || 0) * 100)}%</p>
              </div>
              <div>
                <span className="text-muted-foreground">Fraud Score</span>
                <p className="font-medium">{kycDoc.fraud_score || 0}/100</p>
              </div>
              <div>
                <span className="text-muted-foreground">Уровень риска</span>
                <Badge variant={kycDoc.risk_level === 'low' ? 'default' : kycDoc.risk_level === 'high' ? 'destructive' : 'secondary'}>
                  {kycDoc.risk_level}
                </Badge>
              </div>
            </div>
            {kycDoc.ocr_extracted_name && (
              <div className="text-sm">
                <span className="text-muted-foreground">Извлечено: </span>
                <span className="font-medium">{kycDoc.ocr_extracted_name} {kycDoc.ocr_extracted_surname}</span>
              </div>
            )}
          </div>
        )}

        {/* Rejection reason */}
        {kycDoc?.status === 'rejected' && kycDoc.rejection_reason && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-sm">Причина отклонения:</p>
              <p className="text-sm">{kycDoc.rejection_reason}</p>
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="personal">
              <User className="w-4 h-4 mr-2" />
              Данные
            </TabsTrigger>
            <TabsTrigger value="documents">
              <FileCheck className="w-4 h-4 mr-2" />
              Документы
            </TabsTrigger>
            <TabsTrigger value="selfie">
              <Camera className="w-4 h-4 mr-2" />
              Селфи
            </TabsTrigger>
          </TabsList>

          {/* Personal Data Tab */}
          <TabsContent value="personal" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lastName">Фамилия *</Label>
                <Input
                  id="lastName"
                  placeholder="Иванов"
                  value={formData.lastName}
                  onChange={(e) => updateFormData('lastName', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstName">Имя *</Label>
                <Input
                  id="firstName"
                  placeholder="Иван"
                  value={formData.firstName}
                  onChange={(e) => updateFormData('firstName', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="middleName">Отчество</Label>
                <Input
                  id="middleName"
                  placeholder="Иванович"
                  value={formData.middleName}
                  onChange={(e) => updateFormData('middleName', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Дата рождения *</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => updateFormData('dateOfBirth', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passportSeries">Серия паспорта</Label>
                <Input
                  id="passportSeries"
                  placeholder="AA"
                  value={formData.passportSeries}
                  onChange={(e) => updateFormData('passportSeries', e.target.value.toUpperCase())}
                  maxLength={2}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passportNumber">Номер паспорта *</Label>
                <Input
                  id="passportNumber"
                  placeholder="1234567"
                  value={formData.passportNumber}
                  onChange={(e) => updateFormData('passportNumber', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passportCountry">Страна выдачи</Label>
                <Select 
                  value={formData.passportCountry} 
                  onValueChange={(v) => updateFormData('passportCountry', v)}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map(c => (
                      <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="passportExpiry">Срок действия</Label>
                <Input
                  id="passportExpiry"
                  type="date"
                  value={formData.passportExpiry}
                  onChange={(e) => updateFormData('passportExpiry', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Адрес проживания</Label>
              <Input
                id="address"
                placeholder="г. Ташкент, ул. Навои, д. 1"
                value={formData.address}
                onChange={(e) => updateFormData('address', e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-4">
            {/* Passport Front */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileCheck className="w-4 h-4" />
                Паспорт (лицевая сторона) *
              </Label>
              <div className={`relative border-2 border-dashed rounded-xl p-4 text-center ${
                passportFront ? 'border-green-300 bg-green-50/50' : 'border-border hover:border-primary/50'
              } ${!canEdit ? 'opacity-60 pointer-events-none' : ''}`}>
                {passportFront ? (
                  <div className="space-y-2">
                    <img 
                      src={passportFront} 
                      alt="Passport front" 
                      className="max-h-40 mx-auto rounded-lg object-cover"
                    />
                    {canEdit && (
                      <Button variant="ghost" size="sm" onClick={() => setPassportFront(null)}>
                        Изменить
                      </Button>
                    )}
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, 'passport_front')}
                      disabled={uploading === 'passport_front'}
                    />
                    {uploading === 'passport_front' ? (
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                    ) : (
                      <>
                        <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Нажмите для загрузки</p>
                      </>
                    )}
                  </label>
                )}
              </div>
            </div>

            {/* Passport Back */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileCheck className="w-4 h-4" />
                Паспорт (оборотная сторона)
              </Label>
              <div className={`relative border-2 border-dashed rounded-xl p-4 text-center ${
                passportBack ? 'border-green-300 bg-green-50/50' : 'border-border hover:border-primary/50'
              } ${!canEdit ? 'opacity-60 pointer-events-none' : ''}`}>
                {passportBack ? (
                  <div className="space-y-2">
                    <img 
                      src={passportBack} 
                      alt="Passport back" 
                      className="max-h-40 mx-auto rounded-lg object-cover"
                    />
                    {canEdit && (
                      <Button variant="ghost" size="sm" onClick={() => setPassportBack(null)}>
                        Изменить
                      </Button>
                    )}
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, 'passport_back')}
                      disabled={uploading === 'passport_back'}
                    />
                    {uploading === 'passport_back' ? (
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                    ) : (
                      <>
                        <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Нажмите для загрузки (опционально)</p>
                      </>
                    )}
                  </label>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Selfie Tab */}
          <TabsContent value="selfie" className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Селфи с документом *
              </Label>
              <div className={`relative border-2 border-dashed rounded-xl p-6 text-center ${
                selfie ? 'border-green-300 bg-green-50/50' : 'border-border hover:border-primary/50'
              } ${!canEdit ? 'opacity-60 pointer-events-none' : ''}`}>
                {selfie ? (
                  <div className="space-y-2">
                    <img 
                      src={selfie} 
                      alt="Selfie" 
                      className="max-h-48 mx-auto rounded-lg object-cover"
                    />
                    {canEdit && (
                      <Button variant="ghost" size="sm" onClick={() => setSelfie(null)}>
                        Изменить
                      </Button>
                    )}
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <input
                      type="file"
                      accept="image/*"
                      capture="user"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, 'selfie')}
                      disabled={uploading === 'selfie'}
                    />
                    {uploading === 'selfie' ? (
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                    ) : (
                      <>
                        <Camera className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Сделайте селфи с паспортом в руках</p>
                        <p className="text-xs text-muted-foreground mt-1">Лицо и документ должны быть чётко видны</p>
                      </>
                    )}
                  </label>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Submit button */}
        {canEdit && (
          <Button
            className="w-full"
            size="lg"
            onClick={handleSubmitVerification}
            disabled={submitting || verifying || !passportFront || !selfie || !formData.firstName || !formData.lastName}
          >
            {submitting || verifying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {verifying ? "AI проверка..." : "Отправка..."}
              </>
            ) : (
              <>
                <Brain className="w-4 h-4 mr-2" />
                Отправить на AI верификацию
              </>
            )}
          </Button>
        )}

        {/* Status messages */}
        {kycDoc?.status === 'pending' && (
          <div className="p-3 rounded-lg bg-yellow-50 text-yellow-800 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Ваши документы проверяются. Это может занять до 24 часов.</span>
          </div>
        )}

        {kycDoc?.status === 'verified' && (
          <div className="p-3 rounded-lg bg-green-50 text-green-800 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">Ваша личность подтверждена!</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};