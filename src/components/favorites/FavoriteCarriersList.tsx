import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Star, Loader2, User, Truck, Building2, Phone, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
interface FavoriteCarrier {
  id: string;
  carrier_id: string;
  created_at: string;
  profile: {
    user_id: string;
    full_name: string | null;
    avatar_url: string | null;
    phone: string | null;
    carrier_type: "driver" | "company" | null;
    company_name: string | null;
    vehicle_type: string | null;
    is_verified: boolean | null;
  };
  avg_rating: number;
  completed_deals: number;
}
export const FavoriteCarriersList = () => {
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<FavoriteCarrier[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (user) {
      fetchFavorites();
    }
  }, [user]);
  const fetchFavorites = async () => {
    setLoading(true);

    // Get favorites
    const {
      data: favData,
      error
    } = await supabase.from("favorite_carriers").select("id, carrier_id, created_at").eq("client_id", user!.id).order("created_at", {
      ascending: false
    });
    if (error || !favData?.length) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    // Get carrier profiles
    const carrierIds = favData.map(f => f.carrier_id);
    const {
      data: profiles
    } = await supabase.from("profiles").select("user_id, full_name, avatar_url, phone, carrier_type, company_name, vehicle_type, is_verified").in("user_id", carrierIds);

    // Get ratings for each carrier
    const enrichedFavorites: FavoriteCarrier[] = await Promise.all(favData.map(async fav => {
      const profile = profiles?.find(p => p.user_id === fav.carrier_id);

      // Get average rating
      const {
        data: ratings
      } = await supabase.from("ratings").select("score").eq("rated_id", fav.carrier_id);
      const avgRating = ratings?.length ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length : 0;

      // Get completed deals count
      const {
        count: dealsCount
      } = await supabase.from("deals").select("id", {
        count: "exact",
        head: true
      }).eq("carrier_id", fav.carrier_id).eq("status", "delivered");
      return {
        id: fav.id,
        carrier_id: fav.carrier_id,
        created_at: fav.created_at,
        profile: profile || {
          user_id: fav.carrier_id,
          full_name: null,
          avatar_url: null,
          phone: null,
          carrier_type: null,
          company_name: null,
          vehicle_type: null,
          is_verified: null
        },
        avg_rating: avgRating,
        completed_deals: dealsCount || 0
      };
    }));
    setFavorites(enrichedFavorites);
    setLoading(false);
  };
  const removeFavorite = async (favoriteId: string) => {
    const {
      error
    } = await supabase.from("favorite_carriers").delete().eq("id", favoriteId);
    if (!error) {
      setFavorites(prev => prev.filter(f => f.id !== favoriteId));
      toast({
        title: "Перевозчик удалён из избранного"
      });
    }
  };
  if (loading) {
    return <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            Избранные перевозчики
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>;
  }
  return <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-red-500" />
          Избранные перевозчики
        </CardTitle>
        <CardDescription>
          Быстрый доступ к проверенным перевозчикам
        </CardDescription>
      </CardHeader>
      <CardContent>
        {favorites.length === 0 ? <div className="text-center py-8 text-muted-foreground">
            <Heart className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>У вас пока нет избранных перевозчиков</p>
            <p className="text-sm mt-1">
              Добавляйте перевозчиков после успешных сделок
            </p>
          </div> : <div className="space-y-4">
            {favorites.map(fav => <div key={fav.id} className="items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors flex flex-row">
                <Avatar className="h-12 w-12 cursor-pointer" onClick={() => navigate(`/profile/${fav.carrier_id}`)}>
                  <AvatarImage src={fav.profile.avatar_url || undefined} />
                  <AvatarFallback>
                    <User className="h-6 w-6" />
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate cursor-pointer hover:underline" onClick={() => navigate(`/profile/${fav.carrier_id}`)}>
                      {fav.profile.full_name || "Без имени"}
                    </span>
                    {fav.profile.is_verified && <Badge variant="secondary" className="text-xs">
                        Проверен
                      </Badge>}
                  </div>

                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    {fav.profile.carrier_type === "company" ? <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {fav.profile.company_name || "Компания"}
                      </span> : <span className="flex items-center gap-1">
                        <Truck className="h-3 w-3" />
                        {fav.profile.vehicle_type || "Водитель"}
                      </span>}

                    {fav.avg_rating > 0 && <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        {fav.avg_rating.toFixed(1)}
                      </span>}

                    <span>{fav.completed_deals} сделок</span>
                  </div>
                </div>

                {fav.profile.phone && <Button variant="outline" size="sm" asChild>
                    <a href={`tel:${fav.profile.phone}`}>
                      <Phone className="h-4 w-4 mr-2" />
                      Позвонить
                    </a>
                  </Button>}

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Удалить из избранного?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Перевозчик будет удалён из вашего списка избранных.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                      <AlertDialogAction onClick={() => removeFavorite(fav.id)}>
                        Удалить
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>)}
          </div>}
      </CardContent>
    </Card>;
};