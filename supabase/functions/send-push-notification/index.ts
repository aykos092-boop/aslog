import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  userId: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

// Helper to convert base64url to ArrayBuffer
function base64UrlToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    view[i] = rawData.charCodeAt(i);
  }
  return buffer;
}

// Helper to convert ArrayBuffer to base64url string
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Generate VAPID JWT for authentication
async function generateVapidJWT(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<string> {
  try {
    const url = new URL(endpoint);
    const aud = `${url.protocol}//${url.host}`;
    
    // JWT Header
    const header = { typ: "JWT", alg: "ES256" };
    
    // JWT Claims
    const claims = {
      aud,
      exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // 12 hours
      sub: "mailto:support@asialog.uz",
    };
    
    const encoder = new TextEncoder();
    const headerB64 = arrayBufferToBase64Url(encoder.encode(JSON.stringify(header)).buffer as ArrayBuffer);
    const claimsB64 = arrayBufferToBase64Url(encoder.encode(JSON.stringify(claims)).buffer as ArrayBuffer);
    const unsignedToken = `${headerB64}.${claimsB64}`;
    
    // Import private key for signing (PKCS8 format is needed for ECDSA)
    const privateKeyBuffer = base64UrlToArrayBuffer(vapidPrivateKey);
    
    // For raw EC private keys, we need to construct the proper format
    // The VAPID private key is typically just the 32-byte scalar
    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      privateKeyBuffer,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    ).catch(async () => {
      // If PKCS8 fails, try JWK format
      const rawKey = new Uint8Array(privateKeyBuffer);
      const jwk = {
        kty: "EC",
        crv: "P-256",
        d: arrayBufferToBase64Url(rawKey.buffer as ArrayBuffer),
        x: vapidPublicKey.substring(0, 43), // First part of public key
        y: vapidPublicKey.substring(43), // Second part
      };
      return crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"]
      );
    });
    
    // Sign the token
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privateKey,
      encoder.encode(unsignedToken)
    );
    
    const signatureB64 = arrayBufferToBase64Url(signature);
    
    return `${unsignedToken}.${signatureB64}`;
  } catch (error) {
    console.error("Error generating VAPID JWT:", error);
    throw error;
  }
}

// Simplified push notification - using direct fetch with VAPID headers
// For full encryption support, a dedicated web-push library would be ideal
async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url?: string; tag?: string },
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<boolean> {
  try {
    // For FCM endpoints, we can send without encryption (Firebase handles it)
    const isFCM = subscription.endpoint.includes("fcm.googleapis.com");
    
    let response: Response;
    
    if (isFCM) {
      // FCM accepts JSON payload directly with proper VAPID auth
      try {
        const vapidJwt = await generateVapidJWT(
          subscription.endpoint,
          vapidPublicKey,
          vapidPrivateKey
        );
        
        response = await fetch(subscription.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "TTL": "86400",
            "Urgency": "normal",
            "Authorization": `vapid t=${vapidJwt}, k=${vapidPublicKey}`,
          },
          body: JSON.stringify(payload),
        });
      } catch (vapidError) {
        console.error("VAPID error, trying simple POST:", vapidError);
        // Fallback to simple POST without VAPID
        response = await fetch(subscription.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "TTL": "86400",
          },
          body: JSON.stringify(payload),
        });
      }
    } else {
      // For other push services (Mozilla, etc.), try with VAPID
      try {
        const vapidJwt = await generateVapidJWT(
          subscription.endpoint,
          vapidPublicKey,
          vapidPrivateKey
        );
        
        response = await fetch(subscription.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "TTL": "86400",
            "Urgency": "normal",
            "Authorization": `vapid t=${vapidJwt}, k=${vapidPublicKey}`,
          },
          body: JSON.stringify(payload),
        });
      } catch {
        // Last resort fallback
        response = await fetch(subscription.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "TTL": "86400",
          },
          body: JSON.stringify(payload),
        });
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Push failed: ${response.status} - ${errorText}`);
      
      // Log specific error cases
      if (response.status === 410 || response.status === 404) {
        console.log("Subscription expired or invalid, should be removed");
      } else if (response.status === 401 || response.status === 403) {
        console.log("VAPID authentication failed");
      }
    }

    console.log(`Push sent to ${subscription.endpoint}, status: ${response.status}`);
    return response.ok || response.status === 201;
  } catch (error) {
    console.error("Error sending push:", error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error("VAPID keys not configured");
    }

    const { userId, title, body, url, tag } = await req.json() as PushPayload;

    // Validate input
    if (!userId || typeof userId !== "string") {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!title || typeof title !== "string" || title.length > 200) {
      return new Response(
        JSON.stringify({ error: "title is required and must be under 200 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body || typeof body !== "string" || body.length > 1000) {
      return new Response(
        JSON.stringify({ error: "body is required and must be under 1000 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending push notification to user ${userId}: ${title}`);

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId);

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No subscriptions found for user ${userId}`);
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${subscriptions.length} subscriptions for user ${userId}`);

    // Send to all subscriptions
    let sentCount = 0;
    
    for (const sub of subscriptions) {
      const success = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        { title, body, url, tag },
        vapidPublicKey,
        vapidPrivateKey
      );
      if (success) {
        sentCount++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, total: subscriptions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Push notification error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
