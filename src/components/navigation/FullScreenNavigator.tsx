import { useEffect, useState, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
// Fix Leaflet default marker icons not displaying
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

import { 
  Navigation, MapPin, Clock, ChevronRight, Locate, 
  Volume2, VolumeX, Car, X, ChevronUp, ChevronDown,
  Phone, MessageSquare, AlertTriangle, Zap, Route as RouteIcon,
  Play, Pause, RotateCcw, Target, Layers, Navigation2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useVoiceNavigation } from "@/hooks/useVoiceNavigation";
import { MapStyleSelector, MapStyle, mapTileUrls } from "@/components/map/MapStyleSelector";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

// Fix Leaflet default icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl,
  iconRetinaUrl,
  shadowUrl: iconShadow,
});

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
  startAddress?: string;
  endAddress?: string;
}

interface Coords {
  lat: number;
  lng: number;
}

interface FullScreenNavigatorProps {
  dealId: string;
  clientId: string;
  clientName?: string;
  clientPhone?: string;
  pickupAddress: string;
  deliveryAddress: string;
  cargoType?: string;
  // Standardized to lng (Leaflet convention)
  pickupCoords?: { lat: number; lon: number } | { lat: number; lng: number };
  deliveryCoords?: { lat: number; lon: number } | { lat: number; lng: number };
  onClose?: () => void;
}

// Helper to normalize coordinates (handles both lon and lng)
function normalizeCoords(coords: { lat: number; lon?: number; lng?: number } | null | undefined): Coords | null {
  if (!coords) return null;
  const lng = coords.lng ?? coords.lon;
  if (lng === undefined) return null;
  return { lat: coords.lat, lng };
}

// Maneuver icons mapping
const maneuverIcons: Record<string, string> = {
  "turn-left": "↰",
  "turn-right": "↱",
  "turn-slight-left": "↖",
  "turn-slight-right": "↗",
  "turn-sharp-left": "⬅",
  "turn-sharp-right": "➡",
  "uturn-left": "↩",
  "uturn-right": "↪",
  "straight": "↑",
  "merge": "⤵",
  "roundabout-left": "↺",
  "roundabout-right": "↻",
  "fork-left": "⤴",
  "fork-right": "⤵",
  "ramp-left": "↰",
  "ramp-right": "↱",
  "keep-left": "↖",
  "keep-right": "↗",
  "ferry": "⛴",
  "ferry-train": "🚂",
};

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

