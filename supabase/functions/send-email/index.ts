import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: "response" | "deal_status" | "message";
  userId: string;
  title: string;
  body: string;
  url?: string;
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

    const payload: EmailRequest = await req.json();
    console.log("Email request received:", payload.type, "for user:", payload.userId);

    // Get user email from auth
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(payload.userId);

    if (userError || !userData?.user?.email) {
      console.error("Failed to get user email:", userError);
      return new Response(
        JSON.stringify({ error: "User email not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userEmail = userData.user.email;

    // Get user profile for personalization
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", payload.userId)
      .single();

    const userName = profile?.full_name || "Пользователь";
    const appUrl = Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", "") || "";
    const fullUrl = payload.url ? `https://id-preview--f8639f88-df63-4113-9f7b-e6fa91c02cf3.lovable.app${payload.url}` : "";

    // Build email HTML based on type
    let emailHtml = "";
    let subject = "";

    switch (payload.type) {
      case "response":
        subject = "🚚 Новый отклик на вашу заявку";
        emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
              .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🚚 ГрузоТакси</h1>
              </div>
              <div class="content">
                <h2>Здравствуйте, ${userName}!</h2>
                <p>${payload.body}</p>
                ${fullUrl ? `<a href="${fullUrl}" class="button">Посмотреть отклик</a>` : ""}
              </div>
              <div class="footer">
                <p>Это автоматическое уведомление от сервиса ГрузоТакси</p>
              </div>
            </div>
          </body>
          </html>
        `;
        break;

      case "deal_status":
        subject = `📦 ${payload.title}`;
        emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .status-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
              .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
              .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📦 Статус сделки</h1>
              </div>
              <div class="content">
                <h2>Здравствуйте, ${userName}!</h2>
                <div class="status-box">
                  <h3>${payload.title}</h3>
                  <p>${payload.body}</p>
                </div>
                ${fullUrl ? `<a href="${fullUrl}" class="button">Открыть сделку</a>` : ""}
              </div>
              <div class="footer">
                <p>Это автоматическое уведомление от сервиса ГрузоТакси</p>
              </div>
            </div>
          </body>
          </html>
        `;
        break;

      case "message":
        subject = "💬 Новое сообщение";
        emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .message-box { background: white; border-left: 4px solid #8b5cf6; padding: 15px; margin: 20px 0; }
              .button { display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
              .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>💬 Новое сообщение</h1>
              </div>
              <div class="content">
                <h2>Здравствуйте, ${userName}!</h2>
                <div class="message-box">
                  <p>${payload.body}</p>
                </div>
                ${fullUrl ? `<a href="${fullUrl}" class="button">Ответить</a>` : ""}
              </div>
              <div class="footer">
                <p>Это автоматическое уведомление от сервиса ГрузоТакси</p>
              </div>
            </div>
          </body>
          </html>
        `;
        break;

      default:
        subject = payload.title;
        emailHtml = `<p>${payload.body}</p>`;
    }

    // Send email via Resend
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: "ГрузоТакси <onboarding@resend.dev>",
      to: [userEmail],
      subject: subject,
      html: emailHtml,
    });

    if (emailError) {
      console.error("Resend error:", emailError);
      return new Response(
        JSON.stringify({ error: emailError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Email sent successfully:", emailResult);

    return new Response(
      JSON.stringify({ success: true, id: emailResult?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Send email error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
