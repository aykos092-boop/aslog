import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { 
  Navigation, MapPin, Clock, Route as RouteIcon, Car, 
  Footprints, Bus, Bike, ArrowLeft, Search, X, Loader2,
  ChevronRight, DollarSign, Fuel, AlertTriangle, RotateCcw,
  Layers, Navigation2, Volume2, VolumeX, ChevronDown, ChevronUp
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
  const [error, setError] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>("light");
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<Coords | null>(null);
  
  // Refs
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const routeLinesRef = useRef<L.Polyline[]>([]);
  const markersRef = useRef<L.Marker[]>([]);

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

    try {
      const { data, error: fnError } = await supabase.functions.invoke("google-directions", {
        body: {
          origin: fromAddress,
          destination: toAddress,
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
  }, [fromAddress, toAddress, travelMode, language, toast, t, drawRoutes]);

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

  const selectedRoute = routes[selectedRouteIndex];

  return (
    <div className="fixed inset-0 z-50 flex bg-background">
      {/* Left Panel */}
      <div 
        className={cn(
          "h-full bg-background border-r shadow-xl flex flex-col transition-all duration-300 z-10",
          panelCollapsed ? "w-0 overflow-hidden" : "w-full sm:w-[400px]"
        )}
      >
        {/* Header */}
        <div className="p-4 border-b bg-card shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
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
                <Navigation2 className="h-4 w-4" />
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
          <Button 
            className="w-full mt-4" 
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
          "absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-background border rounded-r-lg p-2 shadow-lg sm:hidden",
          panelCollapsed ? "left-0" : "left-[100%] sm:left-[400px]"
        )}
        onClick={() => setPanelCollapsed(!panelCollapsed)}
      >
        {panelCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5 rotate-90" />}
      </button>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Map Controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <MapStyleSelector value={mapStyle} onChange={setMapStyle} />
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
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
      `}</style>
    </div>
  );
};

export default Navigator;
