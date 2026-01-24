import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

// Rate limiting store (in-memory for edge function, reset on cold start)
const rateLimitStore: Map<string, { count: number; resetAt: number }> = new Map();

const RATE_LIMIT_MAX = 100; // requests per window
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

function checkRateLimit(apiKey: string): RateLimitResult {
  const now = Date.now();
  const record = rateLimitStore.get(apiKey);

  if (!record || now > record.resetAt) {
    // Reset or new entry
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateLimitStore.set(apiKey, { count: 1, resetAt });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetAt };
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - record.count, resetAt: record.resetAt };
}

// Input validation helpers
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function sanitizeString(str: unknown, maxLength: number = 500): string | null {
  if (typeof str !== 'string') return null;
  // Remove control characters and limit length
  return str.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, maxLength);
}

function validateOrderInput(body: unknown): { valid: boolean; error?: string; data?: any } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const b = body as Record<string, unknown>;

  // Required fields
  const cargoType = sanitizeString(b.cargo_type, 100);
  if (!cargoType || cargoType.length < 1) {
    return { valid: false, error: 'cargo_type is required (1-100 chars)' };
  }

  if (typeof b.weight !== 'number' || b.weight <= 0 || b.weight > 1000000) {
    return { valid: false, error: 'weight must be a positive number (max 1000000)' };
  }

  const pickupAddress = sanitizeString(b.pickup_address, 500);
  if (!pickupAddress || pickupAddress.length < 5) {
    return { valid: false, error: 'pickup_address is required (5-500 chars)' };
  }

  const deliveryAddress = sanitizeString(b.delivery_address, 500);
  if (!deliveryAddress || deliveryAddress.length < 5) {
    return { valid: false, error: 'delivery_address is required (5-500 chars)' };
  }

  const pickupDate = sanitizeString(b.pickup_date, 50);
  if (!pickupDate) {
    return { valid: false, error: 'pickup_date is required' };
  }
  // Validate date format
  const dateObj = new Date(pickupDate);
  if (isNaN(dateObj.getTime())) {
    return { valid: false, error: 'pickup_date must be a valid ISO date' };
  }

  // Optional fields
  let clientPrice: number | null = null;
  if (b.client_price !== undefined && b.client_price !== null) {
    if (typeof b.client_price !== 'number' || b.client_price <= 0 || b.client_price > 100000000) {
      return { valid: false, error: 'client_price must be a positive number (max 100000000)' };
    }
    clientPrice = b.client_price;
  }

  const description = sanitizeString(b.description, 2000) || null;

  return {
    valid: true,
    data: {
      cargo_type: cargoType,
      weight: b.weight,
      pickup_address: pickupAddress,
      delivery_address: deliveryAddress,
      pickup_date: pickupDate,
      client_price: clientPrice,
      description
    }
  };
}

