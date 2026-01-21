import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Navigation } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Fix default marker icon issue with webpack/vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Custom truck icon
const truckIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/3097/3097180.png",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

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

// Component to recenter map when location changes
const RecenterMap = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  
  return null;
};

export const LiveMap = ({ dealId, carrierName }: LiveMapProps) => {
  const [location, setLocation] = useState<GpsLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <div className="h-64 rounded-b-lg overflow-hidden">
          <MapContainer
            center={[location.latitude, location.longitude]}
            zoom={14}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[location.latitude, location.longitude]} icon={truckIcon}>
              <Popup>
                <div className="text-center">
                  <p className="font-medium">{carrierName || "Перевозчик"}</p>
                  <p className="text-xs text-muted-foreground">
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </p>
                </div>
              </Popup>
            </Marker>
            <RecenterMap lat={location.latitude} lng={location.longitude} />
          </MapContainer>
        </div>
      </CardContent>
    </Card>
  );
};
