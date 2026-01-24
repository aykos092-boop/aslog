import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type TravelMode = "driving" | "walking" | "transit" | "bicycling";

interface DirectionsRequest {
  origin: { lat: number; lng: number } | string;
  destination: { lat: number; lng: number } | string;
  waypoints?: { lat: number; lng: number }[];
  mode?: TravelMode;
  alternatives?: boolean;
  language?: string;
}

interface RouteResult {
  distance: { text: string; value: number };
  duration: { text: string; value: number };
  durationInTraffic?: { text: string; value: number };
  startAddress: string;
  endAddress: string;
  points: { lat: number; lng: number }[];
  steps: {
    instruction: string;
    distance: { text: string; value: number };
    duration: { text: string; value: number };
    startLocation: { lat: number; lng: number };
    endLocation: { lat: number; lng: number };
    maneuver?: string;
    travelMode?: string;
  }[];
  bounds: {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
  };
  summary: string;
  warnings: string[];
}

// Format duration text from seconds
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours} ч ${minutes} мин`;
  }
  return `${minutes} мин`;
}

// Format distance text from meters
function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} км`;
  }
  return `${meters} м`;
}

// Map OSRM profile
function mapOsrmProfile(mode: TravelMode): string {
  const profileMap: Record<TravelMode, string> = {
    driving: "driving",
    walking: "foot",
    transit: "driving",
    bicycling: "bike",
  };
  return profileMap[mode] || "driving";
}

// Translate OSRM maneuver to readable instruction
function translateManeuver(type: string, modifier: string | undefined, name: string, language: string): string {
  const isRu = language === "ru";
  const roadName = name ? (isRu ? `на ${name}` : `onto ${name}`) : "";
  
  const translations: Record<string, Record<string, string>> = {
    turn: {
      left: isRu ? `Поверните налево ${roadName}` : `Turn left ${roadName}`,
      right: isRu ? `Поверните направо ${roadName}` : `Turn right ${roadName}`,
      "slight left": isRu ? `Плавно налево ${roadName}` : `Slight left ${roadName}`,
      "slight right": isRu ? `Плавно направо ${roadName}` : `Slight right ${roadName}`,
      "sharp left": isRu ? `Резко налево ${roadName}` : `Sharp left ${roadName}`,
      "sharp right": isRu ? `Резко направо ${roadName}` : `Sharp right ${roadName}`,
      uturn: isRu ? "Развернитесь" : "Make a U-turn",
      straight: isRu ? `Продолжайте прямо ${roadName}` : `Continue straight ${roadName}`,
    },
    "new name": {
      default: isRu ? `Продолжайте по ${name || "дороге"}` : `Continue on ${name || "road"}`,
    },
    depart: {
      default: isRu ? `Начните движение ${roadName}` : `Start driving ${roadName}`,
    },
    arrive: {
      default: isRu ? "Вы прибыли в пункт назначения" : "You have arrived",
    },
    merge: {
      default: isRu ? `Влейтесь в поток ${roadName}` : `Merge ${roadName}`,
    },
    "on ramp": {
      default: isRu ? `Выезжайте на съезд ${roadName}` : `Take the ramp ${roadName}`,
    },
    "off ramp": {
      default: isRu ? `Съезжайте ${roadName}` : `Exit ${roadName}`,
    },
    fork: {
      left: isRu ? `Держитесь левее ${roadName}` : `Keep left ${roadName}`,
      right: isRu ? `Держитесь правее ${roadName}` : `Keep right ${roadName}`,
      "slight left": isRu ? `Держитесь левее ${roadName}` : `Keep left ${roadName}`,
      "slight right": isRu ? `Держитесь правее ${roadName}` : `Keep right ${roadName}`,
    },
    "end of road": {
      left: isRu ? `В конце дороги поверните налево ${roadName}` : `At end of road turn left ${roadName}`,
      right: isRu ? `В конце дороги поверните направо ${roadName}` : `At end of road turn right ${roadName}`,
    },
    continue: {
      default: isRu ? `Продолжайте движение ${roadName}` : `Continue ${roadName}`,
    },
    roundabout: {
      default: isRu ? `На круговом движении ${roadName}` : `At roundabout ${roadName}`,
    },
    rotary: {
      default: isRu ? `На круговом движении ${roadName}` : `At roundabout ${roadName}`,
    },
    "roundabout turn": {
      default: isRu ? `На круговом движении ${roadName}` : `At roundabout ${roadName}`,
    },
    notification: {
      default: "",
    },
  };

  const typeTranslations = translations[type];
  if (typeTranslations) {
    const instruction = typeTranslations[modifier || "default"] || typeTranslations["default"];
    if (instruction) return instruction.trim();
  }

  return isRu ? `Продолжайте движение ${roadName}`.trim() : `Continue ${roadName}`.trim();
}

