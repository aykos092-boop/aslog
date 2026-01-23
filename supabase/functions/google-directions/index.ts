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
    transitDetails?: {
      lineName: string;
      lineColor: string;
      vehicleType: string;
      departureStop: string;
      arrivalStop: string;
      numStops: number;
    };
  }[];
  bounds: {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
  };
  summary: string;
  warnings: string[];
}

// Decode Google's encoded polyline format
function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return points;
}

function parseRoute(route: any, leg: any): RouteResult {
  return {
    distance: leg.distance,
    duration: leg.duration,
    durationInTraffic: leg.duration_in_traffic,
    startAddress: leg.start_address,
    endAddress: leg.end_address,
    points: decodePolyline(route.overview_polyline.points),
    steps: leg.steps.map((step: any) => {
      const stepData: any = {
        instruction: step.html_instructions?.replace(/<[^>]*>/g, "") || "",
        distance: step.distance,
        duration: step.duration,
        startLocation: step.start_location,
        endLocation: step.end_location,
        maneuver: step.maneuver,
        travelMode: step.travel_mode,
      };

      // Add transit details if available
      if (step.transit_details) {
        stepData.transitDetails = {
          lineName: step.transit_details.line?.short_name || step.transit_details.line?.name,
          lineColor: step.transit_details.line?.color,
          vehicleType: step.transit_details.line?.vehicle?.type,
          departureStop: step.transit_details.departure_stop?.name,
          arrivalStop: step.transit_details.arrival_stop?.name,
          numStops: step.transit_details.num_stops,
        };
      }

      return stepData;
    }),
    bounds: route.bounds,
    summary: route.summary || "",
    warnings: route.warnings || [],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    
    if (!apiKey) {
      console.error("GOOGLE_MAPS_API_KEY is not set");
      return new Response(
        JSON.stringify({ error: "Google Maps API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { 
      origin, 
      destination, 
      waypoints, 
      mode = "driving", 
      alternatives = false,
      language = "ru" 
    } = await req.json() as DirectionsRequest;

    console.log("Directions request:", { origin, destination, mode, alternatives, language });

    // Format origin and destination
    const formatLocation = (loc: { lat: number; lng: number } | string): string => {
      if (typeof loc === "string") return encodeURIComponent(loc);
      return `${loc.lat},${loc.lng}`;
    };

    // Build waypoints string if provided
    let waypointsParam = "";
    if (waypoints && waypoints.length > 0) {
      waypointsParam = `&waypoints=optimize:true|${waypoints.map(w => `${w.lat},${w.lng}`).join("|")}`;
    }

    // Build URL with all parameters
    const params = new URLSearchParams({
      origin: formatLocation(origin),
      destination: formatLocation(destination),
      mode: mode,
      alternatives: alternatives.toString(),
      language: language,
      key: apiKey,
    });

    // Add departure_time for traffic info (driving mode only)
    if (mode === "driving") {
      params.append("departure_time", "now");
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?${params}${waypointsParam}`;

    console.log("Fetching directions from Google API...");

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK") {
      console.error("Google API error:", data.status, data.error_message);
      return new Response(
        JSON.stringify({ 
          error: `Google API error: ${data.status}`, 
          message: data.error_message,
          status: data.status
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse all routes (main + alternatives)
    const routes: RouteResult[] = data.routes.map((route: any) => {
      const leg = route.legs[0];
      return parseRoute(route, leg);
    });

    console.log("Directions fetched successfully:", {
      routesCount: routes.length,
      mainRoute: {
        distance: routes[0].distance.text,
        duration: routes[0].duration.text,
      },
    });

    return new Response(
      JSON.stringify({ 
        routes,
        // For backward compatibility, also return the first route's data at top level
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
