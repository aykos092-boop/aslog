import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CarrierPreferences {
  carrier_id: string;
  preferred_routes: string[];
  preferred_cargo_types: string[];
  min_weight: number | null;
  max_weight: number | null;
  notify_all: boolean;
}

function matchesPreferences(
  order: { cargo_type: string; pickup_address: string; delivery_address: string; weight: number | null },
  prefs: CarrierPreferences
): boolean {
  // If notify_all is true, always match
  if (prefs.notify_all) return true;

  // Check cargo type
  if (prefs.preferred_cargo_types.length > 0) {
    const cargoMatch = prefs.preferred_cargo_types.some(
      type => order.cargo_type.toLowerCase().includes(type.toLowerCase())
    );
    if (!cargoMatch) return false;
  }

  // Check routes (pickup or delivery should contain one of preferred routes)
  if (prefs.preferred_routes.length > 0) {
    const routeMatch = prefs.preferred_routes.some(
      route => 
        order.pickup_address.toLowerCase().includes(route.toLowerCase()) ||
        order.delivery_address.toLowerCase().includes(route.toLowerCase())
    );
    if (!routeMatch) return false;
  }

  // Check weight
  const weight = order.weight || 0;
  if (prefs.min_weight !== null && weight < prefs.min_weight) return false;
  if (prefs.max_weight !== null && weight > prefs.max_weight) return false;

  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { orderId } = await req.json();
    console.log("New order notification for:", orderId);

    // Get order details
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !orderData) {
      console.error("Order not found:", orderId);
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all carriers
    const { data: carriers } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "carrier");

    if (!carriers || carriers.length === 0) {
      console.log("No carriers found");
      return new Response(
        JSON.stringify({ success: true, notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const carrierIds = carriers.map(c => c.user_id);

    // Get carrier preferences
    const { data: allPreferences } = await supabase
      .from("carrier_preferences")
      .select("*")
      .in("carrier_id", carrierIds);

    const preferencesMap = new Map<string, CarrierPreferences>(
      allPreferences?.map(p => [p.carrier_id, p as CarrierPreferences]) || []
    );

    const notificationTitle = "Новая заявка на перевозку!";
    const priceText = orderData.client_price 
      ? ` • ${Number(orderData.client_price).toLocaleString("ru-RU")} ₽` 
      : "";
    const notificationBody = `${orderData.cargo_type}${priceText}\n${orderData.pickup_address} → ${orderData.delivery_address}`;

    let notifiedCount = 0;
    let skippedCount = 0;
    let pushCount = 0;
    let emailCount = 0;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    for (const carrierId of carrierIds) {
      // Skip the client themselves if they're also a carrier
      if (carrierId === orderData.client_id) continue;

      // Check carrier preferences
      const prefs = preferencesMap.get(carrierId);
      if (prefs && !matchesPreferences(orderData, prefs)) {
        skippedCount++;
        console.log(`Skipping carrier ${carrierId} - preferences don't match`);
        continue;
      }

      // Create in-app notification
      await supabase.from("notifications").insert({
        user_id: carrierId,
        title: notificationTitle,
        body: notificationBody,
        url: "/dashboard",
        type: "new_order",
        is_read: false,
      });
      notifiedCount++;

      // Send push notification
      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", carrierId);

      if (subscriptions && subscriptions.length > 0) {
        for (const sub of subscriptions) {
          try {
            const pushPayload = JSON.stringify({
              title: notificationTitle,
              body: notificationBody,
              url: "/dashboard",
              tag: "new_order",
            });

            await fetch(sub.endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "TTL": "86400",
              },
              body: pushPayload,
            });
            pushCount++;
          } catch (error) {
            console.error("Push error:", error);
          }
        }
      }

      // Send email notification
      try {
        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            type: "new_order",
            userId: carrierId,
            title: notificationTitle,
            body: notificationBody,
            url: "/dashboard",
          }),
        });

        if (emailResponse.ok) {
          emailCount++;
        }
      } catch (emailError) {
        console.error("Email error:", emailError);
      }
    }

    console.log(`Notified ${notifiedCount} carriers (skipped ${skippedCount}), ${pushCount} push, ${emailCount} emails`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notified: notifiedCount, 
        skipped: skippedCount,
        push: pushCount, 
        emails: emailCount 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