export const FullScreenNavigator = ({ 
  dealId,
  clientId,
  clientName,
  clientPhone,
  pickupAddress,
  deliveryAddress,
  cargoType,
  pickupCoords: initialPickupCoords,
  deliveryCoords: initialDeliveryCoords,
  onClose 
}: FullScreenNavigatorProps) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  const voiceNav = useVoiceNavigation({ enabled: true });
  
  // State - initialize from props if coordinates provided (use normalizeCoords helper)
  const [currentPosition, setCurrentPosition] = useState<Coords | null>(null);
  const [pickupCoords, setPickupCoords] = useState<Coords | null>(
    normalizeCoords(initialPickupCoords)
  );
  const [deliveryCoords, setDeliveryCoords] = useState<Coords | null>(
    normalizeCoords(initialDeliveryCoords)
  );
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [premiumVoice, setPremiumVoice] = useState(false);
  const [distanceToDestination, setDistanceToDestination] = useState<number | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>("light");
  const [panelExpanded, setPanelExpanded] = useState(true);
  const [followDriver, setFollowDriver] = useState(true);
  const [arrived, setArrived] = useState(false);
  const [traveledDistance, setTraveledDistance] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  
  // Refs
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const traveledLineRef = useRef<L.Polyline | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const notifiedDistancesRef = useRef<Set<number>>(new Set());
  const lastSpokenStepRef = useRef<number>(-1);
  const positionHistoryRef = useRef<Coords[]>([]);
  const trackingActiveRef = useRef<boolean>(false); // Prevent double GPS tracking (StrictMode)

  // Geocode address
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

  // Fetch route
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
        
        // Voice announcement on first route
        if (!routeData && voiceEnabled) {
          const distance = data.distance?.text || "";
          const duration = data.duration?.text || "";
          voiceNav.speak(`Маршрут построен. ${distance}, примерное время ${duration}.`);
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to load route";
      setError(errMsg);
      toast({
        title: "Ошибка маршрута",
        description: errMsg,
        variant: "destructive",
      });
    } finally {
      setRouteLoading(false);
    }
  }, [deliveryCoords, routeData, voiceEnabled, voiceNav, toast]);

  // Geocode on mount
  useEffect(() => {
    const geocodeAddresses = async () => {
      setLoading(true);
      
      const pickup = await geocodeAddress(pickupAddress);
      if (pickup) setPickupCoords(pickup);
      
      const delivery = await geocodeAddress(deliveryAddress);
      if (delivery) setDeliveryCoords(delivery);
      
      setLoading(false);
    };
    
    geocodeAddresses();
  }, [pickupAddress, deliveryAddress, geocodeAddress]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([41.3, 64.5], 12);

    const tileConfig = mapTileUrls[mapStyle];
    L.tileLayer(tileConfig.url, {
      maxZoom: 19,
      subdomains: tileConfig.subdomains || undefined,
    }).addTo(mapRef.current);

    // Add zoom control to bottom right
    L.control.zoom({ position: "bottomright" }).addTo(mapRef.current);

    // Force map to recalculate its size after container is fully rendered
    setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 100);

    return () => {
      // Safe cleanup - check if Leaflet map is still valid before removing
      // Prevents crash if remove() called twice (React StrictMode)
      if (mapRef.current && (mapRef.current as any)._leaflet_id) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update map style
  useEffect(() => {
    if (!mapRef.current) return;

    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        mapRef.current!.removeLayer(layer);
      }
    });

    const tileConfig = mapTileUrls[mapStyle];
    L.tileLayer(tileConfig.url, {
      maxZoom: 19,
      subdomains: tileConfig.subdomains || undefined,
    }).addTo(mapRef.current);
  }, [mapStyle]);

  // Recalculate map size when panel expands/collapses
  useEffect(() => {
    if (!mapRef.current) return;
    const id = window.setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 350);
    return () => window.clearTimeout(id);
  }, [panelExpanded]);

  // Draw route on map
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Clear existing route
    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
    }

    // Draw route if available
    if (routeData?.points && routeData.points.length > 0) {
      const routePoints = routeData.points.map(p => [p.lat, p.lng] as L.LatLngExpression);

      // Route shadow
      L.polyline(routePoints, {
        color: "#000",
        weight: 10,
        opacity: 0.1,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      // Main route line
      routeLineRef.current = L.polyline(routePoints, {
        color: "#4285F4",
        weight: 6,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      // Fit bounds on first load
      if (!currentPosition) {
        map.fitBounds(routeLineRef.current.getBounds(), { padding: [80, 80] });
      }
    }

    // Clear and add markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker && layer !== driverMarkerRef.current) {
        map.removeLayer(layer);
      }
    });

    // Pickup marker
    if (pickupCoords) {
      const pickupIcon = L.divIcon({
        className: "nav-fullscreen-marker",
        html: `<div class="fs-marker pickup"><span>📦</span></div>`,
        iconSize: [52, 52],
        iconAnchor: [26, 26],
      });
      L.marker([pickupCoords.lat, pickupCoords.lng], { icon: pickupIcon })
        .bindPopup(`<b>Забрать груз</b><br/>${pickupAddress}`)
        .addTo(map);
    }

    // Delivery marker
    if (deliveryCoords) {
      const deliveryIcon = L.divIcon({
        className: "nav-fullscreen-marker",
        html: `<div class="fs-marker delivery"><span>🏁</span></div>`,
        iconSize: [52, 52],
        iconAnchor: [26, 26],
      });
      L.marker([deliveryCoords.lat, deliveryCoords.lng], { icon: deliveryIcon })
        .bindPopup(`<b>Доставить</b><br/>${deliveryAddress}`)
        .addTo(map);
    }
  }, [routeData, pickupCoords, deliveryCoords, pickupAddress, deliveryAddress, currentPosition]);

  // Send proximity notification
  const sendProximityNotification = useCallback(async (distanceKm: number) => {
    const thresholds = [5, 1, 0.5, 0.1];
    
    for (const threshold of thresholds) {
      if (distanceKm <= threshold && !notifiedDistancesRef.current.has(threshold)) {
        notifiedDistancesRef.current.add(threshold);
        
        if (voiceEnabled) {
          voiceNav.speakProximityAlert(distanceKm);
        }

        // Check if arrived (50 meters threshold - more reliable than 100m)
        if (distanceKm <= 0.05) {
          setArrived(true);
          if (voiceEnabled) {
            voiceNav.speak("Вы прибыли к месту назначения!");
          }
          toast({
            title: "🎉 Прибытие",
            description: "Вы достигли точки доставки",
          });
        }
        
        // Push notification to client
        try {
          await supabase.functions.invoke("proximity-notification", {
            body: {
              dealId,
              clientId,
              distanceKm: threshold,
              carrierName: "Водитель",
            },
          });
        } catch (err) {
          console.error("Failed to send proximity notification:", err);
        }
        
        break;
      }
    }
  }, [dealId, clientId, voiceEnabled, voiceNav, toast]);

  // Start GPS tracking
  const startTracking = useCallback(() => {
    // Prevent double tracking (React StrictMode calls effects twice)
    if (trackingActiveRef.current) {
      console.log("GPS tracking already active, skipping");
      return;
    }

    if (!navigator.geolocation) {
      toast({
        title: "Ошибка",
        description: "Геолокация не поддерживается вашим устройством",
        variant: "destructive",
      });
      return;
    }

    trackingActiveRef.current = true;
    setStartTime(new Date());
    notifiedDistancesRef.current.clear();
    lastSpokenStepRef.current = -1;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        
        // Calculate traveled distance
        if (currentPosition) {
          const dist = calculateDistance(
            currentPosition.lat, currentPosition.lng,
            pos.lat, pos.lng
          );
          setTraveledDistance(prev => prev + dist);
        }
        
        setCurrentPosition(pos);
        positionHistoryRef.current.push(pos);

        // Update GPS in database
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
              className: "driver-fullscreen-marker",
              html: `
                <div class="driver-fs-container">
                  <div class="driver-fs-pulse"></div>
                  <div class="driver-fs-arrow">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
                    </svg>
                  </div>
                </div>
              `,
              iconSize: [60, 60],
              iconAnchor: [30, 30],
            });
            driverMarkerRef.current = L.marker([pos.lat, pos.lng], {
              icon: driverIcon,
              zIndexOffset: 1000,
            }).addTo(mapRef.current);
          }

          // Follow driver - use panTo for smoother animation (less laggy than setView)
          if (followDriver) {
            mapRef.current.panTo([pos.lat, pos.lng], { animate: true, duration: 0.5 });
          }
        }

        // Update traveled path - use setLatLngs to avoid memory leak
        if (mapRef.current && positionHistoryRef.current.length > 1) {
          const traveledPoints = positionHistoryRef.current.map(p => [p.lat, p.lng] as L.LatLngExpression);
          if (traveledLineRef.current) {
            // Reuse existing polyline - no remove/add = no memory leak
            traveledLineRef.current.setLatLngs(traveledPoints);
          } else {
            traveledLineRef.current = L.polyline(traveledPoints, {
              color: "#10b981",
              weight: 5,
              opacity: 0.7,
              dashArray: "5, 10",
            }).addTo(mapRef.current);
          }
        }

        // Calculate distance to destination
        if (deliveryCoords) {
          const dist = calculateDistance(pos.lat, pos.lng, deliveryCoords.lat, deliveryCoords.lng);
          setDistanceToDestination(dist);
          sendProximityNotification(dist);
        }

        // Fetch route if not loaded (use functional check to avoid stale closure)
        if (deliveryCoords) {
          setRouteData(prev => {
            if (!prev) {
              fetchRoute(pos);
            }
            return prev;
          });
        }
      },
      (err) => {
        console.error("Geolocation error:", err);
        toast({
          title: "Ошибка GPS",
          description: err.message,
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 2000,
      }
    );

    watchIdRef.current = watchId;
    setTracking(true);

    if (voiceEnabled) {
      voiceNav.speak("Навигация запущена. Следуйте указаниям на экране.");
    }

    toast({
      title: "🛰️ GPS включён",
      description: "Отслеживание маршрута активно",
    });
  }, [dealId, deliveryCoords, currentPosition, followDriver, voiceEnabled, voiceNav, sendProximityNotification, fetchRoute, toast]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    trackingActiveRef.current = false; // Reset guard
    setTracking(false);
    voiceNav.stop();
  }, [voiceNav]);

  // Update current step based on position
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
      if (voiceEnabled && closestStepIndex > lastSpokenStepRef.current && tracking) {
        const step = routeData.steps[closestStepIndex];
        voiceNav.speakInstruction(step.instruction, step.distance.text);
        lastSpokenStepRef.current = closestStepIndex;
      }
    }
  }, [currentPosition, routeData, currentStepIndex, voiceEnabled, voiceNav, tracking]);

  // Center on driver - use panTo for smoother FPS
  const centerOnDriver = () => {
    if (mapRef.current && currentPosition) {
      mapRef.current.panTo([currentPosition.lat, currentPosition.lng], { animate: true });
      mapRef.current.setZoom(17);
      setFollowDriver(true);
    }
  };

  // Reset navigation
  const resetNavigation = () => {
    setCurrentStepIndex(0);
    lastSpokenStepRef.current = -1;
    notifiedDistancesRef.current.clear();
    positionHistoryRef.current = [];
    setTraveledDistance(0);
    setStartTime(null);
    setArrived(false);
    if (traveledLineRef.current && mapRef.current) {
      mapRef.current.removeLayer(traveledLineRef.current);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  // Calculate elapsed time
  const elapsedTime = startTime ? Math.floor((Date.now() - startTime.getTime()) / 60000) : 0;

  const currentStep = routeData?.steps?.[currentStepIndex];
  const nextStep = routeData?.steps?.[currentStepIndex + 1];
  const progress = routeData?.steps ? ((currentStepIndex + 1) / routeData.steps.length) * 100 : 0;

  // Handle close
  const handleClose = () => {
    stopTracking();
    if (onClose) {
      onClose();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Map */}
      <div className="flex-1 relative min-h-[300px]">
        <div ref={mapContainerRef} className="absolute inset-0" />
      </div>

      {/* Top Controls */}
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between pointer-events-none">
        {/* Left: Close & Info */}
        <div className="flex flex-col gap-2 pointer-events-auto">
          <Button 
            variant="secondary" 
            size="icon" 
            className="h-12 w-12 rounded-full shadow-lg bg-background/90 backdrop-blur"
            onClick={handleClose}
          >
            <X className="h-5 w-5" />
          </Button>
          
          {cargoType && (
            <Badge className="px-3 py-1.5 bg-background/90 backdrop-blur shadow-lg text-foreground">
              📦 {cargoType}
            </Badge>
          )}
        </div>

        {/* Right: Controls */}
        <div className="flex flex-col gap-2 pointer-events-auto">
          <Button 
            variant={voiceEnabled ? "default" : "secondary"}
            size="icon" 
            className="h-12 w-12 rounded-full shadow-lg"
            onClick={() => setVoiceEnabled(!voiceEnabled)}
          >
            {voiceEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </Button>
          
          <MapStyleSelector 
            value={mapStyle} 
            onChange={setMapStyle}
            className="shadow-lg"
          />
        </div>
      </div>

      {/* Center Button */}
      {currentPosition && (
        <div className="absolute right-4 bottom-80 pointer-events-auto">
          <Button
            variant={followDriver ? "default" : "secondary"}
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg"
            onClick={centerOnDriver}
          >
            <Navigation2 className={cn("h-6 w-6", followDriver && "animate-pulse")} />
          </Button>
        </div>
      )}

      {/* Bottom Panel */}
      <div 
        className={cn(
          "absolute bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl border-t shadow-2xl transition-all duration-300",
          panelExpanded ? "max-h-[60vh]" : "max-h-[140px]"
        )}
      >
        {/* Panel Toggle */}
        <button 
          className="w-full py-2 flex justify-center"
          onClick={() => setPanelExpanded(!panelExpanded)}
        >
          <div className="w-12 h-1 rounded-full bg-muted-foreground/30" />
        </button>

        <div className="px-4 pb-4 space-y-4 overflow-y-auto max-h-[calc(60vh-40px)]">
          {/* Current Instruction */}
          {currentStep && (
            <div className="bg-primary/10 rounded-2xl p-4">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center text-primary-foreground text-2xl shrink-0">
                  {maneuverIcons[currentStep.maneuver || "straight"] || "↑"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-semibold leading-tight">
                    {currentStep.instruction}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-primary">{currentStep.distance.text}</span>
                    <span>•</span>
                    <span>{currentStep.duration.text}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => voiceNav.speakInstruction(currentStep.instruction, currentStep.distance.text)}
                  disabled={!voiceEnabled}
                >
                  <Volume2 className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {/* Next Step Preview */}
          {nextStep && panelExpanded && (
            <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-muted/50">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Затем: {nextStep.instruction}
              </span>
            </div>
          )}

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Осталось</p>
              <p className="text-lg font-bold">
                {distanceToDestination ? `${distanceToDestination.toFixed(1)} км` : routeData?.distance?.text || "—"}
              </p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Время</p>
              <p className="text-lg font-bold">
                {routeData?.durationInTraffic?.text || routeData?.duration?.text || "—"}
              </p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">В пути</p>
              <p className="text-lg font-bold">{elapsedTime} мин</p>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Прогресс маршрута</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Navigation Controls */}
          <div className="flex gap-3">
            <Button
              className="flex-1 h-14 text-base"
              variant={tracking ? "destructive" : "default"}
              onClick={tracking ? stopTracking : startTracking}
              disabled={loading || !deliveryCoords}
            >
              {tracking ? (
                <>
                  <Pause className="h-5 w-5 mr-2" />
                  Остановить
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Начать навигацию
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              className="h-14 w-14"
              onClick={resetNavigation}
            >
              <RotateCcw className="h-5 w-5" />
            </Button>
          </div>

          {/* Client Contact */}
          {panelExpanded && (clientName || clientPhone) && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                👤
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{clientName || "Клиент"}</p>
                {clientPhone && (
                  <p className="text-sm text-muted-foreground">{clientPhone}</p>
                )}
              </div>
              {clientPhone && (
                <Button variant="outline" size="icon" asChild>
                  <a href={`tel:${clientPhone}`}>
                    <Phone className="h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button variant="outline" size="icon" onClick={() => navigate(`/deal/${dealId}`)}>
                <MessageSquare className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Arrival Banner */}
          {arrived && (
            <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 text-center">
              <p className="text-lg font-bold text-green-600 dark:text-green-400">
                🎉 Вы прибыли!
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Проехано {traveledDistance.toFixed(1)} км за {elapsedTime} минут
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Loading Overlay */}
      {(loading || routeLoading) && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto" />
            <p className="text-lg font-medium">
              {loading ? "Загрузка карты..." : "Построение маршрута..."}
            </p>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && !loading && (
        <div className="absolute inset-x-4 top-20 bg-destructive/10 border border-destructive/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm">{error}</p>
            <Button size="sm" variant="outline" onClick={() => currentPosition && fetchRoute(currentPosition)}>
              Повторить
            </Button>
          </div>
        </div>
      )}

      {/* Custom marker styles */}
      <style>{`
        .nav-fullscreen-marker {
          background: transparent !important;
          border: none !important;
        }
        .fs-marker {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.25);
          border: 4px solid white;
        }
        .fs-marker.pickup {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }
        .fs-marker.delivery {
          background: linear-gradient(135deg, #ef4444, #dc2626);
        }
        .driver-fullscreen-marker {
          background: transparent !important;
          border: none !important;
        }
        .driver-fs-container {
          position: relative;
          width: 60px;
          height: 60px;
        }
        .driver-fs-pulse {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: rgba(59, 130, 246, 0.3);
          animation: fs-pulse 2s ease-out infinite;
        }
        .driver-fs-arrow {
          position: absolute;
          inset: 10px;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 4px 20px rgba(59, 130, 246, 0.5);
          border: 3px solid white;
        }
        .driver-fs-arrow svg {
          width: 24px;
          height: 24px;
        }
        @keyframes fs-pulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  );
};
