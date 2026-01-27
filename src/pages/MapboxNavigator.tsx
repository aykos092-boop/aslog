import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { 
  Navigation, MapPin, Clock, Route as RouteIcon, Car, 
  ArrowLeft, Loader2, ChevronDown, ChevronUp, 
  Compass, Locate, Volume2, VolumeX, 
  Play, Square, Phone, AlertTriangle, Layers, Navigation2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { useVoiceNavigation, VoiceGender } from "@/hooks/useVoiceNavigation";
import { VoiceSettingsPanel, VoiceSettings } from "@/components/navigation/VoiceSettingsPanel";
import { MAPBOX_CONFIG } from "@/config/mapbox";
import { MapboxAddressSearch } from "@/components/navigation/MapboxAddressSearch";

// Set Mapbox token
mapboxgl.accessToken = MAPBOX_CONFIG.accessToken;

// Types
interface RouteStep {
  instruction: string;
  distance: { text: string; value: number };
  duration: { text: string; value: number };
  maneuver: string;
  location: [number, number];
}

interface RouteData {
  distance: { text: string; value: number };
  duration: { text: string; value: number };
  points: [number, number][];
  steps: RouteStep[];
  geometry: any;
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

type MapStyle = "streets" | "satellite" | "navigation-day" | "navigation-night" | "3d";

const MapboxNavigator = () => {
  const navigate = useNavigate();
  const { orderId, dealId } = useParams<{ orderId?: string; dealId?: string }>();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { language, t } = useLanguage();

  // Order data state
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [clientInfo, setClientInfo] = useState<{ name?: string; phone?: string } | null>(null);
  
  // Route state
  const [fromAddress, setFromAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [fromCoords, setFromCoords] = useState<Coords | null>(null);
  const [toCoords, setToCoords] = useState<Coords | null>(null);
  const [route, setRoute] = useState<RouteData | null>(null);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>("navigation-day");
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [is3DMode, setIs3DMode] = useState(true);
  
  // Navigation state
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<Coords | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [followMeMode, setFollowMeMode] = useState(false);
  const [currentHeading, setCurrentHeading] = useState<number>(0);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  
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
  } = useVoiceNavigation({ 
    enabled: voiceSettings.enabled, 
    language,
    gender: voiceSettings.gender,
    rate: voiceSettings.rate,
  });

  // Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const lastAnnouncedStepRef = useRef<number>(-1);

  // Format distance
  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} км`;
    }
    return `${Math.round(meters)} м`;
  };

  // Format duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours} ч ${minutes} мин`;
    }
    return `${minutes} мин`;
  };

  // Get map style URL
  const getMapStyleUrl = (style: MapStyle): string => {
    const styles: Record<MapStyle, string> = {
      streets: MAPBOX_CONFIG.styles.streets,
      satellite: MAPBOX_CONFIG.styles.satellite,
      "navigation-day": MAPBOX_CONFIG.styles.traffic,
      "navigation-night": MAPBOX_CONFIG.styles.trafficNight,
      "3d": MAPBOX_CONFIG.styles.streets,
    };
    return styles[style];
  };

  // Calculate distance between two points
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Build route using Mapbox Directions API
  const buildRoute = useCallback(async () => {
    if (!fromCoords || !toCoords) {
      console.log("Missing coordinates for route");
      return;
    }

    setRouteLoading(true);

    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${fromCoords.lng},${fromCoords.lat};${toCoords.lng},${toCoords.lat}?geometries=geojson&overview=full&steps=true&voice_instructions=true&banner_instructions=true&language=ru&access_token=${MAPBOX_CONFIG.accessToken}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!data.routes || data.routes.length === 0) {
        throw new Error("No route found");
      }

      const routeData = data.routes[0];
      const steps: RouteStep[] = routeData.legs[0].steps.map((step: any) => ({
        instruction: step.maneuver.instruction || step.name,
        distance: { text: formatDistance(step.distance), value: step.distance },
        duration: { text: formatDuration(step.duration), value: step.duration },
        maneuver: step.maneuver.type,
        location: step.maneuver.location,
      }));

      const newRoute: RouteData = {
        distance: { text: formatDistance(routeData.distance), value: routeData.distance },
        duration: { text: formatDuration(routeData.duration), value: routeData.duration },
        points: routeData.geometry.coordinates,
        steps,
        geometry: routeData.geometry,
      };

      setRoute(newRoute);

      // Draw route on map
      if (mapRef.current) {
        // Remove existing route layer
        if (mapRef.current.getLayer("route")) {
          mapRef.current.removeLayer("route");
        }
        if (mapRef.current.getSource("route")) {
          mapRef.current.removeSource("route");
        }

        // Add route source and layer
        mapRef.current.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: routeData.geometry,
          },
        });

        mapRef.current.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#4285F4",
            "line-width": 6,
            "line-opacity": 0.8,
          },
        });

        // Clear existing markers
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];

        // Add start marker
        const startMarker = new mapboxgl.Marker({ color: "#22C55E" })
          .setLngLat([fromCoords.lng, fromCoords.lat])
          .setPopup(new mapboxgl.Popup().setHTML(`<strong>Начало</strong><br/>${fromAddress}`))
          .addTo(mapRef.current);
        markersRef.current.push(startMarker);

        // Add end marker
        const endMarker = new mapboxgl.Marker({ color: "#EF4444" })
          .setLngLat([toCoords.lng, toCoords.lat])
          .setPopup(new mapboxgl.Popup().setHTML(`<strong>Конец</strong><br/>${toAddress}`))
          .addTo(mapRef.current);
        markersRef.current.push(endMarker);

        // Fit bounds
        const bounds = new mapboxgl.LngLatBounds();
        routeData.geometry.coordinates.forEach((coord: [number, number]) => {
          bounds.extend(coord);
        });
        mapRef.current.fitBounds(bounds, { padding: 80 });
      }

      toast({
        title: "Маршрут построен",
        description: `${newRoute.distance.text}, ${newRoute.duration.text}`,
      });

    } catch (err) {
      console.error("Route error:", err);
      toast({
        title: "Ошибка маршрута",
        description: "Не удалось построить маршрут",
        variant: "destructive",
      });
    } finally {
      setRouteLoading(false);
    }
  }, [fromCoords, toCoords, fromAddress, toAddress, toast]);

  // Initialize Mapbox map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    console.log("[Mapbox] Initializing map...");

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: getMapStyleUrl(mapStyle),
      center: [69.2401, 41.2995], // Tashkent
      zoom: 12,
      pitch: is3DMode ? 60 : 0,
      bearing: 0,
      antialias: true,
    });

    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");
    map.addControl(new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
    }), "bottom-right");

    // Add 3D buildings if in 3D mode
    map.on("load", () => {
      console.log("[Mapbox] Map loaded");

      if (is3DMode) {
        // Add 3D buildings layer
        const layers = map.getStyle().layers;
        const labelLayerId = layers?.find(
          (layer) => layer.type === "symbol" && layer.layout?.["text-field"]
        )?.id;

        map.addLayer(
          {
            id: "3d-buildings",
            source: "composite",
            "source-layer": "building",
            filter: ["==", "extrude", "true"],
            type: "fill-extrusion",
            minzoom: 15,
            paint: {
              "fill-extrusion-color": "#aaa",
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 0.6,
            },
          },
          labelLayerId
        );
      }

      // Add sky for 3D effect
      if (is3DMode) {
        map.addLayer({
          id: "sky",
          type: "sky",
          paint: {
            "sky-type": "atmosphere",
            "sky-atmosphere-sun": [0.0, 90.0],
            "sky-atmosphere-sun-intensity": 15,
          },
        });
      }

      // Try to get user location
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentPosition(coords);
          map.flyTo({ center: [coords.lng, coords.lat], zoom: 14 });
        },
        (err) => console.log("Geolocation error:", err),
        { enableHighAccuracy: true }
      );
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update map style
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setStyle(getMapStyleUrl(mapStyle));
    }
  }, [mapStyle]);

  // Toggle 3D mode
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.easeTo({
        pitch: is3DMode ? 60 : 0,
        duration: 1000,
      });
    }
  }, [is3DMode]);

  // Load order/deal data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        let order: OrderData | null = null;
        let clientId: string | null = null;

        if (dealId) {
          const { data, error: fetchError } = await supabase
            .from("deals")
            .select(`
              id, client_id, carrier_id, status,
              order:orders!order_id (
                id, pickup_address, delivery_address, cargo_type,
                pickup_lat, pickup_lng, delivery_lat, delivery_lng, client_price, status
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
        } else if (orderId) {
          const { data, error: fetchError } = await supabase
            .from("orders")
            .select("id, pickup_address, delivery_address, cargo_type, pickup_lat, pickup_lng, delivery_lat, delivery_lng, client_price, status, client_id")
            .eq("id", orderId)
            .single();

          if (fetchError) throw fetchError;
          order = data as OrderData;
          clientId = data.client_id;
        } else {
          const fromParam = searchParams.get("from");
          const toParam = searchParams.get("to");
          if (fromParam) setFromAddress(fromParam);
          if (toParam) setToAddress(toParam);
          setLoading(false);
          return;
        }

        if (!order) {
          setError("Заказ не найден");
          setLoading(false);
          return;
        }

        setOrderData(order);
        setFromAddress(order.pickup_address);
        setToAddress(order.delivery_address);

        if (order.pickup_lat && order.pickup_lng) {
          setFromCoords({ lat: order.pickup_lat, lng: order.pickup_lng });
        }
        if (order.delivery_lat && order.delivery_lng) {
          setToCoords({ lat: order.delivery_lat, lng: order.delivery_lng });
        }

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

      } catch (err) {
        console.error("Error loading data:", err);
        setError("Ошибка загрузки данных");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [orderId, dealId, searchParams]);

  // Build route when coordinates change
  useEffect(() => {
    if (fromCoords && toCoords && mapRef.current) {
      buildRoute();
    }
  }, [fromCoords, toCoords, buildRoute]);

  // Start navigation
  const startNavigation = () => {
    if (!route) return;

    setIsNavigating(true);
    setFollowMeMode(true);
    setCurrentStepIndex(0);
    lastAnnouncedStepRef.current = -1;

    // Announce start
    if (voiceSettings.enabled) {
      speak("Навигация началась. " + route.steps[0]?.instruction);
    }

    // Start GPS tracking
    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentPosition(coords);
          setCurrentSpeed(pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0);
          setCurrentHeading(pos.coords.heading || 0);

          // Update user marker
          if (mapRef.current) {
            if (!userMarkerRef.current) {
              const el = document.createElement("div");
              el.className = "user-location-marker";
              el.innerHTML = `
                <div style="width: 24px; height: 24px; background: #4285F4; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>
              `;
              userMarkerRef.current = new mapboxgl.Marker({ element: el })
                .setLngLat([coords.lng, coords.lat])
                .addTo(mapRef.current);
            } else {
              userMarkerRef.current.setLngLat([coords.lng, coords.lat]);
            }

            // Follow mode
            if (followMeMode) {
              mapRef.current.easeTo({
                center: [coords.lng, coords.lat],
                zoom: 17,
                bearing: pos.coords.heading || 0,
                pitch: 60,
                duration: 500,
              });
            }
          }

          // Check proximity to next step
          if (route.steps[currentStepIndex]) {
            const step = route.steps[currentStepIndex];
            const distanceToStep = calculateDistance(
              coords.lat, coords.lng,
              step.location[1], step.location[0]
            );

            // Announce upcoming instruction
            if (distanceToStep < 100 && lastAnnouncedStepRef.current !== currentStepIndex) {
              lastAnnouncedStepRef.current = currentStepIndex;
              if (voiceSettings.enabled) {
                speakInstruction(step.instruction, formatDistance(distanceToStep));
              }
            }

            // Move to next step
            if (distanceToStep < 30 && currentStepIndex < route.steps.length - 1) {
              setCurrentStepIndex(currentStepIndex + 1);
            }

            // Check arrival
            if (currentStepIndex === route.steps.length - 1 && distanceToStep < 50) {
              stopNavigation();
              if (voiceSettings.enabled) {
                speak("Вы прибыли к месту назначения!");
              }
              toast({
                title: "Прибытие",
                description: "Вы достигли конечной точки маршрута",
              });
            }
          }
        },
        (err) => console.error("GPS error:", err),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );
    }
  };

  // Stop navigation
  const stopNavigation = () => {
    setIsNavigating(false);
    setFollowMeMode(false);
    
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    stopVoice();
  };

  // Center on user
  const centerOnUser = () => {
    if (currentPosition && mapRef.current) {
      mapRef.current.flyTo({
        center: [currentPosition.lng, currentPosition.lat],
        zoom: 16,
        pitch: is3DMode ? 60 : 0,
      });
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentPosition(coords);
          if (mapRef.current) {
            mapRef.current.flyTo({
              center: [coords.lng, coords.lat],
              zoom: 16,
            });
          }
        },
        () => toast({ title: "Ошибка", description: "Не удалось определить местоположение", variant: "destructive" })
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Загрузка навигатора...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">{error}</h2>
            <Button onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Map Container */}
      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="absolute inset-0" />

        {/* Top Controls */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-start justify-between gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="shadow-lg"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div className="flex items-center gap-2">
            {/* Voice Controls */}
            <VoiceSettingsPanel
              settings={voiceSettings}
              onChange={setVoiceSettings}
              isSpeaking={isSpeaking}
              onTestVoice={() => speak("Тест голосовой навигации")}
            />

            {/* 3D Toggle */}
            <Button
              variant={is3DMode ? "default" : "secondary"}
              size="icon"
              className="shadow-lg"
              onClick={() => setIs3DMode(!is3DMode)}
              title="3D режим"
            >
              <Layers className="w-4 h-4" />
            </Button>

            {/* Style selector */}
            <Button
              variant="secondary"
              size="sm"
              className="shadow-lg gap-1"
              onClick={() => {
                const styles: MapStyle[] = ["navigation-day", "navigation-night", "streets", "satellite"];
                const currentIndex = styles.indexOf(mapStyle);
                setMapStyle(styles[(currentIndex + 1) % styles.length]);
              }}
            >
              <Navigation2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Center on user button */}
        <Button
          variant="secondary"
          size="icon"
          className="absolute bottom-32 right-4 z-10 shadow-lg"
          onClick={centerOnUser}
        >
          <Locate className="w-5 h-5" />
        </Button>

        {/* Navigation indicator */}
        {isNavigating && route && (
          <div className="absolute top-20 left-4 right-4 z-10">
            <Card className="bg-primary text-primary-foreground">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-foreground/20 rounded-full">
                    <Navigation className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-lg">
                      {route.steps[currentStepIndex]?.instruction}
                    </p>
                    <p className="text-sm opacity-80">
                      {route.steps[currentStepIndex]?.distance.text}
                    </p>
                  </div>
                  {currentSpeed > 0 && (
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      {currentSpeed} км/ч
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Bottom Panel */}
      <div className={cn(
        "bg-background border-t transition-all duration-300",
        panelCollapsed ? "h-16" : "h-auto max-h-[50vh]"
      )}>
        {/* Collapse handle */}
        <button
          className="w-full py-2 flex items-center justify-center"
          onClick={() => setPanelCollapsed(!panelCollapsed)}
        >
          {panelCollapsed ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {!panelCollapsed && (
          <div className="px-4 pb-4 space-y-4 overflow-y-auto">
            {/* Address inputs with Mapbox Search */}
            <div className="space-y-2">
              <MapboxAddressSearch
                placeholder="Откуда"
                value={fromAddress}
                onChange={setFromAddress}
                onSelect={(address, coords) => {
                  setFromAddress(address);
                  setFromCoords(coords);
                }}
              />
              <MapboxAddressSearch
                placeholder="Куда"
                value={toAddress}
                onChange={setToAddress}
                onSelect={(address, coords) => {
                  setToAddress(address);
                  setToCoords(coords);
                }}
              />
            </div>

            {/* Route info */}
            {route && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <RouteIcon className="w-5 h-5 text-muted-foreground" />
                        <span className="font-semibold">{route.distance.text}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-muted-foreground" />
                        <span className="font-semibold">{route.duration.text}</span>
                      </div>
                    </div>

                    {clientInfo?.phone && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`tel:${clientInfo.phone}`, "_self")}
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        Позвонить
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Navigation buttons */}
            <div className="flex gap-2">
              {!isNavigating ? (
                <Button
                  className="flex-1"
                  size="lg"
                  onClick={startNavigation}
                  disabled={!route || routeLoading}
                >
                  {routeLoading ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-5 h-5 mr-2" />
                  )}
                  Начать навигацию
                </Button>
              ) : (
                <Button
                  className="flex-1"
                  size="lg"
                  variant="destructive"
                  onClick={stopNavigation}
                >
                  <Square className="w-5 h-5 mr-2" />
                  Остановить
                </Button>
              )}

              <Button
                variant="outline"
                size="lg"
                onClick={buildRoute}
                disabled={routeLoading || !fromCoords || !toCoords}
              >
                <RouteIcon className="w-5 h-5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapboxNavigator;
