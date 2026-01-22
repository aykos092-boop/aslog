import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  provider: string;
};

// Нормализация адреса для поиска в кеше
function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .trim()
    .replace(/,\s*(кыргызстан|kyrgyzstan|казахстан|kazakhstan|узбекистан|uzbekistan|таджикистан|tajikistan|туркменистан|turkmenistan|россия|russia|китай|china)$/i, '')
    .trim();
}

// Fallback на Nominatim если нет в кеше
async function geocodeWithNominatim(address: string): Promise<GeocodeResult | null> {
  const encoded = encodeURIComponent(address);
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encoded}`;

  const res = await fetch(url, {
    headers: {
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { address } = await req.json() as GeocodeRequest;

    if (!address || typeof address !== "string") {
      return new Response(
        JSON.stringify({ error: "Address is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Geocoding address:", address);
    const normalized = normalizeAddress(address);
    console.log("Normalized address:", normalized);

    // 1) Проверяем точное совпадение в кеше
    const { data: exactMatch } = await supabase
      .from("geocode_cache")
      .select("lat, lng, formatted_address, provider")
      .eq("address", address)
      .limit(1)
      .single();

    if (exactMatch) {
      console.log("Found exact match in cache:", exactMatch);
      return new Response(
        JSON.stringify({
          lat: exactMatch.lat,
          lng: exactMatch.lng,
          formattedAddress: exactMatch.formatted_address,
          provider: exactMatch.provider,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Проверяем по нормализованному адресу
    const { data: normalizedMatch } = await supabase
      .from("geocode_cache")
      .select("lat, lng, formatted_address, provider")
      .eq("address_normalized", normalized)
      .limit(1)
      .single();

    if (normalizedMatch) {
      console.log("Found normalized match in cache:", normalizedMatch);
      return new Response(
        JSON.stringify({
          lat: normalizedMatch.lat,
          lng: normalizedMatch.lng,
          formattedAddress: normalizedMatch.formatted_address,
          provider: normalizedMatch.provider,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3) Ищем частичное совпадение (адрес содержит название города)
    const { data: partialMatches } = await supabase
      .from("geocode_cache")
      .select("lat, lng, formatted_address, provider, address_normalized")
      .limit(100);

    if (partialMatches) {
      for (const cached of partialMatches) {
        if (normalized.includes(cached.address_normalized) || 
            cached.address_normalized.includes(normalized)) {
          console.log("Found partial match in cache:", cached);
          return new Response(
            JSON.stringify({
              lat: cached.lat,
              lng: cached.lng,
              formattedAddress: cached.formatted_address,
              provider: cached.provider,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // 4) Fallback на Nominatim
    console.log("No cache match, falling back to Nominatim");
    const fallback = await geocodeWithNominatim(address);
    
    if (fallback) {
      console.log("Geocoded via Nominatim:", { lat: fallback.lat, lng: fallback.lng });
      
      // Сохраняем в кеш для будущих запросов
      await supabase.from("geocode_cache").insert({
        address,
        address_normalized: normalized,
        lat: fallback.lat,
        lng: fallback.lng,
        formatted_address: fallback.formattedAddress,
        provider: "nominatim",
      }).single();

      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5) Не нашли нигде
    return new Response(
      JSON.stringify({
        error: "Geocoding failed",
        message: "Address not found in cache and Nominatim returned no results",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Geocode error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
