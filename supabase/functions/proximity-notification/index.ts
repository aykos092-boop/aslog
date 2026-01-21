import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProximityRequest {
  dealId: string;
  clientId: string;
  distanceKm: number;
  carrierName: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { dealId, clientId, distanceKm, carrierName } = await req.json() as ProximityRequest;

    console.log("Proximity notification:", { dealId, clientId, distanceKm, carrierName });

    // Determine notification message based on distance
    let title: string;
    let body: string;

    if (distanceKm <= 0.5) {
      title = "🚛 Водитель почти у вас!";
      body = `${carrierName} прибудет менее чем через 500 метров. Приготовьтесь к получению груза!`;
    } else if (distanceKm <= 1) {
      title = "🚛 Водитель совсем близко!";
      body = `${carrierName} находится в 1 км от точки доставки.`;
    } else if (distanceKm <= 5) {
      title = "🚛 Водитель приближается";
      body = `${carrierName} находится в ${distanceKm.toFixed(1)} км от точки доставки.`;
    } else {
      return new Response(
        JSON.stringify({ message: "Distance too far for notification" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create in-app notification
    const { error: notifError } = await supabase
      .from("notifications")
      .insert({
        user_id: clientId,
        title,
        body,
        type: "proximity",
        url: `/deals/${dealId}/chat`,
      });

    if (notifError) {
      console.error("Failed to create notification:", notifError);
    }

    // Get push subscriptions for the client
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", clientId);

    if (subscriptions && subscriptions.length > 0) {
      const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
      const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

      if (vapidPublicKey && vapidPrivateKey) {
        // Send push notifications
        for (const sub of subscriptions) {
          try {
            // Call the existing send-push-notification function
            await supabase.functions.invoke("send-push-notification", {
              body: {
                subscription: {
                  endpoint: sub.endpoint,
                  keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth,
                  },
                },
                payload: JSON.stringify({ title, body, url: `/deals/${dealId}/chat` }),
              },
            });
          } catch (pushError) {
            console.error("Push notification error:", pushError);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, title, body }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in proximity-notification:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