function validateWebhookInput(body: unknown): { valid: boolean; error?: string; data?: any } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const b = body as Record<string, unknown>;

  const url = sanitizeString(b.url, 2000);
  if (!url) {
    return { valid: false, error: 'url is required' };
  }

  // Validate URL format
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, error: 'url must use http or https protocol' };
    }
  } catch {
    return { valid: false, error: 'url must be a valid URL' };
  }

  if (!Array.isArray(b.events) || b.events.length === 0 || b.events.length > 10) {
    return { valid: false, error: 'events must be an array (1-10 items)' };
  }

  const validEvents = ['order.created', 'order.accepted', 'deal.status_changed', 'deal.delivered'];
  const events: string[] = [];
  for (const event of b.events) {
    if (typeof event !== 'string' || !validEvents.includes(event)) {
      return { valid: false, error: `Invalid event: ${event}. Valid events: ${validEvents.join(', ')}` };
    }
    events.push(event);
  }

  return { valid: true, data: { url, events } };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace("/partner-api", "");
    const apiKey = req.headers.get("x-api-key");

    // API Documentation endpoint (public)
    if (path === "/docs" || path === "") {
      const docs = {
        name: "CargoConnect Partner API",
        version: "1.0.0",
        baseUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/partner-api`,
        authentication: {
          type: "API Key",
          header: "x-api-key",
          description: "Contact admin to get your API key"
        },
        rateLimit: {
          maxRequests: RATE_LIMIT_MAX,
          windowMs: RATE_LIMIT_WINDOW_MS,
          description: "Rate limit per API key"
        },
        endpoints: [
          {
            method: "GET",
            path: "/orders",
            description: "Get list of open orders",
            parameters: {
              limit: "number (optional, default: 20, max: 100)",
              offset: "number (optional, default: 0)",
              cargo_type: "string (optional)",
              pickup_city: "string (optional)",
              delivery_city: "string (optional)"
            },
            response: {
              orders: "array of Order objects",
              total: "number",
              limit: "number",
              offset: "number"
            }
          },
          {
            method: "GET",
            path: "/orders/:id",
            description: "Get order details by ID",
            response: "Order object"
          },
          {
            method: "POST",
            path: "/orders",
            description: "Create a new order (partner account required)",
            body: {
              cargo_type: "string (required, 1-100 chars)",
              weight: "number (required, positive, max 1000000)",
              pickup_address: "string (required, 5-500 chars)",
              delivery_address: "string (required, 5-500 chars)",
              pickup_date: "string ISO date (required)",
              client_price: "number (optional, positive, max 100000000)",
              description: "string (optional, max 2000 chars)"
            },
            response: "Created Order object"
          },
          {
            method: "GET",
            path: "/tracking/:deal_id",
            description: "Get real-time tracking info for a deal",
            response: {
              deal_id: "string",
              status: "string",
              current_location: "{ lat, lng } or null",
              eta_minutes: "number or null",
              updated_at: "string ISO date"
            }
          },
          {
            method: "POST",
            path: "/webhooks/register",
            description: "Register a webhook URL for events",
            body: {
              url: "string (required, valid https URL)",
              events: "array of strings - ['order.created', 'order.accepted', 'deal.status_changed', 'deal.delivered']"
            }
          }
        ],
        models: {
          Order: {
            id: "string (UUID)",
            cargo_type: "string",
            weight: "number",
            pickup_address: "string",
            delivery_address: "string",
            pickup_date: "string ISO date",
            client_price: "number or null",
            description: "string or null",
            status: "'open' | 'in_progress' | 'completed' | 'cancelled'",
            created_at: "string ISO date"
          },
          Deal: {
            id: "string (UUID)",
            order_id: "string (UUID)",
            carrier_id: "string (UUID)",
            agreed_price: "number",
            status: "'pending' | 'accepted' | 'in_transit' | 'delivered' | 'cancelled'",
            started_at: "string ISO date or null",
            completed_at: "string ISO date or null"
          }
        },
        errors: {
          "400": "Bad Request - Invalid parameters",
          "401": "Unauthorized - Missing or invalid API key",
          "403": "Forbidden - Access denied",
          "404": "Not Found - Resource not found",
          "429": "Too Many Requests - Rate limit exceeded",
          "500": "Internal Server Error"
        }
      };

      return new Response(JSON.stringify(docs, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // All other endpoints require API key
    if (!apiKey || apiKey.length < 32 || apiKey.length > 128) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid API key", code: "UNAUTHORIZED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate API key
    const { data: partner, error: partnerError } = await supabase
      .from("partner_api_keys")
      .select("*")
      .eq("api_key", apiKey)
      .eq("is_active", true)
      .single();

    if (partnerError || !partner) {
      return new Response(
        JSON.stringify({ error: "Invalid API key", code: "UNAUTHORIZED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check rate limit
    const rateLimit = checkRateLimit(apiKey);
    const rateLimitHeaders = {
      "X-RateLimit-Limit": RATE_LIMIT_MAX.toString(),
      "X-RateLimit-Remaining": rateLimit.remaining.toString(),
      "X-RateLimit-Reset": new Date(rateLimit.resetAt).toISOString(),
    };

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded", code: "RATE_LIMIT", retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000) }),
        { status: 429, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last_used_at
    await supabase
      .from("partner_api_keys")
      .update({ last_used_at: new Date().toISOString(), request_count: partner.request_count + 1 })
      .eq("id", partner.id);

    // Route handlers
    // GET /orders
    if (req.method === "GET" && path === "/orders") {
      const limitParam = url.searchParams.get("limit");
      const offsetParam = url.searchParams.get("offset");
      
      const limit = Math.min(Math.max(parseInt(limitParam || "20") || 20, 1), 100);
      const offset = Math.max(parseInt(offsetParam || "0") || 0, 0);
      
      const cargoType = sanitizeString(url.searchParams.get("cargo_type"), 100);
      const pickupCity = sanitizeString(url.searchParams.get("pickup_city"), 100);
      const deliveryCity = sanitizeString(url.searchParams.get("delivery_city"), 100);

      let query = supabase
        .from("orders")
        .select("id, cargo_type, weight, pickup_address, delivery_address, pickup_date, client_price, description, status, created_at", { count: "exact" })
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (cargoType) query = query.eq("cargo_type", cargoType);
      if (pickupCity) query = query.ilike("pickup_address", `%${pickupCity}%`);
      if (deliveryCity) query = query.ilike("delivery_address", `%${deliveryCity}%`);

      const { data: orders, count, error } = await query;

      if (error) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch orders" }),
          { status: 500, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ orders, total: count, limit, offset }),
        { headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /orders/:id
    if (req.method === "GET" && path.startsWith("/orders/")) {
      const orderId = path.replace("/orders/", "");

      if (!isValidUUID(orderId)) {
        return new Response(
          JSON.stringify({ error: "Invalid order ID format", code: "BAD_REQUEST" }),
          { status: 400, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: order, error } = await supabase
        .from("orders")
        .select("id, cargo_type, weight, pickup_address, delivery_address, pickup_date, client_price, description, status, created_at")
        .eq("id", orderId)
        .single();

      if (error || !order) {
        return new Response(
          JSON.stringify({ error: "Order not found", code: "NOT_FOUND" }),
          { status: 404, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify(order),
        { headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /orders
    if (req.method === "POST" && path === "/orders") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid JSON body" }),
          { status: 400, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
        );
      }

      const validation = validateOrderInput(body);
      if (!validation.valid || !validation.data) {
        return new Response(
          JSON.stringify({ error: validation.error || "Invalid input" }),
          { status: 400, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          client_id: partner.user_id,
          cargo_type: validation.data.cargo_type,
          weight: validation.data.weight,
          pickup_address: validation.data.pickup_address,
          delivery_address: validation.data.delivery_address,
          pickup_date: validation.data.pickup_date,
          client_price: validation.data.client_price,
          description: validation.data.description,
          status: "open",
        })
        .select("id, cargo_type, weight, pickup_address, delivery_address, pickup_date, client_price, description, status, created_at")
        .single();

      if (error) {
        console.error("Order creation error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to create order" }),
          { status: 500, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify(order),
        { status: 201, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /tracking/:deal_id
    if (req.method === "GET" && path.startsWith("/tracking/")) {
      const dealId = path.replace("/tracking/", "");

      if (!isValidUUID(dealId)) {
        return new Response(
          JSON.stringify({ error: "Invalid deal ID format", code: "BAD_REQUEST" }),
          { status: 400, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: deal, error: dealError } = await supabase
        .from("deals")
        .select("id, status, started_at, completed_at, updated_at")
        .eq("id", dealId)
        .single();

      if (dealError || !deal) {
        return new Response(
          JSON.stringify({ error: "Deal not found", code: "NOT_FOUND" }),
          { status: 404, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get latest GPS location
      const { data: location } = await supabase
        .from("gps_locations")
        .select("latitude, longitude, recorded_at")
        .eq("deal_id", dealId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .single();

      const trackingInfo = {
        deal_id: deal.id,
        status: deal.status,
        current_location: location ? { lat: location.latitude, lng: location.longitude } : null,
        location_updated_at: location?.recorded_at || null,
        eta_minutes: null as number | null,
        updated_at: deal.updated_at,
      };

      return new Response(
        JSON.stringify(trackingInfo),
        { headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /webhooks/register
    if (req.method === "POST" && path === "/webhooks/register") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid JSON body" }),
          { status: 400, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
        );
      }

      const validation = validateWebhookInput(body);
      if (!validation.valid || !validation.data) {
        return new Response(
          JSON.stringify({ error: validation.error || "Invalid input" }),
          { status: 400, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: webhook, error } = await supabase
        .from("partner_webhooks")
        .upsert({
          partner_id: partner.id,
          url: validation.data.url,
          events: validation.data.events,
          is_active: true,
        }, { onConflict: "partner_id" })
        .select()
        .single();

      if (error) {
        console.error("Webhook registration error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to register webhook" }),
          { status: 500, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, webhook_id: webhook.id }),
        { headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }

    // 404 for unknown routes
    return new Response(
      JSON.stringify({ error: "Endpoint not found", code: "NOT_FOUND" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Partner API error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
