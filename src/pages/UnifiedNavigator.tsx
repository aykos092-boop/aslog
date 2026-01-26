import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { 
  Navigation, MapPin, Clock, Route as RouteIcon, Car, 
  Footprints, ArrowLeft, Loader2, ChevronDown, ChevronUp, 
  Compass, Locate, Camera, CloudOff, Volume2, VolumeX, 
  Play, Square, X, Phone, AlertTriangle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { MapStyleSelector, MapStyle, mapTileUrls } from "@/components/map/MapStyleSelector";
import { cn } from "@/lib/utils";
import { useVoiceNavigation, VoiceGender } from "@/hooks/useVoiceNavigation";
import { VoiceSettingsPanel, VoiceSettings } from "@/components/navigation/VoiceSettingsPanel";
import { useOfflineCache } from "@/hooks/useOfflineCache";
import { useSpeedCameraAlerts } from "@/hooks/useSpeedCameraAlerts";
import { SpeedCameraOverlay } from "@/components/navigation/SpeedCameraOverlay";
import { OfflineCacheStatus } from "@/components/navigation/OfflineCacheStatus";
import { RouteAlternativesPanel } from "@/components/navigation/RouteAlternativesPanel";
import { NavigationInstruction } from "@/components/navigation/NavigationInstruction";

// Types
type TravelMode = "driving" | "walking";

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
  startAddress: string;
  endAddress: string;
  points: { lat: number; lng: number }[];
  steps: RouteStep[];
  bounds: {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
  };
  summary: string;
  warnings: string[];
}

interface Coords {
  lat: number;
  lng: number;
}

interface OrderData {
  id: string;
  pickup_address: string;
  delivery_address: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  cargo_type?: string;
  client_price?: number | null;
  status: string;
}

// Route colors for alternatives
const ROUTE_COLORS = ["#4285F4", "#34A853", "#FBBC04", "#EA4335"];

