import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationPayload {
  type: "message" | "response" | "deal_status";
  record: Record<string, unknown>;
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

    const payload: NotificationPayload = await req.json();
    console.log("Notification trigger received:", payload.type);

    const notifications: Array<{ userId: string; title: string; body: string; url: string }> = [];

    if (payload.type === "message") {
      const message = payload.record;
      
      // Skip system messages for notifications
      if (message.is_system) {
        return new Response(JSON.stringify({ skipped: true, reason: "system message" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get deal or order participants
      if (message.deal_id) {
        const { data: deal } = await supabase
          .from("deals")
          .select("client_id, carrier_id")
          .eq("id", message.deal_id)
          .single();

        if (deal) {
          const recipientId = message.sender_id === deal.client_id 
            ? deal.carrier_id 
            : deal.client_id;

          // Get sender name
          const { data: senderProfile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", message.sender_id)
            .single();

          notifications.push({
            userId: recipientId,
            title: "Новое сообщение",
            body: `${senderProfile?.full_name || "Участник"}: ${String(message.content).substring(0, 50)}...`,
            url: `/deals/${message.deal_id}/chat`,
          });
        }
      } else if (message.order_id) {
        // For order chat, notify order owner or responding carriers
        const { data: order } = await supabase
          .from("orders")
          .select("client_id")
          .eq("id", message.order_id)
          .single();

        if (order && message.sender_id !== order.client_id) {
          const { data: senderProfile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", message.sender_id)
            .single();

          notifications.push({
            userId: order.client_id,
            title: "Новое сообщение по заявке",
            body: `${senderProfile?.full_name || "Перевозчик"}: ${String(message.content).substring(0, 50)}...`,
            url: `/orders/${message.order_id}/responses`,
          });
        }
      }
    } else if (payload.type === "response") {
      const response = payload.record;

      // Notify order owner about new response
      const { data: order } = await supabase
        .from("orders")
        .select("client_id, cargo_type")
        .eq("id", response.order_id)
        .single();

      if (order) {
        const { data: carrierProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", response.carrier_id)
          .single();

        notifications.push({
          userId: order.client_id,
          title: "Новый отклик на заявку",
          body: `${carrierProfile?.full_name || "Перевозчик"} предложил ${response.price}₽ за "${order.cargo_type}"`,
          url: `/orders/${response.order_id}/responses`,
        });
      }
    } else if (payload.type === "deal_status") {
      const deal = payload.record;
      const oldStatus = (payload.record as { old_status?: string }).old_status;

      // Only notify if status actually changed
      if (deal.status === oldStatus) {
        return new Response(JSON.stringify({ skipped: true, reason: "status unchanged" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get deal details
      const { data: dealData } = await supabase
        .from("deals")
        .select("client_id, carrier_id, order:orders(cargo_type)")
        .eq("id", deal.id)
        .single();

      if (dealData) {
        const statusMessages: Record<string, { title: string; body: string }> = {
          accepted: { title: "Заказ принят", body: "Перевозчик принял ваш заказ" },
          in_transit: { title: "Груз в пути", body: "Перевозчик начал доставку" },
          delivered: { title: "Груз доставлен!", body: "Заказ успешно завершён. Оставьте отзыв!" },
          cancelled: { title: "Сделка отменена", body: "Сделка была отменена" },
        };

        const statusInfo = statusMessages[deal.status as string];
        if (statusInfo) {
          // Notify client about status changes
          notifications.push({
            userId: dealData.client_id,
            title: statusInfo.title,
            body: statusInfo.body,
            url: `/deals/${deal.id}/chat`,
          });

          // For delivered status, also notify carrier
          if (deal.status === "delivered") {
            notifications.push({
              userId: dealData.carrier_id,
              title: "Доставка завершена",
              body: "Не забудьте оставить отзыв о клиенте!",
              url: `/deals/${deal.id}/chat`,
            });
          }
        }
      }
    }

    // Save notifications to database and send push
    let sentCount = 0;
    for (const notif of notifications) {
      // Save to notifications table for in-app history
      await supabase.from("notifications").insert({
        user_id: notif.userId,
        title: notif.title,
        body: notif.body,
        url: notif.url,
        type: payload.type,
        is_read: false,
      });

      // Send push notification
      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", notif.userId);

      if (subscriptions && subscriptions.length > 0) {
        for (const sub of subscriptions) {
          try {
            const pushPayload = JSON.stringify({
              title: notif.title,
              body: notif.body,
              url: notif.url,
              tag: payload.type,
            });

            await fetch(sub.endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "TTL": "86400",
              },
              body: pushPayload,
            });
            sentCount++;
          } catch (error) {
            console.error("Error sending push to endpoint:", error);
          }
        }
      }
    }

    console.log(`Sent ${sentCount} notifications for ${payload.type} event`);

    return new Response(
      JSON.stringify({ success: true, notifications: notifications.length, sent: sentCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Notification trigger error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
