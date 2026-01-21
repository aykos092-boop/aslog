import { useEffect, useState, useRef, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, Navigation, MapPin, Route, Clock, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

interface GpsLocation {
  id: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
}

interface LiveMapProps {
  dealId: string;
  carrierName?: string;
  pickupCoords?: { lat: number; lon: number };
  deliveryCoords?: { lat: number; lon: number };
}

// Calculate distance between two points
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Estimate time at 60 km/h
const estimateTime = (distanceKm: number): string => {
  const hours = Math.floor(distanceKm / 60);
  const minutes = Math.round((distanceKm % 60));
  if (hours === 0) return `${minutes} мин`;
  if (minutes === 0) return `${hours} ч`;
  return `${hours} ч ${minutes} мин`;
};

export const LiveMap = ({ dealId, carrierName, pickupCoords, deliveryCoords }: LiveMapProps) => {
  const { t } = useLanguage();
  const [location, setLocation] = useState<GpsLocation | null>(null);
  const [locationHistory, setLocationHistory] = useState<GpsLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const pathRef = useRef<L.Polyline | null>(null);

  // Calculate remaining distance and ETA
  const routeInfo = useMemo(() => {
    if (!location || !deliveryCoords) return null;
    const remainingDistance = calculateDistance(
      location.latitude, 
      location.longitude, 
      deliveryCoords.lat, 
      deliveryCoords.lon
    );
    return {
      remainingKm: Math.round(remainingDistance * 1.3), // Road distance factor
      eta: estimateTime(remainingDistance * 1.3),
    };
  }, [location, deliveryCoords]);

  useEffect(() => {
    const fetchLocations = async () => {
      const { data, error } = await supabase
        .from("gps_locations")
        .select("*")
        .eq("deal_id", dealId)
        .order("recorded_at", { ascending: true });

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching locations:", error);
      }

      if (data && data.length > 0) {
        const formattedData = data.map(d => ({
          ...d,
          latitude: Number(d.latitude),
          longitude: Number(d.longitude),
        }));
        setLocationHistory(formattedData);
        setLocation(formattedData[formattedData.length - 1]);
      }
      setLoading(false);
    };

    fetchLocations();

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
          const formatted = {
            ...newLocation,
            latitude: Number(newLocation.latitude),
            longitude: Number(newLocation.longitude),
          };
          setLocation(formatted);
          setLocationHistory(prev => [...prev, formatted]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dealId]);

  // Initialize and update map
  useEffect(() => {
    if (!mapContainerRef.current || loading) return;

    // Initialize map
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: false,
      }).setView([41.3, 64.5], 10);

      // Apple-style map tiles
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;

    // Clear existing layers except base tile
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.CircleMarker) {
        map.removeLayer(layer);
      }
    });

    // Add pickup marker
    if (pickupCoords) {
      const pickupIcon = L.divIcon({
        className: "pickup-marker",
        html: `
          <div style="
            width: 36px;
            height: 36px;
            background: linear-gradient(135deg, #34c759, #30d158);
            border-radius: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 15px rgba(52, 199, 89, 0.4);
            border: 3px solid white;
            font-size: 16px;
          ">📦</div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      L.marker([pickupCoords.lat, pickupCoords.lon], { icon: pickupIcon }).addTo(map);
    }

    // Add delivery marker
    if (deliveryCoords) {
      const deliveryIcon = L.divIcon({
        className: "delivery-marker",
        html: `
          <div style="
            width: 36px;
            height: 36px;
            background: linear-gradient(135deg, #ff3b30, #ff453a);
            border-radius: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 15px rgba(255, 59, 48, 0.4);
            border: 3px solid white;
            font-size: 16px;
          ">🏁</div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      L.marker([deliveryCoords.lat, deliveryCoords.lon], { icon: deliveryIcon }).addTo(map);
    }

    // Draw planned route (if both coordinates are available)
    if (pickupCoords && deliveryCoords) {
      const routePoints: L.LatLngExpression[] = [];
      const steps = 50;
      const midLat = (pickupCoords.lat + deliveryCoords.lat) / 2;
      const midLon = (pickupCoords.lon + deliveryCoords.lon) / 2;
      const offset = Math.abs(pickupCoords.lon - deliveryCoords.lon) * 0.08;

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const lat = Math.pow(1 - t, 2) * pickupCoords.lat + 
                   2 * (1 - t) * t * (midLat + offset) + 
                   Math.pow(t, 2) * deliveryCoords.lat;
        const lon = Math.pow(1 - t, 2) * pickupCoords.lon + 
                   2 * (1 - t) * t * midLon + 
                   Math.pow(t, 2) * deliveryCoords.lon;
        routePoints.push([lat, lon]);
      }

      // Route shadow
      L.polyline(routePoints, {
        color: "#000",
        weight: 6,
        opacity: 0.1,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      // Main route
      L.polyline(routePoints, {
        color: "#007AFF",
        weight: 4,
        opacity: 0.5,
        lineCap: "round",
        lineJoin: "round",
        dashArray: "8, 12",
      }).addTo(map);
    }

    // Draw driver's traveled path
    if (locationHistory.length > 1) {
      const pathPoints = locationHistory.map(loc => [loc.latitude, loc.longitude] as L.LatLngExpression);
      
      // Traveled path (solid)
      pathRef.current = L.polyline(pathPoints, {
        color: "#34c759",
        weight: 4,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
    }

    // Add driver marker with animation
    if (location) {
      const driverIcon = L.divIcon({
        className: "driver-marker",
        html: `
          <div class="driver-marker-container" style="
            position: relative;
            width: 48px;
            height: 48px;
          ">
            <div style="
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 48px;
              height: 48px;
              background: linear-gradient(135deg, #007AFF, #0051D5);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 20px rgba(0, 122, 255, 0.5);
              border: 4px solid white;
              font-size: 22px;
              animation: driverPulse 2s ease-in-out infinite;
            ">🚛</div>
            <div style="
              position: absolute;
              bottom: -28px;
              left: 50%;
              transform: translateX(-50%);
              background: rgba(255,255,255,0.95);
              backdrop-filter: blur(10px);
              padding: 4px 10px;
              border-radius: 8px;
              font-size: 11px;
              font-weight: 600;
              color: #1d1d1f;
              white-space: nowrap;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            ">
              ${carrierName || t("role.carrier")}
            </div>
          </div>
        `,
        iconSize: [48, 76],
        iconAnchor: [24, 24],
      });

      driverMarkerRef.current = L.marker([location.latitude, location.longitude], { 
        icon: driverIcon,
        zIndexOffset: 1000,
      }).addTo(map);
    }

    // Fit bounds to show all points
    const allPoints: L.LatLngExpression[] = [];
    if (pickupCoords) allPoints.push([pickupCoords.lat, pickupCoords.lon]);
    if (deliveryCoords) allPoints.push([deliveryCoords.lat, deliveryCoords.lon]);
    if (location) allPoints.push([location.latitude, location.longitude]);

    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    return () => {};
  }, [location, locationHistory, loading, pickupCoords, deliveryCoords, carrierName, t]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  if (loading) {
    return (
      <Card className="glass-card overflow-hidden">
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground mt-3">{t("common.loading")}</p>
        </CardContent>
      </Card>
    );
  }

  if (!location) {
    return (
      <Card className="glass-card overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Navigation className="w-4 h-4" />
            {t("map.liveTracking")}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-8 h-8 opacity-50" />
          </div>
          <p className="font-medium">{t("map.driverLocation")}</p>
          <p className="text-xs mt-1 opacity-70">
            {t("orders.status.waiting")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Navigation className="w-4 h-4 text-primary" />
          {t("map.liveTracking")}
          <Badge variant="outline" className="ml-auto gap-1 bg-driver/10 text-driver border-driver/20">
            <div className="w-2 h-2 rounded-full bg-driver animate-pulse" />
            Live
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0 relative">
        {/* Info overlay */}
        {routeInfo && (
          <div className="absolute top-4 left-4 right-4 z-[1000] pointer-events-none">
            <div className="glass-card flex items-center justify-between gap-3 p-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground">
                  <Route className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("calculator.distance")}</p>
                  <p className="text-sm font-bold">{routeInfo.remainingKm} {t("common.km")}</p>
                </div>
              </div>
              
              <div className="h-8 w-px bg-border/50" />
              
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-driver to-driver/80 flex items-center justify-center text-driver-foreground">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("map.estimatedArrival")}</p>
                  <p className="text-sm font-bold">~{routeInfo.eta}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Map container */}
        <div 
          ref={mapContainerRef}
          className="w-full h-[350px]"
          style={{ zIndex: 0 }}
        />

        {/* Bottom info bar */}
        <div className="absolute bottom-4 left-4 right-4 z-[1000] pointer-events-none">
          <div className="glass-card flex items-center gap-3 p-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-xl">
              🚛
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">{carrierName || t("role.carrier")}</p>
              <p className="text-xs text-muted-foreground">
                {t("orders.status.in_progress")} • {new Date(location.recorded_at).toLocaleTimeString("ru-RU", { 
                  hour: "2-digit", 
                  minute: "2-digit" 
                })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{t("map.driverLocation")}</p>
              <p className="text-xs font-mono opacity-70">
                {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
              </p>
            </div>
          </div>
        </div>

        {/* Apple-style CSS */}
        <style>{`
          @keyframes driverPulse {
            0%, 100% {
              box-shadow: 0 4px 20px rgba(0, 122, 255, 0.5);
            }
            50% {
              box-shadow: 0 4px 30px rgba(0, 122, 255, 0.7), 0 0 0 8px rgba(0, 122, 255, 0.1);
            }
          }
          
          .leaflet-control-zoom {
            border: none !important;
            border-radius: 12px !important;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1) !important;
          }
          
          .leaflet-control-zoom a {
            background: rgba(255,255,255,0.95) !important;
            backdrop-filter: blur(10px);
            color: #1d1d1f !important;
            border: none !important;
            width: 36px !important;
            height: 36px !important;
            line-height: 36px !important;
          }
        `}</style>
      </CardContent>
    </Card>
  );
};
