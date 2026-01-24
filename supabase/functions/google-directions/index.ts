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

// Geocode address using Google Geocoding API
async function geocodeWithGoogle(address: string, apiKey: string): Promise<{ lat: number; lng: number; formatted: string } | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&language=ru`;
    console.log("Geocoding with Google:", address);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === "OK" && data.results && data.results.length > 0) {
      const result = data.results[0];
      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formatted: result.formatted_address
      };
    }
    console.log("Google geocoding failed:", data.status, data.error_message);
    return null;
  } catch (e) {
    console.error("Google geocoding error:", e);
    return null;
  }
}

// Fallback to Nominatim
async function geocodeWithNominatim(address: string): Promise<{ lat: number; lng: number; formatted: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const response = await fetch(url, {
      headers: { "User-Agent": "CargoApp/1.0" },
    });
    const data = await response.json();
    if (data && data.length > 0) {
      return { 
        lat: parseFloat(data[0].lat), 
        lng: parseFloat(data[0].lon),
        formatted: data[0].display_name 
      };
    }
  } catch (e) {
    console.error("Nominatim geocoding error:", e);
  }
  return null;
}

// Get route using Google Directions API
async function getGoogleRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  mode: TravelMode,
  alternatives: boolean,
  language: string,
  apiKey: string
): Promise<RouteResult[]> {
  const modeMap: Record<TravelMode, string> = {
    driving: "driving",
    walking: "walking",
    transit: "transit",
    bicycling: "bicycling"
  };
  
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&mode=${modeMap[mode]}&alternatives=${alternatives}&language=${language}&departure_time=now&key=${apiKey}`;
  
  console.log("Fetching from Google Directions API");
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status !== "OK" || !data.routes || data.routes.length === 0) {
    console.error("Google Directions failed:", data.status, data.error_message);
    throw new Error(data.error_message || data.status || "No routes found");
  }
  
  console.log("Google returned", data.routes.length, "routes");
  
  return data.routes.map((route: any) => {
    // Decode polyline
    const points = decodePolyline(route.overview_polyline.points);
    
    // Get bounds
    const bounds = route.bounds;
    
    // Parse steps from all legs
    const steps: RouteResult["steps"] = [];
    let totalDistance = 0;
    let totalDuration = 0;
    let totalDurationTraffic = 0;
    
    route.legs.forEach((leg: any) => {
      totalDistance += leg.distance.value;
      totalDuration += leg.duration.value;
      totalDurationTraffic += leg.duration_in_traffic?.value || leg.duration.value;
      
      leg.steps.forEach((step: any) => {
        // Clean HTML from instructions
        const instruction = step.html_instructions
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        steps.push({
          instruction,
          distance: { text: step.distance.text, value: step.distance.value },
          duration: { text: step.duration.text, value: step.duration.value },
          startLocation: { lat: step.start_location.lat, lng: step.start_location.lng },
          endLocation: { lat: step.end_location.lat, lng: step.end_location.lng },
          maneuver: step.maneuver,
          travelMode: step.travel_mode,
        });
      });
    });
    
    return {
      distance: { text: formatDistance(totalDistance), value: totalDistance },
      duration: { text: formatDuration(totalDuration), value: totalDuration },
      durationInTraffic: { text: formatDuration(totalDurationTraffic), value: totalDurationTraffic },
      startAddress: route.legs[0]?.start_address || "",
      endAddress: route.legs[route.legs.length - 1]?.end_address || "",
      points,
      steps,
      bounds: {
        northeast: { lat: bounds.northeast.lat, lng: bounds.northeast.lng },
        southwest: { lat: bounds.southwest.lat, lng: bounds.southwest.lng },
      },
      summary: route.summary || "",
      warnings: route.warnings || [],
    };
  });
}

// Decode Google polyline
function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

