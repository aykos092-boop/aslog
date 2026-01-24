import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send message via Telegram Bot
async function sendTelegramMessage(chatId: string, message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN not configured');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    );

    const result = await response.json();
    console.log('Telegram API response:', result);
    return result.ok;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { action, phone, telegramChatId, code, userId } = await req.json();

    console.log(`Processing action: ${action}`, { phone, telegramChatId });

    // ACTION: Send OTP
    if (action === 'send') {
      if (!phone) {
        return new Response(
          JSON.stringify({ success: false, error: 'Phone number required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Check rate limiting - max 5 OTPs per hour per phone
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('otp_codes')
        .select('*', { count: 'exact', head: true })
        .eq('phone', phone)
        .gte('created_at', oneHourAgo);

      if (count && count >= 5) {
        // Log security event
        await supabase.from('security_events').insert({
          event_type: 'otp_rate_limit_exceeded',
          severity: 'warning',
          description: `Rate limit exceeded for phone: ${phone}`,
          metadata: { phone, count }
        });

        return new Response(
          JSON.stringify({ success: false, error: 'Too many OTP requests. Try again later.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
        );
      }

      // Generate OTP
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Store OTP
      const { data: otpData, error: insertError } = await supabase
        .from('otp_codes')
        .insert({
          phone,
          code: otp,
          type: 'phone_verification',
          expires_at: expiresAt.toISOString(),
          telegram_chat_id: telegramChatId || null,
          user_id: userId || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error storing OTP:', insertError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to generate OTP' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // If telegramChatId provided, send via Telegram
      if (telegramChatId) {
        const message = `🔐 <b>Код подтверждения AsiaLog</b>\n\nВаш код: <code>${otp}</code>\n\n⏰ Код действителен 5 минут.\n\n⚠️ Никому не сообщайте этот код!`;
        const sent = await sendTelegramMessage(telegramChatId, message);

        if (!sent) {
          return new Response(
            JSON.stringify({ success: false, error: 'Failed to send Telegram message' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }
      }

      console.log(`OTP generated for ${phone}: ${otp}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: telegramChatId ? 'OTP sent via Telegram' : 'OTP generated',
          otpId: otpData.id,
          expiresAt: expiresAt.toISOString(),
          // Only return code if no Telegram (for dev/testing)
          ...((!telegramChatId && Deno.env.get('ENVIRONMENT') !== 'production') && { code: otp })
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: Verify OTP
    if (action === 'verify') {
      if (!phone || !code) {
        return new Response(
          JSON.stringify({ success: false, error: 'Phone and code required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Find valid OTP
      const { data: otpRecord, error: findError } = await supabase
        .from('otp_codes')
        .select('*')
        .eq('phone', phone)
        .eq('code', code)
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (findError || !otpRecord) {
        // Increment attempts on latest OTP
        await supabase
          .from('otp_codes')
          .update({ attempts: (otpRecord?.attempts || 0) + 1 })
          .eq('phone', phone)
          .eq('verified', false);

        // Log failed attempt
        await supabase.from('security_events').insert({
          event_type: 'otp_verification_failed',
          severity: 'warning',
          description: `Invalid OTP attempt for phone: ${phone}`,
          metadata: { phone, providedCode: code }
        });

        return new Response(
          JSON.stringify({ success: false, error: 'Invalid or expired OTP' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Check max attempts
      if (otpRecord.attempts >= otpRecord.max_attempts) {
        return new Response(
          JSON.stringify({ success: false, error: 'Maximum attempts exceeded' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Mark as verified
      await supabase
        .from('otp_codes')
        .update({ verified: true, updated_at: new Date().toISOString() })
        .eq('id', otpRecord.id);

      // Update profile phone_verified if user exists
      if (otpRecord.user_id) {
        await supabase
          .from('profiles')
          .update({ phone_verified: true, phone })
          .eq('user_id', otpRecord.user_id);
      }

      // Log success
      await supabase.from('security_events').insert({
        user_id: otpRecord.user_id,
        event_type: 'otp_verification_success',
        severity: 'info',
        description: `Phone verified: ${phone}`,
        metadata: { phone }
      });

      return new Response(
        JSON.stringify({ success: true, message: 'Phone verified successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: Link Telegram account
    if (action === 'link-telegram') {
      if (!userId || !telegramChatId) {
        return new Response(
          JSON.stringify({ success: false, error: 'User ID and Telegram chat ID required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const { error } = await supabase
        .from('telegram_users')
        .upsert({
          user_id: userId,
          telegram_id: telegramChatId,
          is_verified: true,
        }, { onConflict: 'telegram_id' });

      if (error) {
        console.error('Error linking Telegram:', error);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to link Telegram' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Telegram linked successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});