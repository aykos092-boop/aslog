import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*, client:profiles!orders_client_id_fkey(full_name)")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      // Try alternative query without join
      const { data: orderSimple } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();
      
      if (!orderSimple) {
        console.error("Order not found:", orderId);
        return new Response(
          JSON.stringify({ error: "Order not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const orderData = order || (await supabase.from("orders").select("*").eq("id", orderId).single()).data;
    
    // Get client profile separately
    const { data: clientProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", orderData.client_id)
      .single();

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
    
    const notificationTitle = "Новая заявка на перевозку!";
    const priceText = orderData.client_price 
      ? ` • ${orderData.client_price.toLocaleString("ru-RU")} ₽` 
      : "";
    const notificationBody = `${orderData.cargo_type}${priceText}\n${orderData.pickup_address} → ${orderData.delivery_address}`;

    let notifiedCount = 0;
    let pushCount = 0;
    let emailCount = 0;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    for (const carrierId of carrierIds) {
      // Skip the client themselves if they're also a carrier
      if (carrierId === orderData.client_id) continue;

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

    console.log(`Notified ${notifiedCount} carriers, ${pushCount} push, ${emailCount} emails`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notified: notifiedCount, 
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
