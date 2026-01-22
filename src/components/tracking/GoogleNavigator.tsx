import { useEffect, useState, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { 
  Loader2, Navigation, MapPin, Route, Clock, 
  ChevronRight, Locate, AlertCircle, Volume2, VolumeX,
  Car, Layers
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useVoiceNavigation } from "@/hooks/useVoiceNavigation";

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
  durationInTraffic?: { text: string; value: number };
  points: { lat: number; lng: number }[];
  steps: RouteStep[];
}

interface Coords {
  lat: number;
  lng: number;
}

interface GoogleNavigatorProps {
  dealId: string;
  clientId: string;
  carrierName: string;
  pickupAddress?: string;
  deliveryAddress?: string;
  pickupCoords?: { lat: number; lon: number };
  deliveryCoords?: { lat: number; lon: number };
  onLocationUpdate?: (position: GeolocationPosition) => void;
}

// Distance calculation helper
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

export const GoogleNavigator = ({ 
  dealId,
  clientId,
  carrierName,
  pickupAddress,
  deliveryAddress,
  pickupCoords: initialPickupCoords, 
  deliveryCoords: initialDeliveryCoords,
  onLocationUpdate 
}: GoogleNavigatorProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const voiceNav = useVoiceNavigation({ enabled: true });
  
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
  const [showTraffic, setShowTraffic] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [distanceToDestination, setDistanceToDestination] = useState<number | null>(null);
  
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const notifiedDistancesRef = useRef<Set<number>>(new Set());
  const lastSpokenStepRef = useRef<number>(-1);

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

  // Send proximity notification
  const sendProximityNotification = useCallback(async (distanceKm: number) => {
    const thresholds = [5, 1, 0.5];
    
    for (const threshold of thresholds) {
      if (distanceKm <= threshold && !notifiedDistancesRef.current.has(threshold)) {
        notifiedDistancesRef.current.add(threshold);
        
        // Voice alert for driver
        if (voiceEnabled) {
          voiceNav.speakProximityAlert(distanceKm);
        }
        
        // Push notification to client
        try {
          await supabase.functions.invoke("proximity-notification", {
            body: {
              dealId,
              clientId,
              distanceKm: threshold,
              carrierName,
            },
          });
        } catch (err) {
          console.error("Failed to send proximity notification:", err);
        }
        
        break;
      }
    }
  }, [dealId, clientId, carrierName, voiceEnabled, voiceNav]);

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

  // Fetch route from Edge Function
  const fetchRoute = useCallback(async (origin: Coords) => {
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
      } else {
        setRouteData(data);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to load route";
      setError(errMsg);
    } finally {
      setRouteLoading(false);
    }
  }, [deliveryCoords]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView([41.3, 64.5], 10);

      // Use CartoDB tiles (free, reliable, no API key needed)
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        subdomains: "abcd",
      }).addTo(mapRef.current);

      setLoading(false);
    }
  }, []);

  // Toggle traffic layer (visual indicator only - actual traffic data comes from route)
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    
    // Remove existing tile layers
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    // CartoDB Voyager (light) or Dark Matter based on traffic toggle for visual distinction
    const tileUrl = showTraffic
      ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

    L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: "abcd",
    }).addTo(map);

  }, [showTraffic]);

  // Update route on map
  useEffect(() => {
    if (!mapRef.current || !routeData?.points) return;

    const map = mapRef.current;

    // Clear existing route line
    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
    }

    // Draw route
    const routePoints = routeData.points.map(p => [p.lat, p.lng] as L.LatLngExpression);

    if (routePoints.length > 0) {
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
        color: "#4285F4",
        weight: 5,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      // Fit bounds
      map.fitBounds(routeLineRef.current.getBounds(), { padding: [50, 50] });
    }

    // Add markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker && layer !== driverMarkerRef.current) {
        map.removeLayer(layer);
      }
    });

    // Pickup marker
    if (pickupCoords) {
      const pickupIcon = L.divIcon({
        className: "custom-marker",
        html: `<div class="nav-marker pickup">📦</div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
      L.marker([pickupCoords.lat, pickupCoords.lng], { icon: pickupIcon }).addTo(map);
    }

    // Delivery marker
    if (deliveryCoords) {
      const deliveryIcon = L.divIcon({
        className: "custom-marker",
        html: `<div class="nav-marker delivery">🏁</div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
      L.marker([deliveryCoords.lat, deliveryCoords.lng], { icon: deliveryIcon }).addTo(map);
    }

  }, [routeData, pickupCoords, deliveryCoords]);

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

        // Update driver marker
        if (mapRef.current) {
          if (driverMarkerRef.current) {
            driverMarkerRef.current.setLatLng([pos.lat, pos.lng]);
          } else {
            const driverIcon = L.divIcon({
              className: "driver-nav-marker",
              html: `
                <div class="driver-nav-container">
                  <div class="driver-pulse-ring"></div>
                  <div class="driver-icon-circle">🚛</div>
                </div>
              `,
              iconSize: [56, 56],
              iconAnchor: [28, 28],
            });
            driverMarkerRef.current = L.marker([pos.lat, pos.lng], {
              icon: driverIcon,
              zIndexOffset: 1000,
            }).addTo(mapRef.current);
          }
        }

        // Calculate distance to destination
        if (deliveryCoords) {
          const dist = calculateDistance(pos.lat, pos.lng, deliveryCoords.lat, deliveryCoords.lng);
          setDistanceToDestination(dist);
          sendProximityNotification(dist);
        }

        // Fetch/update route
        if (!routeData) {
          fetchRoute(pos);
        }
      },
      (err) => {
        console.error("Geolocation error:", err);
        setError(err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 3000,
      }
    );

    watchIdRef.current = watchId;
    setTracking(true);

    if (voiceEnabled) {
      voiceNav.speak("Навигация запущена. Следуйте указаниям.");
    }

    toast({
      title: "GPS включён",
      description: "Маршрут с учётом пробок",
    });
  }, [dealId, deliveryCoords, onLocationUpdate, t, toast, voiceEnabled, voiceNav, sendProximityNotification, fetchRoute, routeData]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
    voiceNav.stop();
  }, [voiceNav]);

  // Calculate current step and speak instruction
  useEffect(() => {
    if (!currentPosition || !routeData?.steps) return;

    let closestStepIndex = 0;
    let minDistance = Infinity;

    routeData.steps.forEach((step, i) => {
      const dist = calculateDistance(
        currentPosition.lat,
        currentPosition.lng,
        step.startLocation.lat,
        step.startLocation.lng
      );
      if (dist < minDistance) {
        minDistance = dist;
        closestStepIndex = i;
      }
    });

    if (closestStepIndex !== currentStepIndex) {
      setCurrentStepIndex(closestStepIndex);
      
      // Speak new instruction
      if (voiceEnabled && closestStepIndex > lastSpokenStepRef.current) {
        const step = routeData.steps[closestStepIndex];
        voiceNav.speakInstruction(step.instruction, step.distance.text);
        lastSpokenStepRef.current = closestStepIndex;
      }
    }
  }, [currentPosition, routeData, currentStepIndex, voiceEnabled, voiceNav]);

  // Center on driver
  const centerOnDriver = () => {
    if (mapRef.current && currentPosition) {
      mapRef.current.setView([currentPosition.lat, currentPosition.lng], 16);
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
    <div className="flex flex-col h-full bg-background">
      {/* Navigation Header */}
      <div className="glass-card shrink-0 p-4 space-y-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-driver to-driver/80 flex items-center justify-center text-white shadow-lg">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">{t("map.liveTracking")}</h3>
              {routeData && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{routeData.distance?.text}</span>
                  <span>•</span>
                  <span className={routeData.durationInTraffic ? "text-orange-500 font-medium" : ""}>
                    {routeData.durationInTraffic?.text || routeData.duration?.text}
                  </span>
                  {showTraffic && (
                    <Badge variant="outline" className="text-[10px] py-0 px-1 bg-orange-500/10 text-orange-500 border-orange-500/20">
                      <Car className="w-2.5 h-2.5 mr-0.5" />
                      пробки
                    </Badge>
                  )}
                </div>
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

        {/* Controls */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Трафик</span>
            <Switch 
              checked={showTraffic} 
              onCheckedChange={setShowTraffic}
              className="scale-75"
            />
          </div>
          <div className="flex items-center gap-2">
            {voiceEnabled ? <Volume2 className="w-3.5 h-3.5 text-muted-foreground" /> : <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />}
            <span>Голос</span>
            <Switch 
              checked={voiceEnabled} 
              onCheckedChange={setVoiceEnabled}
              className="scale-75"
            />
          </div>
        </div>

        {/* Current Step Instruction */}
        {currentStep && (
          <div className="glass-card p-3 bg-primary/5 rounded-xl">
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
              {voiceNav.isSpeaking && (
                <Volume2 className="w-4 h-4 text-primary animate-pulse shrink-0" />
              )}
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

        {/* Distance to destination */}
        {distanceToDestination !== null && distanceToDestination <= 5 && (
          <div className="glass-card p-2 bg-driver/10 rounded-lg flex items-center gap-2">
            <MapPin className="w-4 h-4 text-driver" />
            <span className="text-sm font-medium">
              До точки доставки: {distanceToDestination < 1 
                ? `${Math.round(distanceToDestination * 1000)} м` 
                : `${distanceToDestination.toFixed(1)} км`}
            </span>
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
                <span className="text-sm font-medium">
                  {routeData.durationInTraffic?.text || routeData.duration?.text}
                </span>
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
        .nav-marker {
          width: 44px;
          height: 44px;
          border-radius: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          border: 3px solid white;
          box-shadow: 0 4px 15px rgba(0,0,0,0.25);
        }
        
        .nav-marker.pickup {
          background: linear-gradient(135deg, #34c759, #30d158);
        }
        
        .nav-marker.delivery {
          background: linear-gradient(135deg, #EA4335, #ff453a);
        }
        
        .driver-nav-container {
          position: relative;
          width: 56px;
          height: 56px;
        }
        
        .driver-pulse-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: rgba(66, 133, 244, 0.3);
          animation: navPulse 2s ease-out infinite;
        }
        
        .driver-icon-circle {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #4285F4, #1a73e8);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          border: 3px solid white;
          box-shadow: 0 4px 20px rgba(66, 133, 244, 0.5);
        }
        
        @keyframes navPulse {
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
          border-radius: 8px !important;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.15) !important;
        }
        
        .leaflet-control-zoom a {
          background: white !important;
          color: #1a1a1a !important;
          border: none !important;
        }
      `}</style>
    </div>
  );
};
