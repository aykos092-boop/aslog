import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DirectionsRequest {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  waypoints?: { lat: number; lng: number }[];
}

serve(async (req) => {
  // Handle CORS preflight
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

    const { origin, destination, waypoints } = await req.json() as DirectionsRequest;

    console.log("Directions request:", { origin, destination, waypoints });

    // Build waypoints string if provided
    let waypointsParam = "";
    if (waypoints && waypoints.length > 0) {
      waypointsParam = `&waypoints=optimize:true|${waypoints.map(w => `${w.lat},${w.lng}`).join("|")}`;
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}${waypointsParam}&mode=driving&alternatives=false&language=ru&key=${apiKey}`;

    console.log("Fetching directions from Google API...");

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK") {
      console.error("Google API error:", data.status, data.error_message);
      return new Response(
        JSON.stringify({ 
          error: `Google API error: ${data.status}`, 
          message: data.error_message 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    // Decode polyline to get route points
    const points = decodePolyline(route.overview_polyline.points);

    const result = {
      distance: leg.distance,
      duration: leg.duration,
      durationInTraffic: leg.duration_in_traffic,
      startAddress: leg.start_address,
      endAddress: leg.end_address,
      points: points,
      steps: leg.steps.map((step: any) => ({
        instruction: step.html_instructions.replace(/<[^>]*>/g, ""),
        distance: step.distance,
        duration: step.duration,
        startLocation: step.start_location,
        endLocation: step.end_location,
        maneuver: step.maneuver,
      })),
      bounds: route.bounds,
    };

    console.log("Directions fetched successfully:", {
      distance: result.distance.text,
      duration: result.duration.text,
      pointsCount: result.points.length,
    });

    return new Response(
      JSON.stringify(result),
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
