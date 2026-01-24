import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

// Generate secure token
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// Send email via Resend
async function sendResetEmail(email: string, resetUrl: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AsiaLog <noreply@asialog.uz>',
        to: [email],
        subject: 'Восстановление пароля - AsiaLog',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Восстановление пароля</h2>
            <p>Вы запросили восстановление пароля для вашего аккаунта AsiaLog.</p>
            <p>Нажмите на кнопку ниже для сброса пароля:</p>
            <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 8px; margin: 16px 0;">
              Сбросить пароль
            </a>
            <p style="color: #666; font-size: 14px;">Ссылка действительна 15 минут.</p>
            <p style="color: #999; font-size: 12px;">Если вы не запрашивали сброс пароля, проигнорируйте это письмо.</p>
          </div>
        `,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

// Send OTP via Telegram
async function sendTelegramOTP(chatId: string, otp: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('TELEGRAM_BOT_TOKEN not configured');
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
          text: `🔑 <b>Сброс пароля AsiaLog</b>\n\nВаш код: <code>${otp}</code>\n\n⏰ Код действителен 15 минут.\n\n⚠️ Никому не сообщайте этот код!`,
          parse_mode: 'HTML',
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { action, email, phone, token, newPassword, otp } = await req.json();

    // ACTION: Request password reset
    if (action === 'request') {
      if (!email && !phone) {
        return new Response(
          JSON.stringify({ success: false, error: 'Email or phone required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Find user
      let userId: string | null = null;
      let telegramChatId: string | null = null;

      if (email) {
        const { data: users } = await supabase.auth.admin.listUsers();
        const user = users?.users?.find(u => u.email === email);
        if (user) userId = user.id;
      }

      if (phone) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('phone', phone)
          .single();
        if (profile) userId = profile.user_id;

        // Check for linked Telegram
        const { data: telegram } = await supabase
          .from('telegram_users')
          .select('telegram_id')
          .eq('user_id', userId)
          .single();
        if (telegram) telegramChatId = telegram.telegram_id;
      }

      if (!userId) {
        // Don't reveal if user exists
        return new Response(
          JSON.stringify({ success: true, message: 'If the account exists, reset instructions have been sent' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Rate limiting - max 3 requests per hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('password_reset_tokens')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', oneHourAgo);

      if (count && count >= 3) {
        await supabase.from('security_events').insert({
          user_id: userId,
          event_type: 'password_reset_rate_limit',
          severity: 'warning',
          description: 'Password reset rate limit exceeded',
        });

        return new Response(
          JSON.stringify({ success: false, error: 'Too many reset requests. Try again later.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
        );
      }

      const resetToken = generateToken();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Store token
      await supabase.from('password_reset_tokens').insert({
        user_id: userId,
        token: resetToken,
        expires_at: expiresAt.toISOString(),
      });

      // Send via appropriate channel
      if (email) {
        const resetUrl = `${req.headers.get('origin') || 'https://asialog.uz'}/reset-password?token=${resetToken}`;
        await sendResetEmail(email, resetUrl);
      }

      if (phone && telegramChatId) {
        // Generate OTP for Telegram
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        await supabase.from('otp_codes').insert({
          user_id: userId,
          phone,
          code: otpCode,
          type: 'password_reset',
          expires_at: expiresAt.toISOString(),
          telegram_chat_id: telegramChatId,
        });
        await sendTelegramOTP(telegramChatId, otpCode);
      }

      // Log event
      await supabase.from('security_events').insert({
        user_id: userId,
        event_type: 'password_reset_requested',
        severity: 'info',
        description: 'Password reset requested',
        metadata: { method: email ? 'email' : 'telegram' }
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Reset instructions sent',
          method: telegramChatId ? 'telegram' : 'email'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: Verify token and reset password
    if (action === 'reset') {
      if ((!token && !otp) || !newPassword) {
        return new Response(
          JSON.stringify({ success: false, error: 'Token/OTP and new password required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Validate password strength
      if (newPassword.length < 8) {
        return new Response(
          JSON.stringify({ success: false, error: 'Password must be at least 8 characters' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      let userId: string | null = null;

      // Verify token
      if (token) {
        const { data: resetRecord } = await supabase
          .from('password_reset_tokens')
          .select('*')
          .eq('token', token)
          .eq('used', false)
          .gt('expires_at', new Date().toISOString())
          .single();

        if (!resetRecord) {
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid or expired token' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        userId = resetRecord.user_id;

        // Mark token as used
        await supabase
          .from('password_reset_tokens')
          .update({ used: true })
          .eq('id', resetRecord.id);
      }

      // Verify OTP
      if (otp && phone) {
        const { data: otpRecord } = await supabase
          .from('otp_codes')
          .select('*')
          .eq('phone', phone)
          .eq('code', otp)
          .eq('type', 'password_reset')
          .eq('verified', false)
          .gt('expires_at', new Date().toISOString())
          .single();

        if (!otpRecord) {
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid or expired OTP' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        userId = otpRecord.user_id;

        // Mark OTP as verified
        await supabase
          .from('otp_codes')
          .update({ verified: true })
          .eq('id', otpRecord.id);
      }

      if (!userId) {
        return new Response(
          JSON.stringify({ success: false, error: 'User not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Update password
      const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (updateError) {
        console.error('Password update error:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to update password' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Log event
      await supabase.from('security_events').insert({
        user_id: userId,
        event_type: 'password_reset_completed',
        severity: 'info',
        description: 'Password successfully reset',
      });

      return new Response(
        JSON.stringify({ success: true, message: 'Password reset successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    console.error('Password reset error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});