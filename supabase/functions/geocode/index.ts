import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GeocodeRequest {
  address: string;
}

type GeocodeResult = {
  lat: number;
  lng: number;
  formattedAddress?: string;
  placeId?: string;
  provider: "google" | "nominatim";
};

async function geocodeWithNominatim(address: string): Promise<GeocodeResult | null> {
  const encoded = encodeURIComponent(address);
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encoded}`;

  const res = await fetch(url, {
    headers: {
      // Nominatim требует User-Agent
      "User-Agent": "lovable-app-geocode/1.0",
      "Accept": "application/json",
    },
  });

  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
  if (!data?.length) return null;

  const first = data[0];
  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    lat,
    lng,
    formattedAddress: first.display_name,
    provider: "nominatim",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

    const { address } = await req.json() as GeocodeRequest;

    if (!address) {
      return new Response(
        JSON.stringify({ error: "Address is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Geocoding address:", address);

    // 1) Try Google (if configured)
    if (apiKey) {
      const encodedAddress = encodeURIComponent(address);
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}&language=ru`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "OK" && data.results?.length) {
        const result = data.results[0];
        const location = result.geometry.location;

        console.log("Geocoded successfully (google):", location);

        const payload: GeocodeResult = {
          lat: location.lat,
          lng: location.lng,
          formattedAddress: result.formatted_address,
          placeId: result.place_id,
          provider: "google",
        };

        return new Response(JSON.stringify(payload), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.error("Google geocoding failed:", data.status, data.error_message);
    } else {
      console.warn("GOOGLE_MAPS_API_KEY is not set; falling back to Nominatim");
    }

    // 2) Fallback to Nominatim to avoid blank screens when Google key is invalid/restricted
    const fallback = await geocodeWithNominatim(address);
    if (fallback) {
      console.log("Geocoded successfully (nominatim):", { lat: fallback.lat, lng: fallback.lng });
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        error: "Geocoding failed",
        message: apiKey
          ? "Google geocoding failed and Nominatim fallback returned no results"
          : "Google Maps API key not configured and Nominatim fallback returned no results",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in geocode:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
