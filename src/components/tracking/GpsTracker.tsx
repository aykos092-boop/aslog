import { useState, useEffect, useCallback } from "react";
import { Navigation, Loader2, MapPin, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface GpsTrackerProps {
  dealId: string;
}

export const GpsTracker = ({ dealId }: GpsTrackerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tracking, setTracking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<GeolocationPosition | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [lastSent, setLastSent] = useState<Date | null>(null);

  const sendLocation = useCallback(async (position: GeolocationPosition) => {
    if (!user) return;

    const { error } = await supabase.from("gps_locations").insert({
      deal_id: dealId,
      carrier_id: user.id,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });

    if (error) {
      console.error("Error sending location:", error);
    } else {
      setLastSent(new Date());
    }
  }, [dealId, user]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      toast({
        title: "Ошибка",
        description: "Геолокация не поддерживается вашим браузером",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const id = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentPosition(position);
        sendLocation(position);
        setLoading(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        setLoading(false);
        toast({
          title: "Ошибка геолокации",
          description: error.message,
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );

    setWatchId(id);
    setTracking(true);

    toast({
      title: "GPS-трекинг включён",
      description: "Ваше местоположение передаётся клиенту",
    });
  }, [sendLocation, toast]);

  const stopTracking = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setTracking(false);
    setCurrentPosition(null);

    toast({
      title: "GPS-трекинг выключен",
      description: "Передача координат остановлена",
    });
  }, [watchId, toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  // Send location every 30 seconds while tracking
  useEffect(() => {
    if (!tracking || !currentPosition) return;

    const interval = setInterval(() => {
      if (currentPosition) {
        sendLocation(currentPosition);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [tracking, currentPosition, sendLocation]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Navigation className="w-4 h-4" />
          GPS-трекинг
          {tracking && (
            <Badge className="ml-auto bg-driver text-white">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse mr-1" />
              Активен
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentPosition && (
          <div className="text-sm text-muted-foreground space-y-1">
            <div className="flex items-center gap-2">
              <MapPin className="w-3 h-3" />
              <span>
                {currentPosition.coords.latitude.toFixed(6)}, {currentPosition.coords.longitude.toFixed(6)}
              </span>
            </div>
            {lastSent && (
              <p className="text-xs">
                Последняя отправка: {lastSent.toLocaleTimeString("ru-RU")}
              </p>
            )}
          </div>
        )}

        <Button
          onClick={tracking ? stopTracking : startTracking}
          disabled={loading}
          className="w-full"
          variant={tracking ? "destructive" : "driver"}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : tracking ? (
            <Pause className="w-4 h-4 mr-2" />
          ) : (
            <Play className="w-4 h-4 mr-2" />
          )}
          {loading ? "Получение координат..." : tracking ? "Остановить трекинг" : "Начать трекинг"}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          {tracking
            ? "Координаты обновляются каждые 30 секунд"
            : "Включите, чтобы клиент видел вашу позицию на карте"}
        </p>
      </CardContent>
    </Card>
  );
};
