import { useState, useRef } from "react";
import { ImagePlus, X, Loader2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CargoImageUploadProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
}

export const CargoImageUpload = ({
  images,
  onImagesChange,
  maxImages = 5,
}: CargoImageUploadProps) => {
  const { user } = useFirebaseAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    const remainingSlots = maxImages - images.length;
    const filesToUpload = Array.from(files).slice(0, remainingSlots);

    if (filesToUpload.length === 0) {
      toast({
        title: "Лимит достигнут",
        description: `Максимум ${maxImages} фотографий`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    const newUrls: string[] = [];

    for (const file of filesToUpload) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Неверный формат",
          description: `${file.name} не является изображением`,
          variant: "destructive",
        });
        continue;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Файл слишком большой",
          description: `${file.name} превышает 5 МБ`,
          variant: "destructive",
        });
        continue;
      }

      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.uid}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("cargo-images")
        .upload(fileName, file);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast({
          title: "Ошибка загрузки",
          description: uploadError.message,
          variant: "destructive",
        });
        continue;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("cargo-images")
        .getPublicUrl(fileName);

      newUrls.push(urlData.publicUrl);
    }

    if (newUrls.length > 0) {
      onImagesChange([...images, ...newUrls]);
      toast({
        title: "Фото загружены",
        description: `Добавлено ${newUrls.length} фото`,
      });
    }

    setUploading(false);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = async (index: number) => {
    const urlToRemove = images[index];
    
    // Extract file path from URL
    const urlParts = urlToRemove.split("/cargo-images/");
    if (urlParts.length > 1) {
      const filePath = urlParts[1];
      await supabase.storage.from("cargo-images").remove([filePath]);
    }

    onImagesChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {images.map((url, index) => (
            <div
              key={index}
              className="relative aspect-square rounded-lg overflow-hidden border bg-muted group"
            >
              <img
                src={url}
                alt={`Фото груза ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {images.length < maxImages && (
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
            "hover:border-primary hover:bg-primary/5",
            uploading && "pointer-events-none opacity-50"
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            disabled={uploading}
          />
          
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Загрузка...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 rounded-full bg-muted">
                <ImagePlus className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Добавить фото груза</p>
                <p className="text-xs text-muted-foreground">
                  До {maxImages} фото, максимум 5 МБ каждое
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Counter */}
      {images.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ImageIcon className="h-3 w-3" />
          <span>
            {images.length} из {maxImages} фото
          </span>
        </div>
      )}
    </div>
  );
};
