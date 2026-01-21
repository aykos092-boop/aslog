import { useEffect, useState, useMemo } from "react";
import { Loader2, Navigation, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface GpsLocation {
  id: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
}

interface LiveMapProps {
  dealId: string;
  carrierName?: string;
}

export const LiveMap = ({ dealId, carrierName }: LiveMapProps) => {
  const [location, setLocation] = useState<GpsLocation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLatestLocation = async () => {
      const { data, error } = await supabase
        .from("gps_locations")
        .select("*")
        .eq("deal_id", dealId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching location:", error);
      }

      if (data) {
        setLocation({
          ...data,
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
        });
      }
      setLoading(false);
    };

    fetchLatestLocation();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`gps-${dealId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "gps_locations",
          filter: `deal_id=eq.${dealId}`,
        },
        (payload) => {
          const newLocation = payload.new as any;
          setLocation({
            ...newLocation,
            latitude: Number(newLocation.latitude),
            longitude: Number(newLocation.longitude),
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dealId]);

  // Generate OpenStreetMap static URL
  const mapUrl = useMemo(() => {
    if (!location) return null;
    // Using OpenStreetMap static tile URL with marker
    const zoom = 14;
    const lat = location.latitude;
    const lng = location.longitude;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.02},${lat - 0.015},${lng + 0.02},${lat + 0.015}&layer=mapnik&marker=${lat},${lng}`;
  }, [location]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-2">Загрузка карты...</p>
        </CardContent>
      </Card>
    );
  }

  if (!location) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Navigation className="w-4 h-4" />
            GPS-трекинг
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6 text-muted-foreground">
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Данные о местоположении пока не получены</p>
          <p className="text-xs mt-1">Перевозчик ещё не начал передавать координаты</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Navigation className="w-4 h-4 text-driver" />
          GPS-трекинг
          <span className="ml-auto text-xs text-muted-foreground font-normal">
            Обновлено: {new Date(location.recorded_at).toLocaleTimeString("ru-RU")}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-64 rounded-b-lg overflow-hidden relative">
          <iframe
            title="Карта местоположения"
            src={mapUrl!}
            className="w-full h-full border-0"
            loading="lazy"
          />
          {/* Overlay with carrier info */}
          <div className="absolute bottom-2 left-2 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 text-sm shadow-lg">
            <p className="font-medium">{carrierName || "Перевозчик"}</p>
            <p className="text-xs text-muted-foreground">
              {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
