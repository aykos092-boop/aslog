import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AddressAutocomplete } from "@/components/navigation/AddressAutocomplete";
import { useVoiceNavigation } from "@/hooks/useVoiceNavigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  ArrowLeft, 
  Navigation, 
  MapPin, 
  Clock, 
  Route as RouteIcon,
  Volume2,
  VolumeX,
  Locate,
  Car,
  Footprints,
  Bike,
  ChevronDown,
  ChevronUp,
  Play,
  Square,
  RotateCcw,
  Loader2
} from "lucide-react";

interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  maneuver: string;
  name: string;
}

interface RouteData {
  distance: number;
  duration: number;
  geometry: [number, number][];
  steps: RouteStep[];
}

interface Coords {
  lat: number;
  lng: number;
}

type TravelMode = "driving" | "walking" | "cycling";

const OSRM_PROFILES: Record<TravelMode, string> = {
  driving: "car",
  walking: "foot",
  cycling: "bike"
};

// OSRM routing (free public API)
const fetchRoute = async (
  origin: Coords,
  destination: Coords,
  mode: TravelMode
): Promise<RouteData | null> => {
  try {
    const profile = OSRM_PROFILES[mode];
    const url = `https://router.project-osrm.org/route/v1/${profile}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.code !== "Ok" || !data.routes?.length) {
      return null;
    }
    
    const route = data.routes[0];
    const steps: RouteStep[] = route.legs[0].steps.map((step: any) => ({
      instruction: translateManeuver(step.maneuver.type, step.maneuver.modifier, step.name),
      distance: step.distance,
      duration: step.duration,
      maneuver: step.maneuver.type,
      name: step.name || ""
    }));
    
    return {
      distance: route.distance,
      duration: route.duration,
      geometry: route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]),
      steps
    };
  } catch (error) {
    console.error("Routing error:", error);
    return null;
  }
};

// Translate OSRM maneuvers to Russian
const translateManeuver = (type: string, modifier: string | undefined, name: string): string => {
  const road = name ? ` на ${name}` : "";
  
  const maneuvers: Record<string, string> = {
    "turn-left": `Поверните налево${road}`,
    "turn-right": `Поверните направо${road}`,
    "turn-slight left": `Плавный поворот налево${road}`,
    "turn-slight right": `Плавный поворот направо${road}`,
    "turn-sharp left": `Резкий поворот налево${road}`,
    "turn-sharp right": `Резкий поворот направо${road}`,
    "straight": `Продолжайте прямо${road}`,
    "depart": `Начните движение${road}`,
    "arrive": "Вы прибыли к месту назначения",
    "merge-left": `Перестройтесь левее${road}`,
    "merge-right": `Перестройтесь правее${road}`,
    "roundabout": `Въезд на круговое движение${road}`,
    "rotary": `Въезд на круговое движение${road}`,
    "exit roundabout": `Съезд с кругового движения${road}`,
    "fork-left": `Держитесь левее на развилке${road}`,
    "fork-right": `Держитесь правее на развилке${road}`,
    "end of road-left": `В конце дороги налево${road}`,
    "end of road-right": `В конце дороги направо${road}`,
    "new name": `Продолжайте движение${road}`,
    "continue": `Продолжайте движение${road}`,
  };
  
  const key = modifier ? `${type}-${modifier}` : type;
  return maneuvers[key] || maneuvers[type] || `Продолжайте движение${road}`;
};

const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)} м`;
  }
  return `${(meters / 1000).toFixed(1)} км`;
};

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours} ч ${minutes} мин`;
  }
  return `${minutes} мин`;
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const maneuverIcons: Record<string, string> = {
  "turn": "↱",
  "turn-left": "←",
  "turn-right": "→",
  "straight": "↑",
  "depart": "🚗",
  "arrive": "🏁",
  "merge": "⤵",
  "roundabout": "↻",
  "rotary": "↻",
  "fork": "⑂",
  "end of road": "⤴",
  "new name": "↑",
  "continue": "↑",
};

// Geocode address using Nominatim
const geocodeAddress = async (address: string): Promise<Coords | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      { headers: { "Accept-Language": "ru,en" } }
    );
    const data = await response.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
};

export default function FreeNavigator() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { language } = useLanguage();
  
  // Form state
  const [originInput, setOriginInput] = useState("");
  const [destinationInput, setDestinationInput] = useState("");
  const [mode, setMode] = useState<TravelMode>("driving");
  
  // Route state
  const [route, setRoute] = useState<RouteData | null>(null);
  const [originCoords, setOriginCoords] = useState<Coords | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<Coords | null>(null);
  
  // Navigation state
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<Coords | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [followDriver, setFollowDriver] = useState(true);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelExpanded, setPanelExpanded] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [autoRouteBuilt, setAutoRouteBuilt] = useState(false);
  
  // Refs
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastAnnouncedStepRef = useRef<number>(-1);
  
  // Voice navigation
  const { speak, speakInstruction, stop: stopSpeaking, isSpeaking } = useVoiceNavigation({
    enabled: voiceEnabled,
    language: "ru"
  });

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    
    const map = L.map(mapContainerRef.current, {
      center: [41.2995, 69.2401], // Tashkent
      zoom: 12,
      zoomControl: false
    });
    
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    
    L.control.zoom({ position: "topright" }).addTo(map);
    
    mapRef.current = map;

    // Leaflet can initialize before the container gets its final size (especially in flex layouts).
    // Force a re-measure to ensure tiles render.
    setTimeout(() => {
      map.invalidateSize();
    }, 0);
    
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Recalculate map size when layout changes (mobile panel expand/collapse)
  useEffect(() => {
    if (!mapRef.current) return;
    const id = window.setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 200);
    return () => window.clearTimeout(id);
  }, [panelExpanded]);

  // Auto-fill from URL params (order data)
  useEffect(() => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    
    if (from) setOriginInput(decodeURIComponent(from));
    if (to) setDestinationInput(decodeURIComponent(to));
  }, [searchParams]);

  // Auto-build route when both addresses are from URL params
  useEffect(() => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    
    if (from && to && !autoRouteBuilt && originInput && destinationInput) {
      setAutoRouteBuilt(true);
      // Small delay to ensure map is ready
      setTimeout(() => {
        buildRoute();
      }, 500);
    }
  }, [searchParams, originInput, destinationInput, autoRouteBuilt]);

  // Build route
  const buildRoute = useCallback(async () => {
    if (!originInput.trim() || !destinationInput.trim()) {
      setError("Введите адреса отправления и назначения");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Use existing coords if available, otherwise geocode
      let origin = originCoords;
      let destination = destinationCoords;
      
      if (!origin) {
        origin = await geocodeAddress(originInput);
        if (origin) setOriginCoords(origin);
      }
      
      if (!destination) {
        destination = await geocodeAddress(destinationInput);
        if (destination) setDestinationCoords(destination);
      }
      
      if (!origin) {
        setError("Не удалось найти адрес отправления");
        setLoading(false);
        return;
      }
      
      if (!destination) {
        setError("Не удалось найти адрес назначения");
        setLoading(false);
        return;
      }
      
      // Fetch route
      const routeData = await fetchRoute(origin, destination, mode);
      
      if (!routeData) {
        setError("Не удалось построить маршрут");
        setLoading(false);
        return;
      }
      
      setRoute(routeData);
      drawRoute(routeData, origin, destination);
      
    } catch (err) {
      setError("Ошибка при построении маршрута");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [originInput, destinationInput, mode, originCoords, destinationCoords]);

  // Handle address selection from autocomplete
  const handleOriginSelect = useCallback((address: string, coords: Coords) => {
    setOriginCoords(coords);
  }, []);

  const handleDestinationSelect = useCallback((address: string, coords: Coords) => {
    setDestinationCoords(coords);
  }, []);

  // Draw route on map
  const drawRoute = useCallback((routeData: RouteData, origin: Coords, destination: Coords) => {
    if (!mapRef.current) return;
    
    // Clear existing layers
    if (routeLayerRef.current) {
      mapRef.current.removeLayer(routeLayerRef.current);
    }
    markersRef.current.forEach(m => mapRef.current?.removeLayer(m));
    markersRef.current = [];
    
    // Draw route polyline
    const polyline = L.polyline(routeData.geometry, {
      color: "#3B82F6",
      weight: 6,
      opacity: 0.8
    }).addTo(mapRef.current);
    routeLayerRef.current = polyline;
    
    // Origin marker (green)
    const originIcon = L.divIcon({
      className: "custom-marker",
      html: `<div style="background: #22C55E; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    const originMarker = L.marker([origin.lat, origin.lng], { icon: originIcon }).addTo(mapRef.current);
    markersRef.current.push(originMarker);
    
    // Destination marker (red)
    const destIcon = L.divIcon({
      className: "custom-marker",
      html: `<div style="background: #EF4444; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    const destMarker = L.marker([destination.lat, destination.lng], { icon: destIcon }).addTo(mapRef.current);
    markersRef.current.push(destMarker);
    
    // Fit bounds
    mapRef.current.fitBounds(polyline.getBounds(), { padding: [50, 50] });
  }, []);

  // Start navigation with GPS tracking
  const startNavigation = useCallback(() => {
    if (!route || !navigator.geolocation) {
      setError("Геолокация недоступна");
      return;
    }
    
    setIsNavigating(true);
    setCurrentStepIndex(0);
    lastAnnouncedStepRef.current = -1;
    
    speak("Навигация началась. Следуйте указаниям.");
    
    // Create driver marker
    if (mapRef.current && !driverMarkerRef.current) {
      const driverIcon = L.divIcon({
        className: "driver-marker",
        html: `<div style="background: #3B82F6; width: 20px; height: 20px; border-radius: 50%; border: 4px solid white; box-shadow: 0 0 0 3px #3B82F6, 0 4px 12px rgba(0,0,0,0.4);"></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      driverMarkerRef.current = L.marker([0, 0], { icon: driverIcon, zIndexOffset: 1000 });
    }
    
    // Start GPS tracking
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentPosition({ lat: latitude, lng: longitude });
        
        // Update driver marker
        if (driverMarkerRef.current && mapRef.current) {
          driverMarkerRef.current.setLatLng([latitude, longitude]);
          if (!mapRef.current.hasLayer(driverMarkerRef.current)) {
            driverMarkerRef.current.addTo(mapRef.current);
          }
          
          if (followDriver) {
            mapRef.current.setView([latitude, longitude], 17);
          }
        }
      },
      (err) => {
        console.error("GPS error:", err);
        setError("Ошибка GPS: " + err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000
      }
    );
  }, [route, speak, followDriver]);

  // Stop navigation
  const stopNavigation = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    
    if (driverMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(driverMarkerRef.current);
    }
    
    setIsNavigating(false);
    stopSpeaking();
    speak("Навигация остановлена");
  }, [stopSpeaking, speak]);

  // Update current step based on position
  useEffect(() => {
    if (!isNavigating || !currentPosition || !route) return;
    
    // Find closest step
    let minDistance = Infinity;
    let closestStep = currentStepIndex;
    
    let cumulativeDistance = 0;
    for (let i = 0; i < route.steps.length; i++) {
      const step = route.steps[i];
      cumulativeDistance += step.distance;
      
      // Calculate approximate position of step end
      const progress = cumulativeDistance / route.distance;
      const stepIndex = Math.floor(progress * (route.geometry.length - 1));
      const stepPoint = route.geometry[Math.min(stepIndex, route.geometry.length - 1)];
      
      if (stepPoint) {
        const dist = calculateDistance(
          currentPosition.lat,
          currentPosition.lng,
          stepPoint[0],
          stepPoint[1]
        );
        
        if (dist < minDistance) {
          minDistance = dist;
          closestStep = i;
        }
      }
    }
    
    // Update step if driver is close enough
    if (closestStep !== currentStepIndex && minDistance < 100) {
      setCurrentStepIndex(closestStep);
    }
    
    // Announce upcoming instruction
    if (voiceEnabled && route.steps[currentStepIndex]) {
      const step = route.steps[currentStepIndex];
      const distanceToStep = minDistance;
      
      // Announce at specific distances
      if (lastAnnouncedStepRef.current !== currentStepIndex) {
        if (distanceToStep < 200) {
          speakInstruction(step.instruction, formatDistance(distanceToStep));
          lastAnnouncedStepRef.current = currentStepIndex;
        }
      }
    }
    
    // Check if arrived
    if (destinationCoords) {
      const distToEnd = calculateDistance(
        currentPosition.lat,
        currentPosition.lng,
        destinationCoords.lat,
        destinationCoords.lng
      );
      
      if (distToEnd < 50) {
        speak("Вы прибыли к месту назначения!");
        stopNavigation();
      }
    }
  }, [currentPosition, isNavigating, route, currentStepIndex, voiceEnabled, destinationCoords, speakInstruction, speak, stopNavigation]);

  // Use current location as origin
  const useCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Геолокация недоступна");
      return;
    }
    
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setOriginCoords({ lat: latitude, lng: longitude });
        setOriginInput("Моё местоположение");
        
        // Reverse geocode for display
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { headers: { "Accept-Language": "ru" } }
          );
          const data = await response.json();
          if (data.display_name) {
            setOriginInput(data.display_name.split(",").slice(0, 3).join(","));
          }
        } catch (e) {
          console.error("Reverse geocoding failed:", e);
        }
        
        setLoading(false);
      },
      (err) => {
        setError("Не удалось определить местоположение");
        setLoading(false);
      },
      { enableHighAccuracy: true }
    );
  }, []);

  // Reset navigation
  const resetNavigation = useCallback(() => {
    stopNavigation();
    setRoute(null);
    setOriginCoords(null);
    setDestinationCoords(null);
    setCurrentStepIndex(0);
    setError(null);
    setAutoRouteBuilt(false);
    
    if (routeLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }
    markersRef.current.forEach(m => mapRef.current?.removeLayer(m));
    markersRef.current = [];
  }, [stopNavigation]);

  // Center on driver
  const centerOnDriver = useCallback(() => {
    if (currentPosition && mapRef.current) {
      mapRef.current.setView([currentPosition.lat, currentPosition.lng], 17);
      setFollowDriver(true);
    }
  }, [currentPosition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const currentStep = route?.steps[currentStepIndex];
  const nextStep = route?.steps[currentStepIndex + 1];

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row bg-background">
      {/* Left Panel */}
      <div className={`
        ${panelExpanded ? "h-1/2 md:h-full md:w-96" : "h-auto md:w-16"}
        flex-shrink-0 bg-card border-b md:border-b-0 md:border-r border-border
        flex flex-col transition-all duration-300 z-10
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            {panelExpanded && (
              <div>
                <h1 className="font-semibold text-foreground">Навигатор</h1>
                <p className="text-xs text-muted-foreground">OpenStreetMap + OSRM</p>
              </div>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setPanelExpanded(!panelExpanded)}
            className="md:hidden"
          >
            {panelExpanded ? <ChevronUp /> : <ChevronDown />}
          </Button>
        </div>

        {panelExpanded && (
          <>
            {/* Address inputs with autocomplete */}
            <div className="p-4 space-y-3 border-b border-border">
              <div className="flex gap-2">
                <AddressAutocomplete
                  value={originInput}
                  onChange={setOriginInput}
                  onSelect={handleOriginSelect}
                  placeholder="Откуда"
                  disabled={isNavigating}
                  icon={<MapPin className="h-4 w-4 text-green-500" />}
                  className="flex-1"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={useCurrentLocation}
                  disabled={loading || isNavigating}
                >
                  <Locate className="h-4 w-4" />
                </Button>
              </div>
              
              <AddressAutocomplete
                value={destinationInput}
                onChange={setDestinationInput}
                onSelect={handleDestinationSelect}
                placeholder="Куда"
                disabled={isNavigating}
                icon={<MapPin className="h-4 w-4 text-red-500" />}
              />
              
              {/* Travel mode */}
              <div className="flex gap-2">
                {([
                  { mode: "driving" as const, icon: Car, label: "Авто" },
                  { mode: "walking" as const, icon: Footprints, label: "Пешком" },
                  { mode: "cycling" as const, icon: Bike, label: "Велосипед" }
                ]).map(({ mode: m, icon: Icon, label }) => (
                  <Button
                    key={m}
                    variant={mode === m ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setMode(m)}
                    disabled={isNavigating}
                  >
                    <Icon className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">{label}</span>
                  </Button>
                ))}
              </div>
              
              <Button 
                className="w-full" 
                onClick={buildRoute}
                disabled={loading || isNavigating}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RouteIcon className="h-4 w-4 mr-2" />
                )}
                Построить маршрут
              </Button>
              
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>

            {/* Route info */}
            {route && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Summary */}
                <div className="p-4 border-b border-border bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <RouteIcon className="h-4 w-4 text-primary" />
                        <span className="font-medium">{formatDistance(route.distance)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="font-medium">{formatDuration(route.duration)}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setVoiceEnabled(!voiceEnabled)}
                    >
                      {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                    </Button>
                  </div>
                  
                  {/* Navigation controls */}
                  <div className="flex gap-2">
                    {!isNavigating ? (
                      <Button className="flex-1" onClick={startNavigation}>
                        <Play className="h-4 w-4 mr-2" />
                        Начать навигацию
                      </Button>
                    ) : (
                      <Button variant="destructive" className="flex-1" onClick={stopNavigation}>
                        <Square className="h-4 w-4 mr-2" />
                        Остановить
                      </Button>
                    )}
                    <Button variant="outline" size="icon" onClick={resetNavigation}>
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Current instruction */}
                {isNavigating && currentStep && (
                  <Card className="m-4 border-primary">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl">
                          {maneuverIcons[currentStep.maneuver] || "→"}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{currentStep.instruction}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDistance(currentStep.distance)}
                          </p>
                          {nextStep && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Затем: {nextStep.instruction}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Steps list */}
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-2">
                    {route.steps.map((step, index) => (
                      <div
                        key={index}
                        className={`
                          flex items-start gap-3 p-3 rounded-lg transition-colors
                          ${index === currentStepIndex && isNavigating
                            ? "bg-primary/10 border border-primary"
                            : index < currentStepIndex && isNavigating
                            ? "opacity-50"
                            : "hover:bg-muted"
                          }
                        `}
                      >
                        <div className={`
                          w-8 h-8 rounded-full flex items-center justify-center text-sm
                          ${index === currentStepIndex && isNavigating
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                          }
                        `}>
                          {maneuverIcons[step.maneuver] || (index + 1)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {step.instruction}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistance(step.distance)} • {formatDuration(step.duration)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative min-h-[320px]">
        <div ref={mapContainerRef} className="absolute inset-0" />
        
        {/* Map controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-[1000]">
          {isNavigating && currentPosition && (
            <Button
              variant={followDriver ? "default" : "secondary"}
              size="icon"
              onClick={centerOnDriver}
              className="shadow-lg"
            >
              <Navigation className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {/* Status badges */}
        <div className="absolute top-4 left-4 flex gap-2 z-[1000] md:hidden">
          {isNavigating && (
            <Badge variant="default" className="shadow-lg">
              <Navigation className="h-3 w-3 mr-1 animate-pulse" />
              Навигация
            </Badge>
          )}
          {isSpeaking && (
            <Badge variant="secondary" className="shadow-lg">
              <Volume2 className="h-3 w-3 mr-1" />
              Говорю...
            </Badge>
          )}
        </div>

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-[1001]">
            <div className="bg-card p-6 rounded-lg shadow-lg flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span>Построение маршрута...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
