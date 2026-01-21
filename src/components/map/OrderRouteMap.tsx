import { useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLanguage } from "@/contexts/LanguageContext";
import { Navigation, Route, Clock } from "lucide-react";

// City coordinates for Central Asia
const cityCoordinates: Record<string, { lat: number; lon: number; country: string }> = {
  // Uzbekistan
  "Toshkent": { lat: 41.2995, lon: 69.2401, country: "UZ" },
  "Samarqand": { lat: 39.6542, lon: 66.9597, country: "UZ" },
  "Buxoro": { lat: 39.7747, lon: 64.4286, country: "UZ" },
  "Andijon": { lat: 40.7821, lon: 72.3442, country: "UZ" },
  "Namangan": { lat: 40.9983, lon: 71.6726, country: "UZ" },
  "Farg'ona": { lat: 40.3864, lon: 71.7864, country: "UZ" },
  "Qarshi": { lat: 38.8600, lon: 65.8000, country: "UZ" },
  "Nukus": { lat: 42.4619, lon: 59.6003, country: "UZ" },
  "Urganch": { lat: 41.5500, lon: 60.6333, country: "UZ" },
  "Jizzax": { lat: 40.1158, lon: 67.8422, country: "UZ" },
  "Termiz": { lat: 37.2242, lon: 67.2783, country: "UZ" },
  "Navoiy": { lat: 40.0844, lon: 65.3792, country: "UZ" },
  "Guliston": { lat: 40.4897, lon: 68.7842, country: "UZ" },
  "Chirchiq": { lat: 41.4689, lon: 69.5822, country: "UZ" },
  "Olmaliq": { lat: 40.8500, lon: 69.6000, country: "UZ" },
  // Kazakhstan
  "Almaty": { lat: 43.2220, lon: 76.8512, country: "KZ" },
  "Nur-Sultan": { lat: 51.1801, lon: 71.4460, country: "KZ" },
  "Shymkent": { lat: 42.3417, lon: 69.5969, country: "KZ" },
  "Aktobe": { lat: 50.2839, lon: 57.1670, country: "KZ" },
  "Karaganda": { lat: 49.8047, lon: 73.1094, country: "KZ" },
  "Taraz": { lat: 42.9000, lon: 71.3667, country: "KZ" },
  "Pavlodar": { lat: 52.2873, lon: 76.9674, country: "KZ" },
  "Ust-Kamenogorsk": { lat: 49.9481, lon: 82.6279, country: "KZ" },
  "Semey": { lat: 50.4111, lon: 80.2275, country: "KZ" },
  "Atyrau": { lat: 47.1164, lon: 51.9200, country: "KZ" },
  "Kostanay": { lat: 53.2198, lon: 63.6354, country: "KZ" },
  "Kyzylorda": { lat: 44.8479, lon: 65.5093, country: "KZ" },
  "Aktau": { lat: 43.6355, lon: 51.1986, country: "KZ" },
  "Turkestan": { lat: 43.3019, lon: 68.2506, country: "KZ" },
  "Petropavlovsk": { lat: 54.8753, lon: 69.1627, country: "KZ" },
  // Kyrgyzstan
  "Bishkek": { lat: 42.8746, lon: 74.5698, country: "KG" },
  "Osh": { lat: 40.5283, lon: 72.7985, country: "KG" },
  "Jalal-Abad": { lat: 41.0394, lon: 73.0014, country: "KG" },
  "Karakol": { lat: 42.4907, lon: 78.3936, country: "KG" },
  "Tokmok": { lat: 42.8333, lon: 75.3000, country: "KG" },
  "Naryn": { lat: 41.4286, lon: 76.0000, country: "KG" },
  "Batken": { lat: 40.0628, lon: 70.8194, country: "KG" },
  "Talas": { lat: 42.5183, lon: 72.2428, country: "KG" },
  "Isfana": { lat: 39.8383, lon: 69.5275, country: "KG" },
  "Kara-Balta": { lat: 42.8167, lon: 73.8667, country: "KG" },
  // Tajikistan
  "Dushanbe": { lat: 38.5598, lon: 68.7740, country: "TJ" },
  "Khujand": { lat: 40.2826, lon: 69.6221, country: "TJ" },
  "Kulob": { lat: 37.9142, lon: 69.7839, country: "TJ" },
  "Qurghonteppa": { lat: 37.8367, lon: 68.7714, country: "TJ" },
  "Istaravshan": { lat: 39.9142, lon: 69.0036, country: "TJ" },
  "Vahdat": { lat: 38.5561, lon: 69.0178, country: "TJ" },
  "Konibodom": { lat: 40.2933, lon: 70.4250, country: "TJ" },
  "Tursunzoda": { lat: 38.5128, lon: 68.2314, country: "TJ" },
  "Isfara": { lat: 40.1264, lon: 70.6250, country: "TJ" },
  "Panjakent": { lat: 39.4961, lon: 67.6086, country: "TJ" },
  // Turkmenistan
  "Ashgabat": { lat: 37.9601, lon: 58.3261, country: "TM" },
  "Türkmenabat": { lat: 39.0733, lon: 63.5786, country: "TM" },
  "Daşoguz": { lat: 41.8364, lon: 59.9667, country: "TM" },
  "Mary": { lat: 37.5936, lon: 61.8303, country: "TM" },
  "Balkanabat": { lat: 39.5108, lon: 54.3675, country: "TM" },
  "Bayramaly": { lat: 37.6178, lon: 62.1667, country: "TM" },
  "Türkmenbaşy": { lat: 40.0231, lon: 52.9697, country: "TM" },
  "Tejen": { lat: 37.3833, lon: 60.5000, country: "TM" },
  "Serdar": { lat: 38.9764, lon: 56.2756, country: "TM" },
  "Atamyrat": { lat: 37.8333, lon: 65.2167, country: "TM" },
  // Afghanistan
  "Kabul": { lat: 34.5553, lon: 69.2075, country: "AF" },
  "Herat": { lat: 34.3529, lon: 62.2040, country: "AF" },
  "Mazar-i-Sharif": { lat: 36.7069, lon: 67.1149, country: "AF" },
  "Kandahar": { lat: 31.6289, lon: 65.7372, country: "AF" },
  "Jalalabad": { lat: 34.4341, lon: 70.4500, country: "AF" },
  "Kunduz": { lat: 36.7281, lon: 68.8681, country: "AF" },
  "Balkh": { lat: 36.7583, lon: 66.8981, country: "AF" },
  "Ghazni": { lat: 33.5536, lon: 68.4267, country: "AF" },
  "Baghlan": { lat: 36.1303, lon: 68.7000, country: "AF" },
  "Khost": { lat: 33.3333, lon: 69.9167, country: "AF" },
};

