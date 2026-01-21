import { useEffect, useState, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { 
  Loader2, Navigation, MapPin, Route, Clock, 
  ChevronRight, Locate, AlertCircle 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";

interface RouteStep {
  instruction: string;
  distance: { text: string; value: number };
  duration: { text: string; value: number };
  startLocation: { lat: number; lng: number };
  endLocation: { lat: number; lng: number };
  maneuver?: string;
}

interface RouteData {
  distance: { text: string; value: number };
  duration: { text: string; value: number };
  points: { lat: number; lng: number }[];
  steps: RouteStep[];
  bounds: { northeast: { lat: number; lng: number }; southwest: { lat: number; lng: number } };
}

interface Coords {
  lat: number;
  lng: number;
}

interface DriverMapViewProps {
  dealId: string;
  pickupAddress?: string;
  deliveryAddress?: string;
  pickupCoords?: { lat: number; lon: number };
  deliveryCoords?: { lat: number; lon: number };
  onLocationUpdate?: (position: GeolocationPosition) => void;
}

export const DriverMapView = ({ 
  dealId, 
  pickupAddress,
  deliveryAddress,
  pickupCoords: initialPickupCoords, 
  deliveryCoords: initialDeliveryCoords,
  onLocationUpdate 
}: DriverMapViewProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const [currentPosition, setCurrentPosition] = useState<Coords | null>(null);
  const [pickupCoords, setPickupCoords] = useState<Coords | null>(
    initialPickupCoords ? { lat: initialPickupCoords.lat, lng: initialPickupCoords.lon } : null
  );
  const [deliveryCoords, setDeliveryCoords] = useState<Coords | null>(
    initialDeliveryCoords ? { lat: initialDeliveryCoords.lat, lng: initialDeliveryCoords.lon } : null
  );
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Geocode address to coordinates
  const geocodeAddress = useCallback(async (address: string): Promise<Coords | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("geocode", {
        body: { address },
      });
      
      if (error || data.error) {
        console.error("Geocode error:", error || data.error);
        return null;
      }
      
      return { lat: data.lat, lng: data.lng };
    } catch (err) {
      console.error("Failed to geocode:", err);
      return null;
    }
  }, []);

  // Geocode addresses on mount
  useEffect(() => {
    const geocodeAddresses = async () => {
      if (!pickupCoords && pickupAddress) {
        const coords = await geocodeAddress(pickupAddress);
        if (coords) setPickupCoords(coords);
      }
      
      if (!deliveryCoords && deliveryAddress) {
        const coords = await geocodeAddress(deliveryAddress);
        if (coords) setDeliveryCoords(coords);
      }
    };
    
    geocodeAddresses();
  }, [pickupAddress, deliveryAddress, pickupCoords, deliveryCoords, geocodeAddress]);

  // Fetch optimal route from Google Directions
  const fetchOptimalRoute = useCallback(async (origin: Coords) => {
    if (!deliveryCoords) return;

    setRouteLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("google-directions", {
        body: {
          origin: { lat: origin.lat, lng: origin.lng },
          destination: { lat: deliveryCoords.lat, lng: deliveryCoords.lng },
        },
      });

      if (fnError) throw fnError;

      if (data.error) {
        setError(data.error);
        console.error("Route error:", data);
      } else {
        setRouteData(data);
        console.log("Route fetched:", data.distance?.text, data.duration?.text);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to load route";
      console.error("Failed to fetch route:", err);
      setError(errMsg);
    } finally {
      setRouteLoading(false);
    }
  }, [deliveryCoords]);

  // Start GPS tracking
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      toast({
        title: t("common.error"),
        description: "Геолокация не поддерживается",
        variant: "destructive",
      });
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCurrentPosition(pos);
        setLoading(false);
        onLocationUpdate?.(position);

        // Send to Supabase
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) {
            supabase.from("gps_locations").insert({
              deal_id: dealId,
              carrier_id: user.id,
              latitude: pos.lat,
              longitude: pos.lng,
            });
          }
        });
      },
      (err) => {
        console.error("Geolocation error:", err);
        setLoading(false);
        setError(err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      }
    );

    watchIdRef.current = watchId;
    setTracking(true);

    toast({
      title: "GPS включён",
      description: "Маршрут будет оптимизирован по вашей позиции",
    });
  }, [dealId, onLocationUpdate, t, toast]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
  }, []);

  // Fetch route when position changes
  useEffect(() => {
    if (currentPosition && deliveryCoords && !routeData) {
      fetchOptimalRoute(currentPosition);
    }
  }, [currentPosition, deliveryCoords, routeData, fetchOptimalRoute]);

  // Calculate current step based on position
  useEffect(() => {
    if (!currentPosition || !routeData?.steps) return;

    const closestIndex = routeData.steps.findIndex((step, i) => {
      const dist = calculateDistance(
        currentPosition.lat,
        currentPosition.lng,
        step.endLocation.lat,
        step.endLocation.lng
      );
      return dist > 0.05; // 50 meters
    });

    if (closestIndex > currentStepIndex) {
      setCurrentStepIndex(closestIndex);
    }
  }, [currentPosition, routeData, currentStepIndex]);

  // Initialize and update map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView([41.3, 64.5], 10);

      // Apple-style tiles
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;

    // Clear existing route line
    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
    }

    // Draw route from Google Directions
    if (routeData?.points && routeData.points.length > 0) {
      const routePoints = routeData.points.map(p => [p.lat, p.lng] as L.LatLngExpression);

      // Route shadow
      L.polyline(routePoints, {
        color: "#000",
        weight: 8,
        opacity: 0.15,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      // Main route
      routeLineRef.current = L.polyline(routePoints, {
        color: "#007AFF",
        weight: 5,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      // Fit bounds
      if (routeData.bounds) {
        map.fitBounds([
          [routeData.bounds.southwest.lat, routeData.bounds.southwest.lng],
          [routeData.bounds.northeast.lat, routeData.bounds.northeast.lng],
        ], { padding: [40, 40] });
      }
    }

    // Add pickup marker
    if (pickupCoords) {
      const pickupIcon = L.divIcon({
        className: "custom-marker",
        html: `
          <div class="glass-marker pickup-marker">
            <span>📦</span>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
      L.marker([pickupCoords.lat, pickupCoords.lng], { icon: pickupIcon }).addTo(map);
    }

    // Add delivery marker
    if (deliveryCoords) {
      const deliveryIcon = L.divIcon({
        className: "custom-marker",
        html: `
          <div class="glass-marker delivery-marker">
            <span>🏁</span>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
      L.marker([deliveryCoords.lat, deliveryCoords.lng], { icon: deliveryIcon }).addTo(map);
    }

    // Update driver marker
    if (currentPosition) {
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setLatLng([currentPosition.lat, currentPosition.lng]);
      } else {
        const driverIcon = L.divIcon({
          className: "driver-marker-live",
          html: `
            <div class="driver-marker-container">
              <div class="driver-pulse"></div>
              <div class="driver-icon">🚛</div>
            </div>
          `,
          iconSize: [56, 56],
          iconAnchor: [28, 28],
        });
        driverMarkerRef.current = L.marker([currentPosition.lat, currentPosition.lng], {
          icon: driverIcon,
          zIndexOffset: 1000,
        }).addTo(map);
      }
    }

  }, [currentPosition, routeData, pickupCoords, deliveryCoords]);

  // Center on driver
  const centerOnDriver = () => {
    if (mapRef.current && currentPosition) {
      mapRef.current.setView([currentPosition.lat, currentPosition.lng], 15, {
        animate: true,
      });
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      stopTracking();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [stopTracking]);

  const currentStep = routeData?.steps?.[currentStepIndex];
  const nextStep = routeData?.steps?.[currentStepIndex + 1];

  return (
    <div className="flex flex-col h-full">
      {/* Navigation Header */}
      <div className="glass-card shrink-0 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-driver to-driver/80 flex items-center justify-center text-white shadow-lg">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">{t("map.liveTracking")}</h3>
              {routeData && (
                <p className="text-xs text-muted-foreground">
                  {routeData.distance?.text} • {routeData.duration?.text}
                </p>
              )}
            </div>
          </div>
          
          <Badge 
            variant="outline" 
            className={tracking ? "bg-driver/10 text-driver border-driver/20" : ""}
          >
            {tracking ? (
              <>
                <div className="w-2 h-2 rounded-full bg-driver animate-pulse mr-1.5" />
                Live
              </>
            ) : (
              "Offline"
            )}
          </Badge>
        </div>

        {/* Current Step Instruction */}
        {currentStep && (
          <div className="glass-card p-3 bg-primary/5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shrink-0">
                <ChevronRight className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm leading-snug">{currentStep.instruction}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {currentStep.distance?.text} • {currentStep.duration?.text}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Next Step Preview */}
        {nextStep && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pl-11">
            <span>Затем:</span>
            <span className="truncate">{nextStep.instruction}</span>
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="flex-1 relative min-h-[300px]">
        <div ref={mapContainerRef} className="absolute inset-0" />

        {/* Loading overlay */}
        {(loading || routeLoading) && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-[500]">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground mt-2">
                {routeLoading ? "Построение маршрута..." : t("common.loading")}
              </p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && !loading && (
          <div className="absolute top-4 left-4 right-4 z-[500]">
            <div className="glass-card p-3 flex items-center gap-2 text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Center button */}
        {currentPosition && (
          <Button
            size="icon"
            variant="secondary"
            className="absolute bottom-4 right-4 z-[500] glass-card shadow-lg"
            onClick={centerOnDriver}
          >
            <Locate className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="shrink-0 p-4 glass-card border-t">
        <div className="flex items-center gap-3">
          {/* Route info */}
          {routeData && (
            <div className="flex-1 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Route className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{routeData.distance?.text}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{routeData.duration?.text}</span>
              </div>
            </div>
          )}

          {/* Tracking toggle */}
          <Button
            onClick={tracking ? stopTracking : startTracking}
            variant={tracking ? "destructive" : "driver"}
            className="shrink-0"
          >
            {tracking ? "Остановить" : "Начать навигацию"}
          </Button>
        </div>

        {/* Current position */}
        {currentPosition && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            <MapPin className="w-3 h-3 inline mr-1" />
            {currentPosition.lat.toFixed(5)}, {currentPosition.lng.toFixed(5)}
          </p>
        )}
      </div>

      {/* Styles */}
      <style>{`
        .glass-marker {
          width: 44px;
          height: 44px;
          border-radius: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          border: 3px solid white;
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        
        .pickup-marker {
          background: linear-gradient(135deg, #34c759, #30d158);
        }
        
        .delivery-marker {
          background: linear-gradient(135deg, #ff3b30, #ff453a);
        }
        
        .driver-marker-container {
          position: relative;
          width: 56px;
          height: 56px;
        }
        
        .driver-pulse {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: rgba(0, 122, 255, 0.2);
          animation: driverPulseAnim 2s ease-out infinite;
        }
        
        .driver-icon {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #007AFF, #0051D5);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          border: 3px solid white;
          box-shadow: 0 4px 20px rgba(0, 122, 255, 0.4);
        }
        
        @keyframes driverPulseAnim {
          0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.6;
          }
          100% {
            transform: translate(-50%, -50%) scale(2);
            opacity: 0;
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
        }
      `}</style>
    </div>
  );
};

// Helper function
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
