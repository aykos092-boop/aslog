import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Click API credentials (to be configured)
const CLICK_MERCHANT_ID = Deno.env.get('CLICK_MERCHANT_ID') || 'demo_merchant';
const CLICK_SERVICE_ID = Deno.env.get('CLICK_SERVICE_ID') || 'demo_service';
const CLICK_SECRET_KEY = Deno.env.get('CLICK_SECRET_KEY') || '';

// Payme credentials
const PAYME_MERCHANT_ID = Deno.env.get('PAYME_MERCHANT_ID') || 'demo_merchant';

interface PaymentRequest {
  planId: string;
  billingPeriod: 'monthly' | 'yearly';
  provider: 'click' | 'payme';
  returnUrl?: string;
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
    const { planId, billingPeriod, provider, returnUrl } = await req.json() as PaymentRequest;

    console.log(`Creating payment: user=${userId}, plan=${planId}, period=${billingPeriod}, provider=${provider}`);

    // Get plan details
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: plan, error: planError } = await adminClient
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ error: 'Plan not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const amount = billingPeriod === 'monthly' ? plan.price_monthly : plan.price_yearly;

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

    console.log(`Payment URL generated: ${paymentUrl}`);

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
  // Click payment URL format
  // https://my.click.uz/services/pay?service_id=XXX&merchant_id=XXX&amount=XXX&transaction_param=XXX&return_url=XXX
  const clickBaseUrl = 'https://my.click.uz/services/pay';
  
  const queryParams = new URLSearchParams({
    service_id: params.serviceId,
    merchant_id: params.merchantId,
    amount: params.amount.toString(),
    transaction_param: params.transactionId,
    return_url: params.returnUrl,
    // Additional optional params
    // card_type: '8600' // Humo/UzCard
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
  // Payme payment URL format
  // https://checkout.paycom.uz/base64_encoded_params
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
