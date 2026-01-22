import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Upload,
  Camera,
  FileCheck,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Shield
} from "lucide-react";

interface KYCDocument {
  id: string;
  passport_front_url: string | null;
  passport_back_url: string | null;
  selfie_url: string | null;
  status: 'not_started' | 'pending' | 'verified' | 'rejected' | 'manual_review';
  rejection_reason: string | null;
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

export const KYCVerificationForm = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [kycDoc, setKycDoc] = useState<KYCDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Local state for file URLs before saving
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
      setKycDoc(data);
      setPassportFront(data.passport_front_url);
      setPassportBack(data.passport_back_url);
      setSelfie(data.selfie_url);
    }
    setLoading(false);
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'passport_front' | 'passport_back' | 'selfie'
  ) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, загрузите изображение",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Ошибка",
        description: "Файл слишком большой (максимум 10 МБ)",
        variant: "destructive"
      });
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

      // Update local state
      if (type === 'passport_front') setPassportFront(publicUrl);
      else if (type === 'passport_back') setPassportBack(publicUrl);
      else if (type === 'selfie') setSelfie(publicUrl);

      toast({
        title: "Загружено",
        description: "Файл успешно загружен",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить файл",
        variant: "destructive"
      });
    } finally {
      setUploading(null);
    }
  };

  const handleSubmitVerification = async () => {
    if (!user) return;

    if (!passportFront || !selfie) {
      toast({
        title: "Недостаточно документов",
        description: "Загрузите паспорт и селфи",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    try {
      const docData = {
        user_id: user.id,
        passport_front_url: passportFront,
        passport_back_url: passportBack,
        selfie_url: selfie,
        status: 'pending' as const,
      };

      if (kycDoc) {
        // Update existing
        const { error } = await supabase
          .from("kyc_documents")
          .update(docData)
          .eq("id", kycDoc.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from("kyc_documents")
          .insert(docData);

        if (error) throw error;
      }

      toast({
        title: "Отправлено на проверку",
        description: "Ваши документы будут проверены в течение 24 часов",
      });

      fetchKYCDocument();
    } catch (error) {
      console.error("Submit error:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось отправить документы",
        variant: "destructive"
      });
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
  const completionPercent = [passportFront, passportBack, selfie].filter(Boolean).length / 3 * 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            KYC Верификация
          </CardTitle>
          <Badge className={status.color}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {status.label}
          </Badge>
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

        {/* Document uploads */}
        <div className="grid gap-4">
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
                    className="max-h-32 mx-auto rounded-lg object-cover"
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
                    className="max-h-32 mx-auto rounded-lg object-cover"
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
                      <p className="text-sm text-muted-foreground">Нажмите для загрузки</p>
                    </>
                  )}
                </label>
              )}
            </div>
          </div>

          {/* Selfie */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Селфи с документом *
            </Label>
            <div className={`relative border-2 border-dashed rounded-xl p-4 text-center ${
              selfie ? 'border-green-300 bg-green-50/50' : 'border-border hover:border-primary/50'
            } ${!canEdit ? 'opacity-60 pointer-events-none' : ''}`}>
              {selfie ? (
                <div className="space-y-2">
                  <img 
                    src={selfie} 
                    alt="Selfie" 
                    className="max-h-32 mx-auto rounded-lg object-cover"
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
                      <Camera className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Сделайте селфи с паспортом</p>
                    </>
                  )}
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Submit button */}
        {canEdit && (
          <Button
            className="w-full"
            size="lg"
            onClick={handleSubmitVerification}
            disabled={submitting || !passportFront || !selfie}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Отправка...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 mr-2" />
                Отправить на верификацию
              </>
            )}
          </Button>
        )}

        {/* Status message */}
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
