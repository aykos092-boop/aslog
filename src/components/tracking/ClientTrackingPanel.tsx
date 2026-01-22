import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LiveMap } from "./LiveMap";
import { 
  Loader2, 
  Package, 
  MapPin, 
  Clock, 
  Truck,
  CheckCircle,
  Navigation,
  Phone,
  MessageSquare
} from "lucide-react";
import { format } from "date-fns";
import { ru, enUS } from "date-fns/locale";

interface Deal {
  id: string;
  status: string;
  agreed_price: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  carrier_id: string;
  order?: {
    pickup_address: string;
    delivery_address: string;
    cargo_type: string;
    weight: number;
  };
  carrier_profile?: {
    full_name: string | null;
    phone: string | null;
  };
}

interface GpsLocation {
  latitude: number;
  longitude: number;
  recorded_at: string;
}

const statusConfig = {
  pending: { label: "Ожидание", color: "bg-yellow-100 text-yellow-700", progress: 10 },
  accepted: { label: "Принят", color: "bg-blue-100 text-blue-700", progress: 25 },
  in_transit: { label: "В пути", color: "bg-purple-100 text-purple-700", progress: 60 },
  delivered: { label: "Доставлен", color: "bg-green-100 text-green-700", progress: 100 },
  cancelled: { label: "Отменён", color: "bg-red-100 text-red-700", progress: 0 },
};

interface ClientTrackingPanelProps {
  dealId: string;
}

