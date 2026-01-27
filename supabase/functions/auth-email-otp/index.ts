import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

// Generate 5-digit OTP
function generateOTP(): string {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

// Send email via Resend
async function sendEmailViaResend(email: string, otp: string, type: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured');
    return false;
  }

  const subject = type === 'email_verification' 
    ? '🔐 Подтвердите email - AsiaLog' 
    : '🔑 Код входа - AsiaLog';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="color: #4F46E5; margin: 0; font-size: 28px;">AsiaLog</h1>
        <p style="color: #6B7280; margin-top: 8px;">Международная логистическая платформа</p>
      </div>
      
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 32px;">
        <h2 style="color: white; margin: 0 0 16px 0; font-size: 24px;">
          ${type === 'email_verification' ? 'Подтверждение Email' : 'Код для входа'}
        </h2>
        <div style="background: white; border-radius: 12px; padding: 24px; display: inline-block;">
          <p style="color: #6B7280; margin: 0 0 12px 0; font-size: 14px;">Ваш код подтверждения:</p>
          <div style="font-size: 48px; font-weight: bold; letter-spacing: 8px; color: #4F46E5; font-family: 'Courier New', monospace;">
            ${otp}
          </div>
        </div>
      </div>

      <div style="background: #F9FAFB; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px;">
          <strong>⏰ Код действителен 5 минут</strong>
        </p>
        <p style="margin: 0; color: #6B7280; font-size: 14px;">
          Введите этот код на странице регистрации/входа для подтверждения вашего email адреса.
        </p>
      </div>

      <div style="background: #FEF2F2; border-left: 4px solid #EF4444; padding: 16px; border-radius: 8px; margin-bottom: 32px;">
        <p style="margin: 0; color: #991B1B; font-size: 14px;">
          <strong>⚠️ Важно:</strong> Никому не сообщайте этот код! Сотрудники AsiaLog никогда не попросят вас предоставить код подтверждения.
        </p>
      </div>

      <div style="text-align: center; padding-top: 24px; border-top: 1px solid #E5E7EB;">
        <p style="color: #9CA3AF; font-size: 13px; margin: 0 0 8px 0;">
          Если вы не запрашивали этот код, просто проигнорируйте это письмо.
        </p>
        <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
          © ${new Date().getFullYear()} AsiaLog. Все права защищены.
        </p>
      </div>
    </div>
  `;

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
        subject,
        html,
      }),
    });

    const result = await response.json();
    console.log('Resend API response:', result);
    return response.ok;
  } catch (error) {
    console.error('Error sending email via Resend:', error);
    return false;
  }
}

// Handler function
async function handleRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { action, email, code, type = 'email_verification' } = await req.json();

    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // ACTION: Send OTP
    if (action === 'send') {
      if (!email) {
        return new Response(
          JSON.stringify({ success: false, error: 'Email required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid email format' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Generate OTP
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Store OTP in otp_codes table
      const { data: otpData, error: insertError } = await supabase
        .from('otp_codes')
        .insert({
          email,
          code: otp,
          type,
          expires_at: expiresAt.toISOString(),
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

      // Send email
      const sent = await sendEmailViaResend(email, otp, type);

      if (!sent) {
        console.log(`[DEV] OTP for ${email}: ${otp}`);
      }

      console.log(`OTP sent to ${email}: ${otp} (dev mode)`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'OTP sent to email',
          otpId: otpData.id,
          expiresAt: expiresAt.toISOString(),
          // Only return code in dev
          ...(Deno.env.get('ENVIRONMENT') !== 'production' && { code: otp })
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: Verify OTP
    if (action === 'verify') {
      if (!email || !code) {
        return new Response(
          JSON.stringify({ success: false, error: 'Email and code required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Find valid OTP
      const { data: otpRecord, error: findError } = await supabase
        .from('otp_codes')
        .select('*')
        .eq('email', email)
        .eq('code', code)
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (findError || !otpRecord) {
        return new Response(
          JSON.stringify({ success: false, error: 'Неверный или истёкший код' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Check max attempts
      if (otpRecord.attempts >= (otpRecord.max_attempts || 5)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Превышено максимальное количество попыток' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Mark as verified
      await supabase
        .from('otp_codes')
        .update({ verified: true, updated_at: new Date().toISOString() })
        .eq('id', otpRecord.id);

      // Update user profile if exists
      if (otpRecord.user_id) {
        await supabase.from('profiles').update({
          email_verified: true,
        }).eq('user_id', otpRecord.user_id);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email verified successfully',
          email: otpRecord.email 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: Resend OTP
    if (action === 'resend') {
      // Same as send but check last send time
      const { data: lastOtp } = await supabase
        .from('otp_codes')
        .select('created_at')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lastOtp) {
        const timeSinceLastSend = Date.now() - new Date(lastOtp.created_at).getTime();
        if (timeSinceLastSend < 60 * 1000) { // 60 seconds
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Подождите 60 секунд перед повторной отправкой',
              retry_after: 60 - Math.floor(timeSinceLastSend / 1000)
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
          );
        }
      }

      // Generate new OTP
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      const { data: otpData, error: insertError } = await supabase
        .from('otp_codes')
        .insert({
          email,
          code: otp,
          type,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to generate OTP' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      await sendEmailViaResend(email, otp, type);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'OTP resent',
          otpId: otpData.id,
          expiresAt: expiresAt.toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    console.error('Email OTP error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

serve(handleRequest);
