import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Cleanup Expired Auth Tokens Cron Job
 * 
 * This function should be called periodically (e.g., every hour)
 * to clean up expired tokens and maintain database hygiene.
 */

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const stats = {
      otp_codes_deleted: 0,
      password_reset_deleted: 0,
      security_events_deleted: 0,
    };

    // 1. Delete expired OTP codes
    const { data: expiredOtp } = await supabase
      .from('otp_codes')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id');
    stats.otp_codes_deleted = expiredOtp?.length || 0;

    // 2. Delete expired password reset tokens
    const { data: expiredResetTokens } = await supabase
      .from('password_reset_tokens')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id');
    stats.password_reset_deleted = expiredResetTokens?.length || 0;

    // 3. Delete old security events (keep last 1 year)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const { data: oldEvents } = await supabase
      .from('security_events')
      .delete()
      .lt('created_at', oneYearAgo.toISOString())
      .select('id');
    stats.security_events_deleted = oldEvents?.length || 0;

    // Log cleanup event
    await supabase.from('security_events').insert({
      event_type: 'cleanup_completed',
      severity: 'info',
      description: 'Periodic auth tokens cleanup completed',
      metadata: stats
    });

    console.log('Cleanup completed:', stats);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cleanup completed successfully',
        stats,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Cleanup error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: errorMessage
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    );
  }
});