export const ClientTrackingPanel = ({ dealId }: ClientTrackingPanelProps) => {
  const { t, language } = useLanguage();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [latestLocation, setLatestLocation] = useState<GpsLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lon: number } | undefined>();
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lon: number } | undefined>();

  // Fetch deal data
  useEffect(() => {
    const fetchDeal = async () => {
      const { data, error } = await supabase
        .from("deals")
        .select(`
          *,
          order:orders!order_id (
            pickup_address,
            delivery_address,
            cargo_type,
            weight
          )
        `)
        .eq("id", dealId)
        .single();

      if (error) {
        console.error("Error fetching deal:", error);
        setLoading(false);
        return;
      }

      // Create deal object with proper typing
      const dealData: Deal = {
        ...data,
        order: data.order,
        carrier_profile: undefined,
      };

      // Fetch carrier profile
      if (data.carrier_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("user_id", data.carrier_id)
          .single();

        dealData.carrier_profile = profile || undefined;
      }

      setDeal(dealData);
      setLoading(false);

      // Geocode addresses
      if (dealData.order?.pickup_address) {
        geocodeAddress(dealData.order.pickup_address).then(coords => {
          if (coords) setPickupCoords({ lat: coords.lat, lon: coords.lng });
        });
      }
      if (dealData.order?.delivery_address) {
        geocodeAddress(dealData.order.delivery_address).then(coords => {
          if (coords) setDeliveryCoords({ lat: coords.lat, lon: coords.lng });
        });
      }
    };

    fetchDeal();

    // Subscribe to deal updates
    const channel = supabase
      .channel(`deal-${dealId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "deals",
          filter: `id=eq.${dealId}`,
        },
        (payload) => {
          setDeal(prev => prev ? { ...prev, ...payload.new } : null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dealId]);

  // Fetch latest GPS location
  useEffect(() => {
    const fetchLocation = async () => {
      const { data } = await supabase
        .from("gps_locations")
        .select("latitude, longitude, recorded_at")
        .eq("deal_id", dealId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setLatestLocation({
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          recorded_at: data.recorded_at,
        });
      }
    };

    fetchLocation();

    // Subscribe to GPS updates
    const channel = supabase
      .channel(`gps-client-${dealId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "gps_locations",
          filter: `deal_id=eq.${dealId}`,
        },
        (payload) => {
          setLatestLocation({
            latitude: Number(payload.new.latitude),
            longitude: Number(payload.new.longitude),
            recorded_at: payload.new.recorded_at,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dealId]);

  const geocodeAddress = async (address: string) => {
    try {
      const { data } = await supabase.functions.invoke("geocode", {
        body: { address },
      });
      return data?.lat && data?.lng ? { lat: data.lat, lng: data.lng } : null;
    } catch {
      return null;
    }
  };

  // Calculate ETA and progress
  const trackingInfo = useMemo(() => {
    if (!latestLocation || !deliveryCoords) return null;

    const distance = calculateDistance(
      latestLocation.latitude,
      latestLocation.longitude,
      deliveryCoords.lat,
      deliveryCoords.lon
    );

    const etaMinutes = Math.round((distance * 1.3) / 60 * 60); // 60 km/h average
    const etaTime = new Date(Date.now() + etaMinutes * 60000);

    // Calculate progress (simplified)
    let progress = 0;
    if (deal?.status === "pending") progress = 10;
    else if (deal?.status === "accepted") progress = 25;
    else if (deal?.status === "in_transit") {
      // Calculate based on distance traveled
      progress = Math.min(90, 25 + (1 - distance / 100) * 65);
    } else if (deal?.status === "delivered") progress = 100;

    return {
      remainingKm: Math.round(distance * 1.3),
      etaMinutes,
      etaTime,
      progress: Math.round(progress),
    };
  }, [latestLocation, deliveryCoords, deal?.status]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!deal) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Заказ не найден
        </CardContent>
      </Card>
    );
  }

  const status = statusConfig[deal.status as keyof typeof statusConfig] || statusConfig.pending;
  const locale = language === "ru" ? ru : enUS;

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="w-5 h-5" />
              {t("orders.tracking")}
            </CardTitle>
            <Badge className={status.color}>{status.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("orders.deliveryProgress")}</span>
              <span className="font-medium">{trackingInfo?.progress || status.progress}%</span>
            </div>
            <Progress value={trackingInfo?.progress || status.progress} className="h-2" />
          </div>

          {/* Status Timeline */}
          <div className="flex justify-between text-xs">
            <div className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                ["pending", "accepted", "in_transit", "delivered"].includes(deal.status)
                  ? "bg-green-100 text-green-700"
                  : "bg-muted"
              }`}>
                <Package className="w-3 h-3" />
              </div>
              <span className="mt-1 text-muted-foreground">Создан</span>
            </div>
            <div className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                ["accepted", "in_transit", "delivered"].includes(deal.status)
                  ? "bg-green-100 text-green-700"
                  : "bg-muted"
              }`}>
                <CheckCircle className="w-3 h-3" />
              </div>
              <span className="mt-1 text-muted-foreground">Принят</span>
            </div>
            <div className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                ["in_transit", "delivered"].includes(deal.status)
                  ? "bg-green-100 text-green-700"
                  : "bg-muted"
              }`}>
                <Truck className="w-3 h-3" />
              </div>
              <span className="mt-1 text-muted-foreground">В пути</span>
            </div>
            <div className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                deal.status === "delivered"
                  ? "bg-green-100 text-green-700"
                  : "bg-muted"
              }`}>
                <MapPin className="w-3 h-3" />
              </div>
              <span className="mt-1 text-muted-foreground">Доставлен</span>
            </div>
          </div>

          {/* ETA Info */}
          {deal.status === "in_transit" && trackingInfo && (
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-card p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Navigation className="w-4 h-4" />
                  <span className="text-xs">{t("calculator.distance")}</span>
                </div>
                <p className="font-bold">{trackingInfo.remainingKm} км</p>
              </div>
              <div className="glass-card p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs">ETA</span>
                </div>
                <p className="font-bold">
                  ~{trackingInfo.etaMinutes < 60 
                    ? `${trackingInfo.etaMinutes} мин` 
                    : `${Math.floor(trackingInfo.etaMinutes / 60)} ч ${trackingInfo.etaMinutes % 60} мин`}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Driver Info Card */}
      {deal.carrier_profile && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-driver/10 flex items-center justify-center">
                <Truck className="w-6 h-6 text-driver" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{deal.carrier_profile.full_name || t("role.carrier")}</p>
                <p className="text-sm text-muted-foreground">{t("role.carrier")}</p>
              </div>
              <div className="flex gap-2">
                {deal.carrier_profile.phone && (
                  <Button size="icon" variant="outline" asChild>
                    <a href={`tel:${deal.carrier_profile.phone}`}>
                      <Phone className="w-4 h-4" />
                    </a>
                  </Button>
                )}
                <Button size="icon" variant="outline" asChild>
                  <a href={`/deals/${dealId}/chat`}>
                    <MessageSquare className="w-4 h-4" />
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live Map */}
      <LiveMap
        dealId={dealId}
        carrierName={deal.carrier_profile?.full_name || undefined}
        pickupCoords={pickupCoords}
        deliveryCoords={deliveryCoords}
      />

      {/* Route Info */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 text-green-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("orders.pickup")}</p>
              <p className="text-sm font-medium">{deal.order?.pickup_address}</p>
            </div>
          </div>
          <div className="ml-4 border-l-2 border-dashed border-muted h-6" />
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-red-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("orders.delivery")}</p>
              <p className="text-sm font-medium">{deal.order?.delivery_address}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Helper function
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
