import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Click API credentials
const CLICK_MERCHANT_ID = Deno.env.get('CLICK_MERCHANT_ID') || 'demo_merchant';
const CLICK_SERVICE_ID = Deno.env.get('CLICK_SERVICE_ID') || 'demo_service';

// Payme credentials
const PAYME_MERCHANT_ID = Deno.env.get('PAYME_MERCHANT_ID') || 'demo_merchant';

// Input validation helpers
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function sanitizeString(str: unknown, maxLength: number = 500): string | null {
  if (typeof str !== 'string') return null;
  return str.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, maxLength);
}

interface PaymentRequest {
  planId: string;
  billingPeriod: 'monthly' | 'yearly';
  provider: 'click' | 'payme';
  returnUrl?: string;
}

function validatePaymentRequest(body: unknown): { valid: boolean; error?: string; data?: PaymentRequest } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const b = body as Record<string, unknown>;

  // Validate planId
  const planId = sanitizeString(b.planId, 36);
  if (!planId || !isValidUUID(planId)) {
    return { valid: false, error: 'planId must be a valid UUID' };
  }

  // Validate billingPeriod
  if (b.billingPeriod !== 'monthly' && b.billingPeriod !== 'yearly') {
    return { valid: false, error: 'billingPeriod must be "monthly" or "yearly"' };
  }

  // Validate provider
  if (b.provider !== 'click' && b.provider !== 'payme') {
    return { valid: false, error: 'provider must be "click" or "payme"' };
  }

  // Validate returnUrl (optional)
  let returnUrl: string | undefined;
  if (b.returnUrl !== undefined && b.returnUrl !== null) {
    const sanitizedUrl = sanitizeString(b.returnUrl, 2000);
    if (sanitizedUrl) {
      try {
        const urlObj = new URL(sanitizedUrl);
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          return { valid: false, error: 'returnUrl must use http or https protocol' };
        }
        returnUrl = sanitizedUrl;
      } catch {
        return { valid: false, error: 'returnUrl must be a valid URL' };
      }
    }
  }

  return {
    valid: true,
    data: {
      planId,
      billingPeriod: b.billingPeriod,
      provider: b.provider,
      returnUrl
    }
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const userId = claimsData.claims.sub;
    if (!userId || !isValidUUID(userId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid user session' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Parse and validate request body
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const validation = validatePaymentRequest(rawBody);
    if (!validation.valid || !validation.data) {
      return new Response(
        JSON.stringify({ error: validation.error || 'Invalid request' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { planId, billingPeriod, provider, returnUrl } = validation.data;

    console.log(`Creating payment: user=${userId}, plan=${planId}, period=${billingPeriod}, provider=${provider}`);

    // Get plan details
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: plan, error: planError } = await adminClient
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ error: 'Plan not found or inactive' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const amount = billingPeriod === 'monthly' ? plan.price_monthly : plan.price_yearly;
    
    // Validate amount
    if (typeof amount !== 'number' || amount <= 0 || amount > 100000000) {
      return new Response(
        JSON.stringify({ error: 'Invalid plan pricing' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Cancel existing active subscription if any
    await adminClient
      .from('user_subscriptions')
      .update({ status: 'cancelled' })
      .eq('user_id', userId)
      .eq('status', 'active');

    // Calculate period end date
    const periodEnd = new Date();
    if (billingPeriod === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    // Create pending subscription
    const { data: subscription, error: subError } = await adminClient
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        plan_id: planId,
        status: 'pending',
        current_period_end: periodEnd.toISOString(),
      })
      .select()
      .single();

    if (subError) {
      console.error('Subscription creation error:', subError);
      return new Response(
        JSON.stringify({ error: 'Failed to create subscription' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Create payment transaction
    const { data: transaction, error: txError } = await adminClient
      .from('payment_transactions')
      .insert({
        user_id: userId,
        subscription_id: subscription.id,
        amount: amount,
        currency: 'UZS',
        provider: provider,
        status: 'pending',
        metadata: {
          plan_name: plan.name,
          billing_period: billingPeriod,
        }
      })
      .select()
      .single();

    if (txError) {
      console.error('Transaction creation error:', txError);
      return new Response(
        JSON.stringify({ error: 'Failed to create transaction' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Generate payment URL based on provider
    let paymentUrl: string;
    const baseReturnUrl = returnUrl || `${SUPABASE_URL.replace('.supabase.co', '')}/dashboard#subscription`;

    if (provider === 'click') {
      paymentUrl = generateClickPaymentUrl({
        merchantId: CLICK_MERCHANT_ID,
        serviceId: CLICK_SERVICE_ID,
        transactionId: transaction.id,
        amount: amount,
        returnUrl: baseReturnUrl,
        description: `Подписка ${plan.display_name || plan.name} (${billingPeriod === 'monthly' ? 'месяц' : 'год'})`,
      });
    } else {
      paymentUrl = generatePaymePaymentUrl({
        merchantId: PAYME_MERCHANT_ID,
        transactionId: subscription.id,
        amount: amount * 100, // Payme uses tiyin
        returnUrl: baseReturnUrl,
        description: `Подписка ${plan.display_name || plan.name}`,
      });
    }

    // Log security event
    await adminClient.from('security_events').insert({
      user_id: userId,
      event_type: 'payment_initiated',
      severity: 'info',
      description: `Payment initiated: ${provider} - ${amount} UZS for ${plan.name}`,
      metadata: {
        transaction_id: transaction.id,
        subscription_id: subscription.id,
        provider,
        amount,
      }
    });

    console.log(`Payment URL generated successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        paymentUrl,
        transactionId: transaction.id,
        subscriptionId: subscription.id,
        amount,
        provider,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Create payment error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

interface ClickPaymentParams {
  merchantId: string;
  serviceId: string;
  transactionId: string;
  amount: number;
  returnUrl: string;
  description: string;
}

function generateClickPaymentUrl(params: ClickPaymentParams): string {
  const clickBaseUrl = 'https://my.click.uz/services/pay';
  
  const queryParams = new URLSearchParams({
    service_id: params.serviceId,
    merchant_id: params.merchantId,
    amount: params.amount.toString(),
    transaction_param: params.transactionId,
    return_url: params.returnUrl,
  });

  return `${clickBaseUrl}?${queryParams.toString()}`;
}

interface PaymePaymentParams {
  merchantId: string;
  transactionId: string;
  amount: number; // in tiyin (1/100 of sum)
  returnUrl: string;
  description: string;
}

function generatePaymePaymentUrl(params: PaymePaymentParams): string {
  const paymeData = {
    m: params.merchantId,
    ac: {
      subscription_id: params.transactionId,
    },
    a: params.amount,
    c: params.returnUrl,
  };

  // Encode to base64
  const encodedData = btoa(JSON.stringify(paymeData));
  
  return `https://checkout.paycom.uz/${encodedData}`;
}
