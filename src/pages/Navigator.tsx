import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { 
  Navigation, MapPin, Clock, Route as RouteIcon, Car, 
  Footprints, Bus, Bike, ArrowLeft, Loader2,
  ChevronRight, DollarSign, AlertTriangle, RotateCcw,
  X, ChevronDown, ChevronUp, Compass, Locate, Camera, CloudOff
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { MapStyleSelector, MapStyle, mapTileUrls } from "@/components/map/MapStyleSelector";
import { cn } from "@/lib/utils";
import { useVoiceNavigation, VoiceGender } from "@/hooks/useVoiceNavigation";
import { VoiceSettingsPanel, VoiceSettings } from "@/components/navigation/VoiceSettingsPanel";
import { OpenInGoogleMapsButton } from "@/components/navigation/OpenInGoogleMapsButton";
import { useOfflineCache } from "@/hooks/useOfflineCache";
import { useSpeedCameraAlerts, SpeedCamera } from "@/hooks/useSpeedCameraAlerts";
import { SpeedCameraOverlay } from "@/components/navigation/SpeedCameraOverlay";
import { OfflineCacheStatus } from "@/components/navigation/OfflineCacheStatus";
import { RouteAlternativesPanel } from "@/components/navigation/RouteAlternativesPanel";

// Types
type TravelMode = "driving" | "walking" | "transit" | "bicycling";

interface RouteStep {
  instruction: string;
  distance: { text: string; value: number };
  duration: { text: string; value: number };
  startLocation: { lat: number; lng: number };
  endLocation: { lat: number; lng: number };
  maneuver?: string;
  travelMode?: string;
  transitDetails?: {
    lineName: string;
    lineColor: string;
    vehicleType: string;
    departureStop: string;
    arrivalStop: string;
    numStops: number;
  };
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

// Pricing config
const PRICING = {
  driving: { perKm: 15, currency: "₽" }, // рублей за км
  walking: { perKm: 0, currency: "₽" },
  transit: { perKm: 3, currency: "₽" }, // примерная стоимость транспорта
  bicycling: { perKm: 0, currency: "₽" },
};

// Route colors for alternatives
const ROUTE_COLORS = ["#4285F4", "#34A853", "#FBBC04", "#EA4335"];

// Translations
const translations = {
  ru: {
    title: "Навигатор",
    from: "Откуда",
    to: "Куда",
    buildRoute: "Построить маршрут",
    distance: "Расстояние",
    time: "Время в пути",
    withTraffic: "с учётом пробок",
    cost: "Стоимость",
    free: "Бесплатно",
    route: "Маршрут",
    alternatives: "Альтернативы",
    steps: "Пошаговые инструкции",
    step: "Шаг",
    driving: "Авто",
    walking: "Пешком",
    transit: "Транспорт",
    bicycling: "Велосипед",
    via: "через",
    loading: "Построение маршрута...",
    error: "Ошибка",
    noRoute: "Маршрут не найден",
    enterAddresses: "Введите адреса для построения маршрута",
    swapAddresses: "Поменять местами",
    myLocation: "Моё местоположение",
    fastest: "Быстрый",
    shortest: "Короткий",
    warnings: "Предупреждения",
    back: "Назад",
  },
  en: {
    title: "Navigator",
    from: "From",
    to: "To",
    buildRoute: "Build Route",
    distance: "Distance",
    time: "Travel Time",
    withTraffic: "with traffic",
    cost: "Cost",
    free: "Free",
    route: "Route",
    alternatives: "Alternatives",
    steps: "Step-by-step",
    step: "Step",
    driving: "Drive",
    walking: "Walk",
    transit: "Transit",
    bicycling: "Bicycle",
    via: "via",
    loading: "Building route...",
    error: "Error",
    noRoute: "Route not found",
    enterAddresses: "Enter addresses to build a route",
    swapAddresses: "Swap addresses",
    myLocation: "My location",
    fastest: "Fastest",
    shortest: "Shortest",
    warnings: "Warnings",
    back: "Back",
  },
  uz: {
    title: "Navigator",
    from: "Qayerdan",
    to: "Qayerga",
    buildRoute: "Yo'nalish qurish",
    distance: "Masofa",
    time: "Yo'l vaqti",
    withTraffic: "tirbandlik bilan",
    cost: "Narx",
    free: "Bepul",
    route: "Yo'nalish",
    alternatives: "Muqobil",
    steps: "Qadamlar",
    step: "Qadam",
    driving: "Avtomobil",
    walking: "Piyoda",
    transit: "Transport",
    bicycling: "Velosiped",
    via: "orqali",
    loading: "Yo'nalish qurilmoqda...",
    error: "Xato",
    noRoute: "Yo'nalish topilmadi",
    enterAddresses: "Yo'nalish qurish uchun manzillarni kiriting",
    swapAddresses: "Almashish",
    myLocation: "Mening joylashuvim",
    fastest: "Tez",
    shortest: "Qisqa",
    warnings: "Ogohlantirishlar",
    back: "Orqaga",
  },
};

const Navigator = () => {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId?: string }>();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.ru;

  // State
  const [fromAddress, setFromAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [travelMode, setTravelMode] = useState<TravelMode>("driving");
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [orderLoading, setOrderLoading] = useState(!!orderId);
  const [error, setError] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>("light");
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<Coords | null>(null);
  const [autoRouteBuilt, setAutoRouteBuilt] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [orderFromCoords, setOrderFromCoords] = useState<Coords | null>(null);
  const [orderToCoords, setOrderToCoords] = useState<Coords | null>(null);
  const [followMeMode, setFollowMeMode] = useState(false);
  const [currentHeading, setCurrentHeading] = useState<number>(0);
  const [lastPosition, setLastPosition] = useState<Coords | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [isOffline, setIsOffline] = useState(false);
  const [cameraMarkersRef] = useState<L.Marker[]>([]);
  
  // Voice settings state
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    enabled: true,
    gender: "male" as VoiceGender,
    rate: 1.0,
  });
  
  // Voice navigation hook with settings
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

  // Update voice settings when changed
  const handleVoiceSettingsChange = useCallback((newSettings: VoiceSettings) => {
    setVoiceSettings(newSettings);
    updateVoiceSettings(newSettings.gender, newSettings.rate);
  }, [updateVoiceSettings]);

  // Offline cache hook
  const { cacheRoute, getCachedRoute, preCacheTilesForRoute } = useOfflineCache();
  
  // Speed camera alerts hook
  const { 
    nearbyCamera, 
    checkPosition: checkSpeedCamera, 
    getAllCameras,
    resetAlerts: resetCameraAlerts,
  } = useSpeedCameraAlerts(voiceSettings.enabled, language);

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
  // Test voice
  const handleTestVoice = useCallback(() => {
    const testPhrase = language === "ru" 
      ? "Через 200 метров поверните направо"
      : "In 200 meters, turn right";
    speak(testPhrase);
  }, [speak, language]);
  
  // Refs
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const routeLinesRef = useRef<L.Polyline[]>([]);
  const markersRef = useRef<L.Marker[]>([]);
  const locationMarkerRef = useRef<L.Marker | null>(null);
  const lastAnnouncedStepRef = useRef<number>(-1);
  const watchIdRef = useRef<number | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const mapContainerWrapperRef = useRef<HTMLDivElement>(null);
  const cameraLayerRef = useRef<L.LayerGroup | null>(null);
  
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
  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([41.3, 69.3], 12); // Default to Tashkent

    const tileConfig = mapTileUrls[mapStyle];
    L.tileLayer(tileConfig.url, {
      maxZoom: 19,
      subdomains: tileConfig.subdomains || undefined,
    }).addTo(mapRef.current);

    L.control.zoom({ position: "bottomright" }).addTo(mapRef.current);

    // Try to get current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentPosition(coords);
          mapRef.current?.setView([coords.lat, coords.lng], 14);
        },
        () => console.log("Geolocation not available")
      );
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Load order data if orderId is provided
  useEffect(() => {
    const loadOrderData = async () => {
      if (!orderId) {
        // Check for URL params (from/to)
        const fromParam = searchParams.get("from");
        const toParam = searchParams.get("to");
        if (fromParam) setFromAddress(fromParam);
        if (toParam) setToAddress(toParam);
        return;
      }

      setOrderLoading(true);
      
      try {
        // First try to get order directly
        let orderData = null;
        
        const { data: directOrder } = await supabase
          .from("orders")
          .select("pickup_address, delivery_address, pickup_lat, pickup_lng, delivery_lat, delivery_lng")
          .eq("id", orderId)
          .single();
        
        if (directOrder) {
          orderData = directOrder;
        } else {
          // Try to get order through deal (for carriers)
          const { data: dealData } = await supabase
            .from("deals")
            .select(`
              order:orders(pickup_address, delivery_address, pickup_lat, pickup_lng, delivery_lat, delivery_lng)
            `)
            .eq("order_id", orderId)
            .single();
          
          if (dealData?.order) {
            orderData = dealData.order;
          }
        }

        if (orderData) {
          setFromAddress(orderData.pickup_address || "");
          setToAddress(orderData.delivery_address || "");

          // Prefer building routes directly to coordinates when available
          if (orderData.pickup_lat && orderData.pickup_lng) {
            setOrderFromCoords({ lat: orderData.pickup_lat, lng: orderData.pickup_lng });
          }
          if (orderData.delivery_lat && orderData.delivery_lng) {
            setOrderToCoords({ lat: orderData.delivery_lat, lng: orderData.delivery_lng });
          }
          
          console.log("Order data loaded:", orderData);
        } else {
          toast({
            title: t.error,
            description: "Заказ не найден",
            variant: "destructive",
          });
        }
      } catch (err) {
        console.error("Error loading order:", err);
      } finally {
        setOrderLoading(false);
      }
    };

    loadOrderData();
  }, [orderId, searchParams, toast, t]);

  // Auto-build route when addresses are loaded from order
  useEffect(() => {
    if (!autoRouteBuilt && fromAddress && toAddress && !orderLoading && orderId) {
      setAutoRouteBuilt(true);
      // Small delay to ensure map is ready
      setTimeout(() => {
        buildRoute();
      }, 500);
    }
  }, [fromAddress, toAddress, orderLoading, autoRouteBuilt, orderId]);

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

  // Clear map layers
  const clearMap = useCallback(() => {
    if (!mapRef.current) return;

    routeLinesRef.current.forEach(line => {
      mapRef.current?.removeLayer(line);
    });
    routeLinesRef.current = [];

    markersRef.current.forEach(marker => {
      mapRef.current?.removeLayer(marker);
    });
    markersRef.current = [];
  }, []);

  // Draw routes on map
  const drawRoutes = useCallback((routeData: RouteData[], selectedIndex: number) => {
    if (!mapRef.current) return;

    clearMap();

    // Draw all routes (alternatives first, selected route last to be on top)
    routeData.forEach((route, index) => {
      if (index === selectedIndex) return; // Skip selected, draw last

      const points = route.points.map(p => [p.lat, p.lng] as L.LatLngExpression);
      
      // Alternative route (faded)
      const line = L.polyline(points, {
        color: ROUTE_COLORS[index] || "#999",
        weight: 5,
        opacity: 0.4,
        lineCap: "round",
        lineJoin: "round",
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
        lineCap: "round",
        lineJoin: "round",
      }).addTo(mapRef.current!);
      routeLinesRef.current.push(shadow);

      // Main line
      const mainLine = L.polyline(points, {
        color: ROUTE_COLORS[selectedIndex] || "#4285F4",
        weight: 6,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(mapRef.current!);
      routeLinesRef.current.push(mainLine);

      // Fit bounds
      mapRef.current.fitBounds(mainLine.getBounds(), { padding: [60, 60] });

      // Add markers
      const startPoint = selectedRoute.points[0];
      const endPoint = selectedRoute.points[selectedRoute.points.length - 1];

      // Start marker (green)
      const startIcon = L.divIcon({
        className: "nav-marker-custom",
        html: `<div class="nav-point start"><span>A</span></div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
      const startMarker = L.marker([startPoint.lat, startPoint.lng], { icon: startIcon })
        .bindPopup(`<b>${t.from}</b><br/>${selectedRoute.startAddress}`)
        .addTo(mapRef.current!);
      markersRef.current.push(startMarker);

      // End marker (red)
      const endIcon = L.divIcon({
        className: "nav-marker-custom",
        html: `<div class="nav-point end"><span>B</span></div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
      const endMarker = L.marker([endPoint.lat, endPoint.lng], { icon: endIcon })
        .bindPopup(`<b>${t.to}</b><br/>${selectedRoute.endAddress}`)
        .addTo(mapRef.current!);
      markersRef.current.push(endMarker);
    }
  }, [clearMap, t]);

  // Build route
  const buildRoute = useCallback(async () => {
    if (!fromAddress.trim() || !toAddress.trim()) {
      toast({
        title: t.error,
        description: t.enterAddresses,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setError(null);
    setRoutes([]);

    // Generate cache key
    const origin = orderFromCoords ?? fromAddress;
    const destination = orderToCoords ?? toAddress;
    const cacheKey = JSON.stringify({ origin, destination, mode: travelMode });

    try {
      // Try to get cached route first (for offline mode)
      if (isOffline) {
        const cachedData = await getCachedRoute(
          typeof origin === "string" ? origin : `${origin.lat},${origin.lng}`,
          typeof destination === "string" ? destination : `${destination.lat},${destination.lng}`,
          travelMode
        );
        
        if (cachedData) {
          toast({
            title: "Офлайн режим",
            description: "Используется кэшированный маршрут",
          });
          const routeData = cachedData.routes as RouteData[];
          setRoutes(routeData);
          setSelectedRouteIndex(0);
          drawRoutes(routeData, 0);
          setLoading(false);
          return;
        }
      }

      const { data, error: fnError } = await supabase.functions.invoke("google-directions", {
        body: {
          origin,
          destination,
          mode: travelMode,
          alternatives: true,
          language: language === "uz" ? "ru" : language,
        },
      });

      if (fnError) throw fnError;

      if (data.error) {
        setError(data.message || data.error);
        toast({
          title: t.error,
          description: data.message || t.noRoute,
          variant: "destructive",
        });
        return;
      }

      const routeData = data.routes as RouteData[];
      setRoutes(routeData);
      setSelectedRouteIndex(0);
      drawRoutes(routeData, 0);

      // Cache the route for offline use
      await cacheRoute(
        typeof origin === "string" ? origin : `${origin.lat},${origin.lng}`,
        typeof destination === "string" ? destination : `${destination.lat},${destination.lng}`,
        travelMode,
        data
      );

      // Pre-cache map tiles for the route bounds
      if (routeData[0]?.bounds) {
        const tileUrl = mapTileUrls[mapStyle].url;
        preCacheTilesForRoute(routeData[0].bounds, tileUrl, [14, 15, 16]).catch(console.error);
      }

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : t.noRoute;
      setError(errMsg);
      toast({
        title: t.error,
        description: errMsg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [fromAddress, toAddress, orderFromCoords, orderToCoords, travelMode, language, toast, t, drawRoutes, isOffline, getCachedRoute, cacheRoute, preCacheTilesForRoute, mapStyle]);

  const handleBack = useCallback(() => {
    // If user opened /navigator/:id directly, history back can be a no-op
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/dashboard");
    }
  }, [navigate]);

  // Define selectedRoute early so it can be used in callbacks
  const selectedRoute = routes[selectedRouteIndex];

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = useCallback((pos1: Coords, pos2: Coords): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
    const dLon = (pos2.lng - pos1.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Find the next maneuver and announce it
  const checkAndAnnounceManeuver = useCallback((currentPos: Coords) => {
    if (!selectedRoute || !voiceSettings.enabled || !isNavigating) return;

    const steps = selectedRoute.steps;
    
    // Find closest step to current position
    let closestStepIndex = 0;
    let closestDistance = Infinity;
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const distance = calculateDistance(currentPos, step.startLocation);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestStepIndex = i;
      }
    }
    
    // Announce upcoming maneuvers (current and next)
    for (let i = closestStepIndex; i < Math.min(closestStepIndex + 2, steps.length); i++) {
      const step = steps[i];
      const stepStart = step.startLocation;
      const distance = calculateDistance(currentPos, stepStart);
      
      // Dynamic announce distances based on travel mode
      const announceDistances = travelMode === "walking" 
        ? [100, 50, 20] 
        : [1000, 500, 200, 100, 50];
      
      for (const announceDistance of announceDistances) {
        const tolerance = announceDistance * 0.15; // 15% tolerance
        
        if (distance <= announceDistance && distance > (announceDistance - tolerance)) {
          const announcementKey = i * 10000 + announceDistance;
          if (lastAnnouncedStepRef.current !== announcementKey) {
            lastAnnouncedStepRef.current = announcementKey;
            
            // Format distance for Russian speech
            let distanceText: string;
            if (distance >= 1000) {
              const km = Math.round(distance / 100) / 10;
              distanceText = km === 1 ? "1 километр" : 
                            km < 5 ? `${km} километра` : `${km} километров`;
            } else {
              const m = Math.round(distance / 50) * 50; // Round to nearest 50m
              distanceText = m === 1 ? "1 метр" : 
                            m < 5 ? `${m} метра` : `${m} метров`;
            }
            
            speakInstruction(step.instruction, distanceText);
            return;
          }
        }
      }
    }
    
    // Check if arrived at destination
    const lastStep = steps[steps.length - 1];
    if (lastStep) {
      const distanceToEnd = calculateDistance(currentPos, lastStep.endLocation);
      if (distanceToEnd < 30 && lastAnnouncedStepRef.current !== -999) {
        lastAnnouncedStepRef.current = -999;
        speak("Вы прибыли к месту назначения. Хорошего дня!");
      } else if (distanceToEnd < 100 && lastAnnouncedStepRef.current !== -998) {
        lastAnnouncedStepRef.current = -998;
        speak("Пункт назначения рядом, слева");
      }
    }
  }, [selectedRoute, voiceSettings.enabled, isNavigating, travelMode, calculateDistance, speakInstruction, speak]);

  // Start real-time navigation with GPS tracking
  const startNavigation = useCallback(() => {
    if (!navigator.geolocation) {
      toast({ title: t.error, description: "Геолокация недоступна" });
      return;
    }

    setIsNavigating(true);
    lastAnnouncedStepRef.current = -1;
    
    // Announce route start with details
    if (selectedRoute && voiceSettings.enabled) {
      const routeInfo = `Маршрут построен. ${selectedRoute.distance.text}, время в пути примерно ${selectedRoute.duration.text}`;
      speak(routeInfo);
      
      // Announce first instruction after a delay
      setTimeout(() => {
        if (selectedRoute.steps.length > 0) {
          speak(selectedRoute.steps[0].instruction);
        }
      }, 3000);
    }

    // Reset camera alerts
    resetCameraAlerts();

    // Watch position for real-time updates
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const speed = pos.coords.speed ? pos.coords.speed * 3.6 : 0; // Convert m/s to km/h
        setCurrentSpeed(speed);
        
        // Calculate heading from last position
        if (lastPosition) {
          const distance = calculateDistance(lastPosition, coords);
          if (distance > 3) { // Only update heading if moved more than 3 meters
            const newHeading = calculateBearing(lastPosition, coords);
            setCurrentHeading(newHeading);
          }
        }
        setLastPosition(coords);
        setCurrentPosition(coords);
        
        // Check for speed cameras
        checkSpeedCamera(coords, speed);
        
        // Update location marker on map with rotation
        if (mapRef.current) {
          if (locationMarkerRef.current) {
            locationMarkerRef.current.setLatLng([coords.lat, coords.lng]);
            // Update marker rotation
            const markerElement = locationMarkerRef.current.getElement();
            if (markerElement) {
              const arrowElement = markerElement.querySelector('.location-arrow') as HTMLElement;
              if (arrowElement) {
                arrowElement.style.transform = `rotate(${currentHeading}deg)`;
              }
            }
          } else {
            const locationIcon = L.divIcon({
              className: "nav-marker-custom",
              html: `
                <div class="location-container">
                  <div class="location-arrow" style="transform: rotate(${currentHeading}deg)">
                    <svg viewBox="0 0 24 24" fill="currentColor" class="arrow-svg">
                      <path d="M12 2L4 20L12 16L20 20L12 2Z"/>
                    </svg>
                  </div>
                  <div class="location-dot-inner"></div>
                  <div class="location-pulse"></div>
                </div>
              `,
              iconSize: [60, 60],
              iconAnchor: [30, 30],
            });
            locationMarkerRef.current = L.marker([coords.lat, coords.lng], { icon: locationIcon })
              .addTo(mapRef.current);
          }
          
          // Follow me mode: rotate map and keep centered
          if (followMeMode) {
            // Rotate map container based on heading
            if (mapContainerWrapperRef.current) {
              mapContainerWrapperRef.current.style.transform = `rotate(${-currentHeading}deg)`;
            }
            // Zoom in more for follow mode
            if (mapRef.current.getZoom() < 17) {
              mapRef.current.setZoom(17);
            }
            mapRef.current.panTo([coords.lat, coords.lng], { animate: true, duration: 0.3 });
          } else {
            // Normal mode - no rotation
            if (mapContainerWrapperRef.current) {
              mapContainerWrapperRef.current.style.transform = 'rotate(0deg)';
            }
            mapRef.current.panTo([coords.lat, coords.lng], { animate: true, duration: 0.5 });
          }
        }
        
        // Check for maneuver announcements
        checkAndAnnounceManeuver(coords);
      },
      (err) => {
        console.error("GPS error:", err);
        toast({ title: t.error, description: "Ошибка определения местоположения. Проверьте GPS." });
      },
      { 
        enableHighAccuracy: true, 
        maximumAge: 2000, 
        timeout: 10000 
      }
    );
  }, [selectedRoute, voiceSettings.enabled, speak, checkAndAnnounceManeuver, toast, t, lastPosition, calculateDistance, calculateBearing, currentHeading, followMeMode]);

  // Stop navigation
  const stopNavigation = useCallback(() => {
    setIsNavigating(false);
    setFollowMeMode(false);
    stopVoice();
    
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    
    if (locationMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(locationMarkerRef.current);
      locationMarkerRef.current = null;
    }
    
    // Reset map rotation
    if (mapContainerWrapperRef.current) {
      mapContainerWrapperRef.current.style.transform = 'rotate(0deg)';
    }
  }, [stopVoice]);
  
  // Toggle follow me mode
  const toggleFollowMe = useCallback(() => {
    setFollowMeMode(prev => !prev);
    if (!followMeMode && mapRef.current && currentPosition) {
      mapRef.current.setZoom(17);
      mapRef.current.panTo([currentPosition.lat, currentPosition.lng]);
    } else if (mapContainerWrapperRef.current) {
      mapContainerWrapperRef.current.style.transform = 'rotate(0deg)';
    }
  }, [followMeMode, currentPosition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      stopVoice();
    };
  }, [stopVoice]);

  // Update route when selected index changes
  useEffect(() => {
    if (routes.length > 0) {
      drawRoutes(routes, selectedRouteIndex);
    }
  }, [selectedRouteIndex, routes, drawRoutes]);

  // Swap addresses
  const swapAddresses = () => {
    const temp = fromAddress;
    setFromAddress(toAddress);
    setToAddress(temp);
  };

  // Use current location
  const useMyLocation = () => {
    if (currentPosition) {
      setFromAddress(`${currentPosition.lat.toFixed(6)}, ${currentPosition.lng.toFixed(6)}`);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setFromAddress(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
          setCurrentPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          toast({ title: t.error, description: "Не удалось получить местоположение" });
        }
      );
    }
  };

  // Calculate cost
  const calculateCost = (distanceMeters: number): string => {
    const distanceKm = distanceMeters / 1000;
    const pricing = PRICING[travelMode];
    const cost = distanceKm * pricing.perKm;
    
    if (cost === 0) return t.free;
    return `${Math.round(cost).toLocaleString()} ${pricing.currency}`;
  };

  // Get mode icon
  const getModeIcon = (mode: TravelMode) => {
    switch (mode) {
      case "driving": return Car;
      case "walking": return Footprints;
      case "transit": return Bus;
      case "bicycling": return Bike;
    }
  };

  // selectedRoute is already defined above

  // Show loading while fetching order data
  if (orderLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Загрузка данных заказа...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col sm:flex-row bg-background">
      {/* Left Panel */}
      <div 
        className={cn(
          "bg-background border-b sm:border-b-0 sm:border-r shadow-xl flex flex-col transition-all duration-300 z-10",
          panelCollapsed ? "h-0 overflow-hidden sm:h-full sm:w-0" : "w-full sm:w-[400px]"
        )}
      >
        {/* Header */}
        <div className="p-4 border-b bg-card shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Navigation className="h-5 w-5 text-primary" />
              {t.title}
            </h1>
          </div>

          {/* Address Inputs */}
          <div className="space-y-3">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
              <Input
                placeholder={t.from}
                value={fromAddress}
                onChange={(e) => setFromAddress(e.target.value)}
                className="pl-10 pr-10"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={useMyLocation}
                title={t.myLocation}
              >
                <Navigation className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center justify-center">
              <Button variant="ghost" size="sm" onClick={swapAddresses} className="text-xs">
                <RotateCcw className="h-3 w-3 mr-1" />
                {t.swapAddresses}
              </Button>
            </div>

            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
              <Input
                placeholder={t.to}
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Travel Mode Tabs */}
          <Tabs value={travelMode} onValueChange={(v) => setTravelMode(v as TravelMode)} className="mt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="driving" className="text-xs">
                <Car className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">{t.driving}</span>
              </TabsTrigger>
              <TabsTrigger value="walking" className="text-xs">
                <Footprints className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">{t.walking}</span>
              </TabsTrigger>
              <TabsTrigger value="transit" className="text-xs">
                <Bus className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">{t.transit}</span>
              </TabsTrigger>
              <TabsTrigger value="bicycling" className="text-xs">
                <Bike className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">{t.bicycling}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Build Route Button */}
          <div className="flex gap-2 mt-4">
            <Button 
              className="flex-1" 
              onClick={buildRoute}
              disabled={loading || !fromAddress.trim() || !toAddress.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t.loading}
                </>
              ) : (
                <>
                  <RouteIcon className="h-4 w-4 mr-2" />
                  {t.buildRoute}
                </>
              )}
            </Button>
            
            {/* Voice Settings Panel */}
            <VoiceSettingsPanel
              settings={voiceSettings}
              onChange={handleVoiceSettingsChange}
              isSpeaking={isSpeaking}
              onTestVoice={handleTestVoice}
            />
          </div>
          
          {/* Open in External Maps */}
          {selectedRoute && (
            <div className="mt-2">
              <OpenInGoogleMapsButton
                origin={fromAddress}
                destination={toAddress}
                travelMode={travelMode}
                className="w-full"
              />
            </div>
          )}
          
          {/* Start/Stop Navigation Button */}
          {selectedRoute && (
            <Button
              className="w-full mt-2"
              variant={isNavigating ? "destructive" : "default"}
              onClick={isNavigating ? stopNavigation : startNavigation}
            >
              {isNavigating ? (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Остановить навигацию
                </>
              ) : (
                <>
                  <Navigation className="h-4 w-4 mr-2" />
                  Начать навигацию
                </>
              )}
            </Button>
          )}
        </div>

        {/* Route Results */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <Card className="border-destructive bg-destructive/10">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <p className="text-sm">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Route Alternatives */}
          {routes.length > 1 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">{t.alternatives}</h3>
              <div className="grid gap-2">
                {routes.map((route, index) => {
                  const ModeIcon = getModeIcon(travelMode);
                  return (
                    <Card 
                      key={index}
                      className={cn(
                        "cursor-pointer transition-all",
                        selectedRouteIndex === index 
                          ? "ring-2 ring-primary bg-primary/5" 
                          : "hover:bg-muted/50"
                      )}
                      onClick={() => setSelectedRouteIndex(index)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: ROUTE_COLORS[index] }}
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {route.durationInTraffic?.text || route.duration.text}
                                </span>
                                <span className="text-muted-foreground text-sm">
                                  {route.distance.text}
                                </span>
                              </div>
                              {route.summary && (
                                <p className="text-xs text-muted-foreground">
                                  {t.via} {route.summary}
                                </p>
                              )}
                            </div>
                          </div>
                          {index === 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {t.fastest}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected Route Details */}
          {selectedRoute && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <RouteIcon className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-lg font-bold">{selectedRoute.distance.text}</p>
                    <p className="text-xs text-muted-foreground">{t.distance}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <Clock className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-lg font-bold">
                      {selectedRoute.durationInTraffic?.text || selectedRoute.duration.text}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.time}
                      {selectedRoute.durationInTraffic && (
                        <span className="block text-orange-500">{t.withTraffic}</span>
                      )}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <DollarSign className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-lg font-bold">
                      {calculateCost(selectedRoute.distance.value)}
                    </p>
                    <p className="text-xs text-muted-foreground">{t.cost}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Warnings */}
              {selectedRoute.warnings.length > 0 && (
                <Card className="border-amber-500/50 bg-amber-500/10">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                          {t.warnings}
                        </p>
                        {selectedRoute.warnings.map((warning, i) => (
                          <p key={i} className="text-xs text-muted-foreground">{warning}</p>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Steps */}
              <div>
                <button
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  onClick={() => setStepsExpanded(!stepsExpanded)}
                >
                  <span className="font-medium flex items-center gap-2">
                    <Navigation className="h-4 w-4" />
                    {t.steps} ({selectedRoute.steps.length})
                  </span>
                  {stepsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {stepsExpanded && (
                  <div className="mt-2 space-y-2">
                    {selectedRoute.steps.map((step, index) => (
                      <div 
                        key={index}
                        className="flex gap-3 p-3 rounded-lg bg-card border"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">{index + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{step.instruction}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>{step.distance.text}</span>
                            <span>•</span>
                            <span>{step.duration.text}</span>
                          </div>
                          {step.transitDetails && (
                            <div className="mt-2 flex items-center gap-2">
                              <Badge 
                                style={{ backgroundColor: step.transitDetails.lineColor }}
                                className="text-white"
                              >
                                {step.transitDetails.lineName}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {step.transitDetails.numStops} остановок
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && routes.length === 0 && !error && (
            <div className="text-center py-12 text-muted-foreground">
              <Navigation className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>{t.enterAddresses}</p>
            </div>
          )}
        </div>
      </div>

      {/* Panel Toggle (mobile) */}
      <button
        className={cn(
          "absolute left-1/2 -translate-x-1/2 z-20 bg-background border rounded-b-lg p-2 shadow-lg sm:hidden",
          panelCollapsed ? "top-0" : "top-[calc(100%-1px)]"
        )}
        onClick={() => setPanelCollapsed(!panelCollapsed)}
      >
        {panelCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
      </button>

      {/* Map */}
      <div className="flex-1 relative min-h-[320px] sm:min-h-0 overflow-hidden">
        <div 
          ref={mapContainerWrapperRef}
          className="absolute inset-0 w-full h-full transition-transform duration-300 ease-out"
          style={{ transformOrigin: 'center center' }}
        >
          <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
        </div>

        {/* Speed Camera Alert Overlay */}
        {isNavigating && nearbyCamera && (
          <div className="absolute top-4 left-4 right-20 z-20">
            <SpeedCameraOverlay 
              camera={nearbyCamera} 
              currentSpeed={currentSpeed}
            />
          </div>
        )}

        {/* Offline indicator */}
        {isOffline && (
          <div className="absolute top-4 left-4 z-20 bg-amber-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-lg">
            <CloudOff className="h-4 w-4" />
            <span className="text-sm font-medium">Офлайн</span>
          </div>
        )}

        {/* Compass indicator when in follow mode */}
        {followMeMode && isNavigating && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-background/90 backdrop-blur-sm rounded-full p-2 shadow-lg border">
            <Compass className="h-6 w-6 text-primary" />
          </div>
        )}

        {/* Map Controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
          <MapStyleSelector value={mapStyle} onChange={setMapStyle} />
          
          {/* Follow Me Toggle */}
          {isNavigating && (
            <Button
              variant={followMeMode ? "default" : "outline"}
              size="icon"
              onClick={toggleFollowMe}
              className={cn(
                "shadow-lg",
                followMeMode && "bg-primary text-primary-foreground"
              )}
              title={followMeMode ? "Отключить следование" : "Следовать за мной"}
            >
              <Locate className="h-5 w-5" />
            </Button>
          )}
        </div>
        
        {/* Current heading indicator */}
        {isNavigating && currentPosition && (
          <div className="absolute bottom-4 left-4 z-10 bg-background/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border">
            <div className="flex items-center gap-2 text-sm">
              <Compass className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{Math.round(currentHeading)}°</span>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-20">
            <div className="text-center">
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
              <p className="mt-2 font-medium">{t.loading}</p>
            </div>
          </div>
        )}
      </div>

      {/* Custom Styles */}
      <style>{`
        .nav-marker-custom {
          background: transparent !important;
          border: none !important;
        }
        .nav-point {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 16px;
          color: white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          border: 3px solid white;
        }
        .nav-point.start {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }
        .nav-point.end {
          background: linear-gradient(135deg, #ef4444, #dc2626);
        }
        
        /* Enhanced location marker with direction arrow */
        .location-container {
          width: 60px;
          height: 60px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .location-arrow {
          position: absolute;
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.3s ease-out;
          z-index: 2;
        }
        .arrow-svg {
          width: 36px;
          height: 36px;
          color: #4285F4;
          filter: drop-shadow(0 2px 4px rgba(66, 133, 244, 0.4));
        }
        .location-dot-inner {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #4285F4;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(66, 133, 244, 0.5);
          position: absolute;
          z-index: 3;
        }
        .location-pulse {
          position: absolute;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: rgba(66, 133, 244, 0.2);
          animation: pulse 2s ease-out infinite;
          z-index: 1;
        }
        @keyframes pulse {
          0% {
            transform: scale(0.5);
            opacity: 1;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
        
        /* Map rotation transition */
        .leaflet-container {
          transition: none !important;
        }
      `}</style>
    </div>
  );
};

export default Navigator;