const countryFlags: Record<string, string> = {
  UZ: "🇺🇿",
  KZ: "🇰🇿",
  KG: "🇰🇬",
  TJ: "🇹🇯",
  TM: "🇹🇲",
  AF: "🇦🇫",
};

interface OrderRouteMapProps {
  pickupCity: string;
  deliveryCity: string;
  className?: string;
}

// Haversine formula for distance calculation
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 1.3); // Road distance multiplier
};

// Estimate travel time (avg 60 km/h)
const estimateTravelTime = (distance: number): string => {
  const hours = Math.floor(distance / 60);
  const minutes = Math.round((distance % 60) / 60 * 60);
  if (hours === 0) return `${minutes} мин`;
  if (minutes === 0) return `${hours} ч`;
  return `${hours} ч ${minutes} мин`;
};

export const OrderRouteMap = ({ pickupCity, deliveryCity, className }: OrderRouteMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  const fromCoords = cityCoordinates[pickupCity];
  const toCoords = cityCoordinates[deliveryCity];

  const routeInfo = useMemo(() => {
    if (!fromCoords || !toCoords) return null;
    const distance = calculateDistance(fromCoords.lat, fromCoords.lon, toCoords.lat, toCoords.lon);
    const time = estimateTravelTime(distance);
    const isCrossBorder = fromCoords.country !== toCoords.country;
    return { distance, time, isCrossBorder };
  }, [fromCoords, toCoords]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: false,
      }).setView([41.3, 64.5], 5);

      // Use a clean map style
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;

    // Clear existing layers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.CircleMarker) {
        map.removeLayer(layer);
      }
    });

    if (!fromCoords || !toCoords) {
      map.setView([41.3, 64.5], 5);
      return;
    }

    // Create Apple-style markers
    const createAppleMarker = (color: string, emoji: string, label: string) => {
      return L.divIcon({
        className: "apple-marker",
        html: `
          <div style="
            position: relative;
            width: 44px;
            height: 44px;
          ">
            <div style="
              position: absolute;
              top: 0;
              left: 0;
              width: 44px;
              height: 44px;
              background: ${color};
              border-radius: 22px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.15), 0 0 0 4px rgba(255,255,255,0.9);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 20px;
              backdrop-filter: blur(10px);
              -webkit-backdrop-filter: blur(10px);
              animation: markerPulse 2s ease-in-out infinite;
            ">
              ${emoji}
            </div>
            <div style="
              position: absolute;
              top: 50px;
              left: 50%;
              transform: translateX(-50%);
              background: rgba(255,255,255,0.95);
              backdrop-filter: blur(10px);
              -webkit-backdrop-filter: blur(10px);
              padding: 4px 10px;
              border-radius: 8px;
              font-size: 11px;
              font-weight: 600;
              color: #1d1d1f;
              white-space: nowrap;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            ">
              ${label}
            </div>
          </div>
        `,
        iconSize: [44, 70],
        iconAnchor: [22, 22],
      });
    };

    // Add markers
    const fromMarker = L.marker([fromCoords.lat, fromCoords.lon], {
      icon: createAppleMarker("linear-gradient(135deg, #34c759, #30d158)", countryFlags[fromCoords.country] || "📍", pickupCity),
    }).addTo(map);

    const toMarker = L.marker([toCoords.lat, toCoords.lon], {
      icon: createAppleMarker("linear-gradient(135deg, #ff3b30, #ff453a)", countryFlags[toCoords.country] || "🏁", deliveryCity),
    }).addTo(map);

    // Generate optimal route waypoints (Bezier curve simulation)
    const generateRoutePoints = () => {
      const points: L.LatLngExpression[] = [];
      const steps = 50;
      
      // Control point for curve
      const midLat = (fromCoords.lat + toCoords.lat) / 2;
      const midLon = (fromCoords.lon + toCoords.lon) / 2;
      const offset = Math.abs(fromCoords.lon - toCoords.lon) * 0.1;
      
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        // Quadratic Bezier curve
        const lat = Math.pow(1 - t, 2) * fromCoords.lat + 
                   2 * (1 - t) * t * (midLat + offset) + 
                   Math.pow(t, 2) * toCoords.lat;
        const lon = Math.pow(1 - t, 2) * fromCoords.lon + 
                   2 * (1 - t) * t * midLon + 
                   Math.pow(t, 2) * toCoords.lon;
        points.push([lat, lon]);
      }
      return points;
    };

    const routePoints = generateRoutePoints();

    // Draw route with gradient effect
    // Background shadow
    L.polyline(routePoints, {
      color: "#000",
      weight: 8,
      opacity: 0.1,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);

    // Main route line
    L.polyline(routePoints, {
      color: "#007AFF",
      weight: 5,
      opacity: 0.9,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);

    // Animated dashed overlay
    L.polyline(routePoints, {
      color: "#fff",
      weight: 2,
      opacity: 0.6,
      dashArray: "10, 15",
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);

    // Fit bounds with padding
    const bounds = L.latLngBounds([
      [fromCoords.lat, fromCoords.lon],
      [toCoords.lat, toCoords.lon],
    ]);
    map.fitBounds(bounds, { padding: [60, 60] });

    return () => {};
  }, [pickupCity, deliveryCity, fromCoords, toCoords, t]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  if (!fromCoords || !toCoords) {
    return null;
  }

  return (
    <div className={`relative rounded-2xl overflow-hidden ${className}`}>
      {/* Apple-style glassmorphism info card */}
      <div className="absolute top-4 left-4 right-4 z-[1000] pointer-events-none">
        <div className="glass-card flex items-center justify-between gap-4 p-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground shadow-lg">
              <Route className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{t("calculator.distance")}</p>
              <p className="text-lg font-bold text-foreground">{routeInfo?.distance} {t("common.km")}</p>
            </div>
          </div>
          
          <div className="h-10 w-px bg-border/50" />
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-driver to-driver/80 flex items-center justify-center text-driver-foreground shadow-lg">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{t("orders.deliveryTime")}</p>
              <p className="text-lg font-bold text-foreground">~{routeInfo?.time}</p>
            </div>
          </div>

          {routeInfo?.isCrossBorder && (
            <>
              <div className="h-10 w-px bg-border/50" />
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                <span className="text-lg">{countryFlags[fromCoords.country]}</span>
                <Navigation className="w-4 h-4 text-amber-600" />
                <span className="text-lg">{countryFlags[toCoords.country]}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Map container */}
      <div
        ref={mapContainerRef}
        className="w-full h-[350px]"
        style={{ zIndex: 0 }}
      />

      {/* Apple-style CSS */}
      <style>{`
        .glass-card {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.05);
        }
        
        .dark .glass-card {
          background: rgba(30, 30, 30, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        @keyframes markerPulse {
          0%, 100% {
            box-shadow: 0 4px 20px rgba(0,0,0,0.15), 0 0 0 4px rgba(255,255,255,0.9);
          }
          50% {
            box-shadow: 0 4px 25px rgba(0,0,0,0.2), 0 0 0 6px rgba(255,255,255,0.7);
          }
        }
        
        .leaflet-container {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
        }
        
        .leaflet-control-zoom {
          border: none !important;
          border-radius: 12px !important;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1) !important;
        }
        
        .leaflet-control-zoom a {
          background: rgba(255,255,255,0.9) !important;
          backdrop-filter: blur(10px);
          color: #1d1d1f !important;
          border: none !important;
          width: 36px !important;
          height: 36px !important;
          line-height: 36px !important;
          font-size: 18px !important;
        }
        
        .leaflet-control-zoom a:hover {
          background: rgba(255,255,255,1) !important;
        }
        
        .dark .leaflet-control-zoom a {
          background: rgba(50,50,50,0.9) !important;
          color: #fff !important;
        }
      `}</style>
    </div>
  );
};
