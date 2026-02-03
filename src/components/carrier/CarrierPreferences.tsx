import { useEffect, useState } from "react";
import { Bell, MapPin, Package, Save, Loader2, Plus, X, Weight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Preferences {
  id?: string;
  carrier_id: string;
  preferred_routes: string[];
  preferred_cargo_types: string[];
  min_weight: number | null;
  max_weight: number | null;
  notify_all: boolean;
}

export const CarrierPreferences = () => {
  const { user } = useFirebaseAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>({
    carrier_id: user?.uid || "",
    preferred_routes: [],
    preferred_cargo_types: [],
    min_weight: null,
    max_weight: null,
    notify_all: true,
  });

  const [newRoute, setNewRoute] = useState("");
  const [newCargoType, setNewCargoType] = useState("");

  useEffect(() => {
    if (user) fetchPreferences();
  }, [user]);

  const fetchPreferences = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("carrier_preferences")
      .select("*")
      .eq("carrier_id", user?.uid || "")
      .single();

    if (data) {
      setPreferences({
        ...data,
        preferred_routes: data.preferred_routes || [],
        preferred_cargo_types: data.preferred_cargo_types || [],
      });
    } else if (!error || error.code === "PGRST116") {
      // No preferences yet, use defaults
      setPreferences(prev => ({ ...prev, carrier_id: user?.uid || "" }));
    }
    setLoading(false);
  };

  const savePreferences = async () => {
    if (!user) return;
    setSaving(true);

    const prefData = {
      carrier_id: user?.uid || "",
      preferred_routes: preferences.preferred_routes,
      preferred_cargo_types: preferences.preferred_cargo_types,
      min_weight: preferences.min_weight,
      max_weight: preferences.max_weight,
      notify_all: preferences.notify_all,
    };

    const { error } = preferences.id
      ? await supabase
          .from("carrier_preferences")
          .update(prefData)
          .eq("id", preferences.id)
      : await supabase.from("carrier_preferences").insert(prefData);

    setSaving(false);

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить настройки",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Настройки сохранены",
        description: "Уведомления будут приходить по вашим предпочтениям",
      });
      fetchPreferences();
    }
  };

  const addRoute = () => {
    if (newRoute.trim() && !preferences.preferred_routes.includes(newRoute.trim())) {
      setPreferences(prev => ({
        ...prev,
        preferred_routes: [...prev.preferred_routes, newRoute.trim()],
      }));
      setNewRoute("");
    }
  };

  const removeRoute = (route: string) => {
    setPreferences(prev => ({
      ...prev,
      preferred_routes: prev.preferred_routes.filter(r => r !== route),
    }));
  };

  const addCargoType = () => {
    if (newCargoType.trim() && !preferences.preferred_cargo_types.includes(newCargoType.trim())) {
      setPreferences(prev => ({
        ...prev,
        preferred_cargo_types: [...prev.preferred_cargo_types, newCargoType.trim()],
      }));
      setNewCargoType("");
    }
  };

  const removeCargoType = (type: string) => {
    setPreferences(prev => ({
      ...prev,
      preferred_cargo_types: prev.preferred_cargo_types.filter(t => t !== type),
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Настройки уведомлений
        </CardTitle>
        <CardDescription>
          Получайте уведомления только о интересных заказах
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Notify All Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
          <div className="space-y-0.5">
            <Label className="text-base">Все заказы</Label>
            <p className="text-sm text-muted-foreground">
              Получать уведомления обо всех новых заказах
            </p>
          </div>
          <Switch
            checked={preferences.notify_all}
            onCheckedChange={(checked) =>
              setPreferences(prev => ({ ...prev, notify_all: checked }))
            }
          />
        </div>

        {!preferences.notify_all && (
          <>
            {/* Preferred Routes */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Предпочтительные города/регионы
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Москва, Санкт-Петербург..."
                  value={newRoute}
                  onChange={(e) => setNewRoute(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRoute())}
                />
                <Button type="button" variant="outline" onClick={addRoute}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {preferences.preferred_routes.map((route) => (
                  <Badge key={route} variant="secondary" className="gap-1">
                    {route}
                    <X
                      className="w-3 h-3 cursor-pointer hover:text-destructive"
                      onClick={() => removeRoute(route)}
                    />
                  </Badge>
                ))}
                {preferences.preferred_routes.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Добавьте города для фильтрации
                  </p>
                )}
              </div>
            </div>

            {/* Preferred Cargo Types */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                Типы груза
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Мебель, Техника, Стройматериалы..."
                  value={newCargoType}
                  onChange={(e) => setNewCargoType(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCargoType())}
                />
                <Button type="button" variant="outline" onClick={addCargoType}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {preferences.preferred_cargo_types.map((type) => (
                  <Badge key={type} variant="secondary" className="gap-1">
                    {type}
                    <X
                      className="w-3 h-3 cursor-pointer hover:text-destructive"
                      onClick={() => removeCargoType(type)}
                    />
                  </Badge>
                ))}
                {preferences.preferred_cargo_types.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Добавьте типы груза для фильтрации
                  </p>
                )}
              </div>
            </div>

            {/* Weight Range */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Weight className="w-4 h-4" />
                Диапазон веса (кг)
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Минимум</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={preferences.min_weight || ""}
                    onChange={(e) =>
                      setPreferences(prev => ({
                        ...prev,
                        min_weight: e.target.value ? parseFloat(e.target.value) : null,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Максимум</Label>
                  <Input
                    type="number"
                    placeholder="∞"
                    value={preferences.max_weight || ""}
                    onChange={(e) =>
                      setPreferences(prev => ({
                        ...prev,
                        max_weight: e.target.value ? parseFloat(e.target.value) : null,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </>
        )}

        <Button onClick={savePreferences} disabled={saving} className="w-full">
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Сохранить настройки
        </Button>
      </CardContent>
    </Card>
  );
};