const UnifiedNavigator = () => {
  const navigate = useNavigate();
  const { orderId, dealId } = useParams<{ orderId?: string; dealId?: string }>();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { language, t } = useLanguage();

  // Order data state (auto-filled)
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [clientInfo, setClientInfo] = useState<{ name?: string; phone?: string } | null>(null);
  
  // Route state
  const [fromAddress, setFromAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [fromCoords, setFromCoords] = useState<Coords | null>(null);
  const [toCoords, setToCoords] = useState<Coords | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>("driving");
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>("traffic");
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [stepsExpanded, setStepsExpanded] = useState(false);
  
  // Navigation state
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<Coords | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [followMeMode, setFollowMeMode] = useState(false);
  const [currentHeading, setCurrentHeading] = useState<number>(0);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [lastPosition, setLastPosition] = useState<Coords | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  
  // Voice settings
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    enabled: true,
    gender: "male" as VoiceGender,
    rate: 1.0,
  });
  
  const { 
    speak, 
    speakInstruction, 
    stop: stopVoice, 
    isSpeaking,
    updateVoiceSettings,
  } = useVoiceNavigation({ 
    enabled: voiceSettings.enabled, 
    language,
    gender: voiceSettings.gender,
    rate: voiceSettings.rate,
  });

  // Offline cache
  const { cacheRoute, getCachedRoute, preCacheTilesForRoute } = useOfflineCache();
  
  // Speed camera alerts
  const { 
    nearbyCamera, 
    checkPosition: checkSpeedCamera, 
    resetAlerts: resetCameraAlerts,
  } = useSpeedCameraAlerts(voiceSettings.enabled, language);

  // Refs
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const routeLinesRef = useRef<L.Polyline[]>([]);
  const markersRef = useRef<L.Marker[]>([]);
  const locationMarkerRef = useRef<L.Marker | null>(null);
  const lastAnnouncedStepRef = useRef<number>(-1);
  const watchIdRef = useRef<number | null>(null);

  // Check online/offline status
  useEffect(() => {
    const updateOnlineStatus = () => setIsOffline(!navigator.onLine);
    updateOnlineStatus();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  // Calculate bearing between two points
  const calculateBearing = useCallback((from: Coords, to: Coords): number => {
    const dLon = (to.lng - from.lng) * Math.PI / 180;
    const lat1 = from.lat * Math.PI / 180;
    const lat2 = to.lat * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }, []);

  // Distance calculation
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Initialize map
  useEffect(() => {
    // Cleanup existing map first
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Small delay to ensure container is properly sized
    const initTimer = setTimeout(() => {
      if (!mapContainerRef.current) {
        console.error("Map container not ready");
        return;
      }

      console.log("Initializing Leaflet map with style:", mapStyle);

      try {
        const map = L.map(mapContainerRef.current, {
          zoomControl: false,
          attributionControl: false,
        }).setView([41.3, 69.3], 6);

        mapRef.current = map;

        const tileConfig = mapTileUrls[mapStyle];
        console.log("Loading tiles from:", tileConfig.url);
        
        L.tileLayer(tileConfig.url, {
          maxZoom: 19,
          tileSize: 512,
          zoomOffset: -1,
          subdomains: tileConfig.subdomains || undefined,
          attribution: tileConfig.attribution || '',
        }).addTo(map);

        L.control.zoom({ position: "bottomright" }).addTo(map);

        // Force multiple invalidateSize calls to ensure tiles render
        [100, 300, 500, 1000].forEach(delay => {
          setTimeout(() => {
            if (mapRef.current) {
              mapRef.current.invalidateSize();
            }
          }, delay);
        });

        // Get current location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              setCurrentPosition(coords);
              if (mapRef.current) {
                mapRef.current.setView([coords.lat, coords.lng], 14);
                setTimeout(() => mapRef.current?.invalidateSize(), 50);
              }
            },
            (err) => {
              console.log("Geolocation not available:", err.message);
            },
            { enableHighAccuracy: true }
          );
        }
        
        console.log("Leaflet map initialized successfully");
      } catch (err) {
        console.error("Failed to initialize map:", err);
      }
    }, 100);

    return () => {
      clearTimeout(initTimer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapStyle]);

  // Update map style is now handled in init effect

  // Load order/deal data automatically
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        let order: OrderData | null = null;
        let clientId: string | null = null;

        // Load by dealId
        if (dealId) {
          const { data, error: fetchError } = await supabase
            .from("deals")
            .select(`
              id,
              client_id,
              carrier_id,
              status,
              order:orders!order_id (
                id,
                pickup_address,
                delivery_address,
                cargo_type,
                pickup_lat,
                pickup_lng,
                delivery_lat,
                delivery_lng,
                client_price,
                status
              )
            `)
            .eq("id", dealId)
            .single();

          if (fetchError) throw fetchError;
          
          const orderData = Array.isArray(data.order) ? data.order[0] : data.order;
          if (orderData) {
            order = orderData as OrderData;
            clientId = data.client_id;
          }
        }
        // Load by orderId
        else if (orderId) {
          const { data, error: fetchError } = await supabase
            .from("orders")
            .select("id, pickup_address, delivery_address, cargo_type, pickup_lat, pickup_lng, delivery_lat, delivery_lng, client_price, status, client_id")
            .eq("id", orderId)
            .single();

          if (fetchError) throw fetchError;
          order = data as OrderData;
          clientId = data.client_id;
        }
        // Load from URL params
        else {
          const fromParam = searchParams.get("from");
          const toParam = searchParams.get("to");
          if (fromParam) setFromAddress(fromParam);
          if (toParam) setToAddress(toParam);
          setLoading(false);
          return;
        }

        if (!order) {
          setError(t("common.error"));
          setLoading(false);
          return;
        }

        // Check if order is cancelled
        if (order.status === "cancelled") {
          setError(t("orders.status.cancelled"));
          setLoading(false);
          return;
        }

        // Set order data
        setOrderData(order);
        setFromAddress(order.pickup_address);
        setToAddress(order.delivery_address);

        // Set coordinates if available
        if (order.pickup_lat && order.pickup_lng) {
          setFromCoords({ lat: order.pickup_lat, lng: order.pickup_lng });
        }
        if (order.delivery_lat && order.delivery_lng) {
          setToCoords({ lat: order.delivery_lat, lng: order.delivery_lng });
        }

        // Load client info
        if (clientId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, phone")
            .eq("user_id", clientId)
            .single();

          if (profile) {
            setClientInfo({ name: profile.full_name || undefined, phone: profile.phone || undefined });
          }
        }

        // Auto-build route after data loaded with delay for map init
        setTimeout(() => {
          // Ensure map is properly sized before building route
          if (mapRef.current) {
            mapRef.current.invalidateSize();
          }
          buildRoute();
        }, 500);

      } catch (err) {
        console.error("Error loading data:", err);
        setError(t("common.error"));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [orderId, dealId, searchParams, t]);

  // Subscribe to order status changes (real-time)
  useEffect(() => {
    if (!orderData?.id) return;

    const channel = supabase
      .channel(`order-status-${orderData.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderData.id}`,
        },
        (payload) => {
          const newStatus = payload.new.status;
          if (newStatus === 'cancelled') {
            toast({
              title: t("orders.status.cancelled"),
              description: t("common.back"),
              variant: "destructive",
            });
            stopNavigation();
            navigate("/dashboard");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderData?.id, navigate, t, toast]);

  // Build route
  const buildRoute = useCallback(async () => {
    if (!fromAddress || !toAddress) return;

    setRouteLoading(true);
    setError(null);

    try {
      // Geocode if needed
      let origin = fromCoords;
      let destination = toCoords;

      if (!origin || !destination) {
        const { data, error: geoError } = await supabase.functions.invoke("google-directions", {
          body: {
            origin: origin || fromAddress,
            destination: destination || toAddress,
            travelMode: travelMode.toUpperCase(),
            alternatives: true,
          },
        });

        if (geoError) throw geoError;
        if (data.error) throw new Error(data.error);

        // Handle multiple routes or single route
        const routeList = data.routes || [data];
        setRoutes(routeList);
        setSelectedRouteIndex(0);

        if (routeList.length > 0) {
          drawRoutes(routeList, 0);
          // Announce route
          if (voiceSettings.enabled) {
            const route = routeList[0];
            speak(`${t("map.route")}. ${route.distance?.text}, ${route.duration?.text}`);
          }
        }
        return;
      }

      // Direct route with coords
      const { data, error: routeError } = await supabase.functions.invoke("google-directions", {
        body: {
          origin: { lat: origin.lat, lng: origin.lng },
          destination: { lat: destination.lat, lng: destination.lng },
          travelMode: travelMode.toUpperCase(),
          alternatives: true,
        },
      });

      if (routeError) throw routeError;
      if (data.error) throw new Error(data.error);

      const routeList = data.routes || [data];
      setRoutes(routeList);
      setSelectedRouteIndex(0);

      if (routeList.length > 0) {
        drawRoutes(routeList, 0);
        if (voiceSettings.enabled) {
          const route = routeList[0];
          speak(`${t("map.route")}. ${route.distance?.text}, ${route.duration?.text}`);
        }
      }
    } catch (err) {
      console.error("Route error:", err);
      setError(t("common.error"));
    } finally {
      setRouteLoading(false);
    }
  }, [fromAddress, toAddress, fromCoords, toCoords, travelMode, voiceSettings.enabled, speak, t]);

  // Draw routes on map
  const drawRoutes = useCallback((routeData: RouteData[], selectedIndex: number) => {
    if (!mapRef.current) return;

    // Clear existing
    routeLinesRef.current.forEach(line => mapRef.current?.removeLayer(line));
    routeLinesRef.current = [];
    markersRef.current.forEach(marker => mapRef.current?.removeLayer(marker));
    markersRef.current = [];

    // Draw alternatives first
    routeData.forEach((route, index) => {
      if (index === selectedIndex) return;
      const points = route.points.map(p => [p.lat, p.lng] as L.LatLngExpression);
      const line = L.polyline(points, {
        color: ROUTE_COLORS[index] || "#999",
        weight: 5,
        opacity: 0.4,
      }).addTo(mapRef.current!);
      line.on("click", () => setSelectedRouteIndex(index));
      routeLinesRef.current.push(line);
    });

    // Draw selected route on top
    const selectedRoute = routeData[selectedIndex];
    if (selectedRoute) {
      const points = selectedRoute.points.map(p => [p.lat, p.lng] as L.LatLngExpression);

      // Shadow
      const shadow = L.polyline(points, {
        color: "#000",
        weight: 10,
        opacity: 0.15,
      }).addTo(mapRef.current!);
      routeLinesRef.current.push(shadow);

      // Main line
      const mainLine = L.polyline(points, {
        color: ROUTE_COLORS[selectedIndex] || "#4285F4",
        weight: 6,
        opacity: 0.9,
      }).addTo(mapRef.current!);
      routeLinesRef.current.push(mainLine);

      // Fit bounds
      mapRef.current.fitBounds(mainLine.getBounds(), { padding: [60, 60] });
      
      // Force invalidate size after drawing
      setTimeout(() => mapRef.current?.invalidateSize(), 100);

      // Markers
      const startPoint = selectedRoute.points[0];
      const endPoint = selectedRoute.points[selectedRoute.points.length - 1];

      // Start marker
      const startIcon = L.divIcon({
        className: "nav-marker-custom",
        html: `<div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-green-500 border-4 border-white shadow-xl flex items-center justify-center text-white font-bold text-sm">A</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
      const startMarker = L.marker([startPoint.lat, startPoint.lng], { icon: startIcon }).addTo(mapRef.current!);
      markersRef.current.push(startMarker);

      // End marker
      const endIcon = L.divIcon({
        className: "nav-marker-custom",
        html: `<div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-red-500 border-4 border-white shadow-xl flex items-center justify-center text-white font-bold text-sm">B</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
      const endMarker = L.marker([endPoint.lat, endPoint.lng], { icon: endIcon }).addTo(mapRef.current!);
      markersRef.current.push(endMarker);
    }
  }, []);

  // Stop navigation
  const stopNavigation = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (locationMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(locationMarkerRef.current);
      locationMarkerRef.current = null;
    }
    setIsNavigating(false);
    stopVoice();
  }, [stopVoice]);

  // Start navigation
  const startNavigation = useCallback(() => {
    if (!routes.length || !navigator.geolocation) {
      toast({ title: t("common.error"), variant: "destructive" });
      return;
    }

    setIsNavigating(true);
    setCurrentStepIndex(0);
    lastAnnouncedStepRef.current = -1;
    resetCameraAlerts();

    speak(t("carrier.navigation"));

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const speed = pos.coords.speed ? pos.coords.speed * 3.6 : 0; // m/s to km/h
        
        setCurrentSpeed(speed);
        
        // Calculate heading
        if (lastPosition) {
          const heading = calculateBearing(lastPosition, coords);
          setCurrentHeading(heading);
        }
        setLastPosition(coords);
        setCurrentPosition(coords);

        // Update location marker
        if (mapRef.current) {
          if (locationMarkerRef.current) {
            locationMarkerRef.current.setLatLng([coords.lat, coords.lng]);
          } else {
            const icon = L.divIcon({
              className: "location-marker",
              html: `<div class="w-6 h-6 rounded-full bg-blue-500 border-4 border-white shadow-lg animate-pulse"></div>`,
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            });
            locationMarkerRef.current = L.marker([coords.lat, coords.lng], { icon, zIndexOffset: 1000 }).addTo(mapRef.current);
          }

          if (followMeMode) {
            mapRef.current.setView([coords.lat, coords.lng], 17, { animate: true });
          }
        }

        // Check speed cameras
        checkSpeedCamera(coords, speed);

        // Update GPS in database
        if (dealId) {
          supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
              supabase.from("gps_locations").insert({
                deal_id: dealId,
                carrier_id: user.id,
                latitude: coords.lat,
                longitude: coords.lng,
              });
            }
          });
        }

        // Check current step and announce
        if (routes.length > 0 && routes[selectedRouteIndex]) {
          const route = routes[selectedRouteIndex];
          
          for (let i = 0; i < route.steps.length; i++) {
            const step = route.steps[i];
            const distToStep = calculateDistance(
              coords.lat,
              coords.lng,
              step.startLocation.lat,
              step.startLocation.lng
            );
            
            // Announce step when within 100m and not already announced
            if (distToStep < 0.1 && i !== lastAnnouncedStepRef.current) {
              lastAnnouncedStepRef.current = i;
              setCurrentStepIndex(i);
              
              if (voiceSettings.enabled) {
                const distanceText = step.distance.text;
                speakInstruction(step.instruction, distanceText);
              }
              break;
            }
          }
          
          // Check proximity to destination
          const lastStep = route.steps[route.steps.length - 1];
          const distToDest = calculateDistance(
            coords.lat,
            coords.lng,
            lastStep.endLocation.lat,
            lastStep.endLocation.lng
          );
          
          if (distToDest < 0.05 && voiceSettings.enabled) {
            speak("Вы прибыли к месту назначения");
            stopNavigation();
          }
        }
      },
      (err) => {
        console.error("GPS error:", err);
        setError(err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
    );
  }, [routes, selectedRouteIndex, dealId, followMeMode, speak, speakInstruction, t, toast, calculateBearing, calculateDistance, checkSpeedCamera, resetCameraAlerts, lastPosition, voiceSettings.enabled, stopNavigation]);

  // Handle voice settings change
  const handleVoiceSettingsChange = useCallback((newSettings: VoiceSettings) => {
    setVoiceSettings(newSettings);
    updateVoiceSettings(newSettings.gender, newSettings.rate);
  }, [updateVoiceSettings]);

  // Resize map when loading finishes
  useEffect(() => {
    if (!loading && mapRef.current) {
      setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 200);
    }
  }, [loading]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopNavigation();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [stopNavigation]);

  const selectedRoute = routes[selectedRouteIndex];

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !routes.length) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
        <div className="text-center space-y-4 p-6">
          <AlertTriangle className="w-12 h-12 mx-auto text-destructive" />
          <p className="text-destructive text-lg">{error}</p>
          <Button onClick={() => navigate("/dashboard")}>
            {t("common.back")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      {/* Header - Mobile optimized */}
      <header className="shrink-0 bg-background/95 backdrop-blur border-b px-3 sm:px-4 py-2 sm:py-3 z-20">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0 h-10 w-10 min-h-[44px] min-w-[44px]"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div className="flex-1 min-w-0 text-center">
            <h1 className="font-semibold text-sm sm:text-base truncate">
              {t("carrier.navigation")}
            </h1>
            {selectedRoute && (
              <p className="text-xs text-muted-foreground truncate">
                {selectedRoute.distance?.text} • {selectedRoute.durationInTraffic?.text || selectedRoute.duration?.text}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1">
            {isOffline && (
              <Badge variant="outline" className="text-orange-500 border-orange-500/30">
                <CloudOff className="w-3 h-3 mr-1" />
                Offline
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleVoiceSettingsChange({ ...voiceSettings, enabled: !voiceSettings.enabled })}
              className="h-10 w-10 min-h-[44px] min-w-[44px]"
            >
              {voiceSettings.enabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Map - Full screen with explicit sizing */}
      <div className="flex-1 relative overflow-hidden" style={{ minHeight: '300px' }}>
        <div 
          ref={mapContainerRef} 
          className="absolute inset-0 z-0 bg-muted"
          style={{ 
            minHeight: '300px',
            width: '100%',
            height: '100%'
          }}
        />

        {/* Speed Camera Overlay */}
        {nearbyCamera && (
          <SpeedCameraOverlay camera={nearbyCamera} currentSpeed={currentSpeed} />
        )}

        {/* Current Navigation Instruction */}
        {isNavigating && selectedRoute && selectedRoute.steps[currentStepIndex] && (
          <div className="absolute top-3 left-3 right-3 z-10">
            <NavigationInstruction
              instruction={selectedRoute.steps[currentStepIndex].instruction}
              distance={selectedRoute.steps[currentStepIndex].distance.text}
              maneuver={selectedRoute.steps[currentStepIndex].maneuver}
              currentSpeed={currentSpeed}
            />
          </div>
        )}

        {/* Map Controls - Mobile bottom-right */}
        <div className="absolute right-3 bottom-32 sm:bottom-40 flex flex-col gap-2 z-10">
          <Button
            variant={followMeMode ? "default" : "secondary"}
            size="icon"
            onClick={() => setFollowMeMode(!followMeMode)}
            className="h-11 w-11 rounded-full shadow-lg"
          >
            <Locate className="w-5 h-5" />
          </Button>
          <MapStyleSelector value={mapStyle} onChange={setMapStyle} />
        </div>

        {/* Compass when navigating */}
        {isNavigating && (
          <div className="absolute top-3 right-3 bg-background/90 rounded-full p-2 shadow-lg z-10">
            <Compass 
              className="w-8 h-8 text-primary transition-transform duration-300" 
              style={{ transform: `rotate(${-currentHeading}deg)` }}
            />
          </div>
        )}
      </div>

      {/* Bottom Panel - Mobile optimized */}
      <div className={cn(
        "shrink-0 bg-background border-t transition-all duration-300 z-20",
        panelCollapsed ? "h-16" : "max-h-[45vh] sm:max-h-[40vh]"
      )}>
        {/* Panel Toggle */}
        <button
          onClick={() => setPanelCollapsed(!panelCollapsed)}
          className="w-full flex items-center justify-center py-2 hover:bg-muted/50 touch-manipulation"
        >
          <div className="w-12 h-1 bg-muted-foreground/30 rounded-full" />
        </button>

        {!panelCollapsed && (
          <div className="px-3 sm:px-4 pb-4 overflow-y-auto max-h-[calc(45vh-3rem)] sm:max-h-[calc(40vh-3rem)]">
            {/* Order Info - Read Only */}
            {orderData && (
              <Card className="mb-3">
                <CardContent className="p-3">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      <p className="text-sm truncate flex-1">{fromAddress}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                      <p className="text-sm truncate flex-1">{toAddress}</p>
                    </div>
                    {orderData.client_price && (
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-sm text-muted-foreground">{t("orders.price")}</span>
                        <span className="font-semibold">{orderData.client_price.toLocaleString()} {t("common.currency")}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Route Info */}
            {selectedRoute && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <RouteIcon className="w-4 h-4 mx-auto mb-1 text-primary" />
                  <p className="text-xs text-muted-foreground">{t("calculator.distance")}</p>
                  <p className="font-semibold text-sm">{selectedRoute.distance?.text}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <Clock className="w-4 h-4 mx-auto mb-1 text-primary" />
                  <p className="text-xs text-muted-foreground">ETA</p>
                  <p className="font-semibold text-sm">{selectedRoute.durationInTraffic?.text || selectedRoute.duration?.text}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <Car className="w-4 h-4 mx-auto mb-1 text-primary" />
                  <p className="text-xs text-muted-foreground">{t("calculator.vehicleType")}</p>
                  <p className="font-semibold text-sm capitalize">{travelMode}</p>
                </div>
              </div>
            )}

            {/* Client Info */}
            {clientInfo?.phone && (
              <Button
                variant="outline"
                className="w-full mb-3 h-11 min-h-[44px]"
                onClick={() => window.open(`tel:${clientInfo.phone}`, "_self")}
              >
                <Phone className="w-4 h-4 mr-2" />
                {clientInfo.name || t("deals.client")}: {clientInfo.phone}
              </Button>
            )}

            {/* Route Alternatives */}
            {routes.length > 1 && (
              <RouteAlternativesPanel
                routes={routes}
                selectedIndex={selectedRouteIndex}
                onSelectRoute={(index) => {
                  setSelectedRouteIndex(index);
                  drawRoutes(routes, index);
                }}
              />
            )}

            {/* Navigation Controls */}
            <div className="flex gap-2">
              {!isNavigating ? (
                <>
                  <Button 
                    onClick={buildRoute} 
                    disabled={routeLoading}
                    variant="outline"
                    className="flex-1 h-12 min-h-[44px]"
                  >
                    {routeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("map.route")}
                  </Button>
                  <Button 
                    onClick={startNavigation} 
                    disabled={!routes.length}
                    className="flex-1 h-12 min-h-[44px] bg-green-600 hover:bg-green-700"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {t("deals.startDelivery")}
                  </Button>
                </>
              ) : (
                <Button 
                  onClick={stopNavigation} 
                  variant="destructive"
                  className="w-full h-12 min-h-[44px]"
                >
                  <Square className="w-4 h-4 mr-2" />
                  {t("common.cancel")}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UnifiedNavigator;