// Convert OSRM maneuver type to standard maneuver
function getManeuverType(type: string, modifier: string | undefined): string | undefined {
  if (type === "turn") {
    if (modifier?.includes("left")) return "turn-left";
    if (modifier?.includes("right")) return "turn-right";
    if (modifier === "uturn") return "uturn";
    if (modifier === "straight") return "straight";
  }
  if (type === "roundabout" || type === "rotary") return "roundabout";
  if (type === "merge") return "merge";
  if (type === "fork") {
    if (modifier?.includes("left")) return "fork-left";
    if (modifier?.includes("right")) return "fork-right";
  }
  if (type === "depart") return "depart";
  if (type === "arrive") return "arrive";
  return undefined;
}

// Geocode address using Nominatim
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const response = await fetch(url, {
      headers: { "User-Agent": "CargoApp/1.0" },
    });
    const data = await response.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.error("Geocoding error:", e);
  }
  return null;
}

// Get route using OSRM
async function getOsrmRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  mode: TravelMode,
  alternatives: boolean,
  language: string
): Promise<RouteResult[]> {
  const profile = mapOsrmProfile(mode);
  const url = `https://router.project-osrm.org/route/v1/${profile}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true&alternatives=${alternatives}`;

  console.log("Fetching from OSRM:", url);

  const response = await fetch(url);
  const data = await response.json();

  if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
    throw new Error(data.message || "No routes found");
  }

  return data.routes.map((route: any) => {
    const points = route.geometry.coordinates.map((coord: number[]) => ({
      lat: coord[1],
      lng: coord[0],
    }));

    // Calculate bounds
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    points.forEach((p: { lat: number; lng: number }) => {
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
      minLng = Math.min(minLng, p.lng);
      maxLng = Math.max(maxLng, p.lng);
    });

    // Parse steps from all legs
    const steps: RouteResult["steps"] = [];
    route.legs.forEach((leg: any) => {
      leg.steps.forEach((step: any) => {
        const maneuver = step.maneuver;
        steps.push({
          instruction: translateManeuver(maneuver.type, maneuver.modifier, step.name || "", language),
          distance: { text: formatDistance(step.distance), value: Math.round(step.distance) },
          duration: { text: formatDuration(step.duration), value: Math.round(step.duration) },
          startLocation: { lat: maneuver.location[1], lng: maneuver.location[0] },
          endLocation: { 
            lat: step.intersections?.[step.intersections.length - 1]?.location?.[1] || maneuver.location[1],
            lng: step.intersections?.[step.intersections.length - 1]?.location?.[0] || maneuver.location[0],
          },
          maneuver: getManeuverType(maneuver.type, maneuver.modifier),
          travelMode: mode.toUpperCase(),
        });
      });
    });

    return {
      distance: { text: formatDistance(route.distance), value: Math.round(route.distance) },
      duration: { text: formatDuration(route.duration), value: Math.round(route.duration) },
      durationInTraffic: { text: formatDuration(route.duration), value: Math.round(route.duration) },
      startAddress: "",
      endAddress: "",
      points,
      steps,
      bounds: {
        northeast: { lat: maxLat, lng: maxLng },
        southwest: { lat: minLat, lng: minLng },
      },
      summary: route.legs.map((l: any) => l.summary).join(" → ") || "",
      warnings: [],
    };
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      origin, 
      destination, 
      mode = "driving", 
      alternatives = false,
      language = "ru" 
    } = await req.json() as DirectionsRequest;

    console.log("Directions request:", { origin, destination, mode, alternatives, language });

    // Resolve coordinates
    let originCoords: { lat: number; lng: number };
    let destCoords: { lat: number; lng: number };

    if (typeof origin === "string") {
      const geocoded = await geocodeAddress(origin);
      if (!geocoded) {
        return new Response(
          JSON.stringify({ error: "Could not geocode origin address", status: "GEOCODE_FAILED" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      originCoords = geocoded;
    } else {
      originCoords = origin;
    }

    if (typeof destination === "string") {
      const geocoded = await geocodeAddress(destination);
      if (!geocoded) {
        return new Response(
          JSON.stringify({ error: "Could not geocode destination address", status: "GEOCODE_FAILED" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      destCoords = geocoded;
    } else {
      destCoords = destination;
    }

    console.log("Resolved coordinates:", { origin: originCoords, destination: destCoords });

    // Use OSRM for routing (free, no API key required)
    const routes = await getOsrmRoute(originCoords, destCoords, mode, alternatives, language);

    console.log("Routes fetched successfully:", {
      routesCount: routes.length,
      mainRoute: {
        distance: routes[0].distance.text,
        duration: routes[0].duration.text,
      },
    });

    return new Response(
      JSON.stringify({ 
        routes,
        ...routes[0]
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in google-directions:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
