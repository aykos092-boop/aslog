import { useState, useEffect } from "react";
import { Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface FavoriteCarrierButtonProps {
  carrierId: string;
  variant?: "icon" | "full";
  className?: string;
}

export const FavoriteCarrierButton = ({
  carrierId,
  variant = "icon",
  className,
}: FavoriteCarrierButtonProps) => {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && role === "client") {
      checkIfFavorite();
    }
  }, [user, carrierId]);

  const checkIfFavorite = async () => {
    const { data } = await supabase
      .from("favorite_carriers")
      .select("id")
      .eq("client_id", user!.id)
      .eq("carrier_id", carrierId)
      .maybeSingle();
    
    setIsFavorite(!!data);
  };

  const toggleFavorite = async () => {
    if (!user) return;
    
    setLoading(true);
    
    if (isFavorite) {
      const { error } = await supabase
        .from("favorite_carriers")
        .delete()
        .eq("client_id", user.id)
        .eq("carrier_id", carrierId);
      
      if (!error) {
        setIsFavorite(false);
        toast({ title: "Перевозчик удалён из избранного" });
      }
    } else {
      const { error } = await supabase
        .from("favorite_carriers")
        .insert({ client_id: user.id, carrier_id: carrierId });
      
      if (!error) {
        setIsFavorite(true);
        toast({ title: "Перевозчик добавлен в избранное" });
      } else {
        toast({ title: "Ошибка", description: error.message, variant: "destructive" });
      }
    }
    
    setLoading(false);
  };

  // Only show for clients
  if (role !== "client") return null;

  if (variant === "icon") {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleFavorite}
        disabled={loading}
        className={cn("h-8 w-8", className)}
        title={isFavorite ? "Удалить из избранного" : "Добавить в избранное"}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Heart
            className={cn(
              "h-4 w-4 transition-colors",
              isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground"
            )}
          />
        )}
      </Button>
    );
  }

  return (
    <Button
      variant={isFavorite ? "secondary" : "outline"}
      size="sm"
      onClick={toggleFavorite}
      disabled={loading}
      className={className}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Heart
          className={cn(
            "h-4 w-4 mr-2",
            isFavorite && "fill-red-500 text-red-500"
          )}
        />
      )}
      {isFavorite ? "В избранном" : "В избранное"}
    </Button>
  );
};