// Fallback OSRM route
async function getOsrmRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  mode: TravelMode,
  alternatives: boolean,
  language: string
): Promise<RouteResult[]> {
  const profileMap: Record<TravelMode, string> = {
    driving: "driving",
    walking: "foot",
    transit: "driving",
    bicycling: "bike",
  };
  const profile = profileMap[mode] || "driving";
  const url = `https://router.project-osrm.org/route/v1/${profile}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true&alternatives=${alternatives}`;

  console.log("Fallback to OSRM:", url);

  const response = await fetch(url);
  const data = await response.json();

  if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
    throw new Error(data.message || "No routes found from OSRM");
  }

  const isRu = language === "ru";

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

    // Parse steps
    const steps: RouteResult["steps"] = [];
    route.legs.forEach((leg: any) => {
      leg.steps.forEach((step: any) => {
        const maneuver = step.maneuver;
        const name = step.name || "";
        
        let instruction = "";
        const type = maneuver.type;
        const modifier = maneuver.modifier;
        
        if (type === "depart") {
          instruction = isRu ? `Начните движение по ${name || "дороге"}` : `Start on ${name || "road"}`;
        } else if (type === "arrive") {
          instruction = isRu ? "Вы прибыли" : "You have arrived";
        } else if (type === "turn") {
          if (modifier?.includes("left")) {
            instruction = isRu ? `Поверните налево на ${name}` : `Turn left onto ${name}`;
          } else if (modifier?.includes("right")) {
            instruction = isRu ? `Поверните направо на ${name}` : `Turn right onto ${name}`;
          } else {
            instruction = isRu ? `Продолжайте по ${name}` : `Continue on ${name}`;
          }
        } else if (type === "roundabout") {
          instruction = isRu ? `На круговом движении выезжайте на ${name}` : `At roundabout, exit onto ${name}`;
        } else if (type === "fork") {
          instruction = isRu ? `Держитесь ${modifier?.includes("left") ? "левее" : "правее"}` : `Keep ${modifier?.includes("left") ? "left" : "right"}`;
        } else {
          instruction = isRu ? `Продолжайте по ${name || "дороге"}` : `Continue on ${name || "road"}`;
        }
        
        let maneuverType: string | undefined;
        if (type === "turn" && modifier?.includes("left")) maneuverType = "turn-left";
        else if (type === "turn" && modifier?.includes("right")) maneuverType = "turn-right";
        else if (type === "roundabout") maneuverType = "roundabout";
        else if (type === "depart") maneuverType = "depart";
        else if (type === "arrive") maneuverType = "arrive";
        
        steps.push({
          instruction,
          distance: { text: formatDistance(step.distance), value: Math.round(step.distance) },
          duration: { text: formatDuration(step.duration), value: Math.round(step.duration) },
          startLocation: { lat: maneuver.location[1], lng: maneuver.location[0] },
          endLocation: { 
            lat: step.intersections?.[step.intersections.length - 1]?.location?.[1] || maneuver.location[1],
            lng: step.intersections?.[step.intersections.length - 1]?.location?.[0] || maneuver.location[0],
          },
          maneuver: maneuverType,
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

    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    const useGoogle = !!apiKey;
    
    console.log("Using Google API:", useGoogle);

    // Resolve coordinates
    let originCoords: { lat: number; lng: number };
    let destCoords: { lat: number; lng: number };
    let startAddress = "";
    let endAddress = "";

    if (typeof origin === "string") {
      let geocoded = useGoogle ? await geocodeWithGoogle(origin, apiKey!) : null;
      if (!geocoded) {
        geocoded = await geocodeWithNominatim(origin);
      }
      if (!geocoded) {
        return new Response(
          JSON.stringify({ error: "Could not geocode origin address", status: "GEOCODE_FAILED" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      originCoords = { lat: geocoded.lat, lng: geocoded.lng };
      startAddress = geocoded.formatted;
    } else {
      originCoords = origin;
    }

    if (typeof destination === "string") {
      let geocoded = useGoogle ? await geocodeWithGoogle(destination, apiKey!) : null;
      if (!geocoded) {
        geocoded = await geocodeWithNominatim(destination);
      }
      if (!geocoded) {
        return new Response(
          JSON.stringify({ error: "Could not geocode destination address", status: "GEOCODE_FAILED" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      destCoords = { lat: geocoded.lat, lng: geocoded.lng };
      endAddress = geocoded.formatted;
    } else {
      destCoords = destination;
    }

    console.log("Resolved coordinates:", { origin: originCoords, destination: destCoords });

    // Try Google first, fallback to OSRM
    let routes: RouteResult[];
    let provider = "google";
    
    if (useGoogle) {
      try {
        routes = await getGoogleRoute(originCoords, destCoords, mode, alternatives, language, apiKey!);
        console.log("Google route success:", routes[0].distance.text, routes[0].duration.text);
      } catch (googleError) {
        console.error("Google failed, falling back to OSRM:", googleError);
        routes = await getOsrmRoute(originCoords, destCoords, mode, alternatives, language);
        provider = "osrm";
      }
    } else {
      routes = await getOsrmRoute(originCoords, destCoords, mode, alternatives, language);
      provider = "osrm";
    }

    // Update addresses if missing
    routes.forEach(route => {
      if (!route.startAddress) route.startAddress = startAddress;
      if (!route.endAddress) route.endAddress = endAddress;
    });

    console.log("Routes fetched successfully:", {
      provider,
      routesCount: routes.length,
      mainRoute: {
        distance: routes[0].distance.text,
        duration: routes[0].duration.text,
        stepsCount: routes[0].steps.length,
      },
    });

    return new Response(
      JSON.stringify({ 
        routes,
        provider,
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
