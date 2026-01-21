import { useState, useRef } from "react";
import { Camera, Loader2, Save, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Profile {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  company_name: string | null;
  vehicle_type: string | null;
  avatar_url: string | null;
}

interface ProfileEditFormProps {
  profile: Profile;
  isCarrier: boolean;
  onUpdate: () => void;
  onCancel: () => void;
}

export const ProfileEditForm = ({
  profile,
  isCarrier,
  onUpdate,
  onCancel,
}: ProfileEditFormProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    full_name: profile.full_name || "",
    phone: profile.phone || "",
    company_name: profile.company_name || "",
    vehicle_type: profile.vehicle_type || "",
  });
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Неверный формат",
        description: "Пожалуйста, выберите изображение",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Файл слишком большой",
        description: "Максимальный размер файла — 5 МБ",
        variant: "destructive",
      });
      return;
    }

    setUploadingAvatar(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${profile.user_id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(newUrl);

      // Update profile
      await supabase
        .from("profiles")
        .update({ avatar_url: newUrl })
        .eq("user_id", profile.user_id);

      toast({
        title: "Аватар обновлён",
        description: "Новое фото профиля сохранено",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить изображение",
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: formData.full_name.trim() || null,
        phone: formData.phone.trim() || null,
        company_name: formData.company_name.trim() || null,
        vehicle_type: formData.vehicle_type.trim() || null,
      })
      .eq("user_id", profile.user_id);

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить изменения",
        variant: "destructive",
      });
      console.error("Update error:", error);
    } else {
      toast({
        title: "Профиль обновлён",
        description: "Изменения успешно сохранены",
      });
      onUpdate();
    }

    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          Редактирование профиля
        </CardTitle>
        <CardDescription>
          Обновите информацию о себе
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar
                className="w-24 h-24 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={handleAvatarClick}
              >
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {formData.full_name?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={handleAvatarClick}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {uploadingAvatar ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Нажмите для загрузки фото
            </p>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="full_name">Имя</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="Ваше имя"
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Телефон</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+7 (999) 123-45-67"
            />
          </div>

          {/* Company (for carriers) */}
          {isCarrier && (
            <>
              <div className="space-y-2">
                <Label htmlFor="company_name">Название компании</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="ООО Логистика"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicle_type">Тип транспорта</Label>
                <Textarea
                  id="vehicle_type"
                  value={formData.vehicle_type}
                  onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                  placeholder="Газель, грузоподъёмность 1.5 тонны"
                  rows={2}
                />
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Сохранить
                </>
              )}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
              Отмена
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
