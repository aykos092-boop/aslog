import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Click and Payme secret keys (to be configured)
const CLICK_SECRET_KEY = Deno.env.get('CLICK_SECRET_KEY') || '';
const PAYME_SECRET_KEY = Deno.env.get('PAYME_SECRET_KEY') || '';

interface ClickPayload {
  click_trans_id: number;
  service_id: number;
  merchant_trans_id: string;
  amount: number;
  action: number;
  sign_time: string;
  sign_string: string;
}

interface PaymePayload {
  method: string;
  params: {
    id?: string;
    account?: { subscription_id: string };
    amount?: number;
    time?: number;
  };
}

// Verify Click signature (placeholder - implement actual verification)
function verifyClickSignature(payload: ClickPayload): boolean {
  // In production, verify the sign_string using CLICK_SECRET_KEY
  // MD5(click_trans_id + service_id + secret_key + merchant_trans_id + amount + action + sign_time)
  console.log('Verifying Click signature (stub)');
  return true;
}

// Verify Payme authorization (placeholder - implement actual verification)
function verifyPaymeAuth(authHeader: string | null): boolean {
  // In production, verify Basic auth against PAYME_SECRET_KEY
  console.log('Verifying Payme auth (stub)');
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const url = new URL(req.url);
    const provider = url.searchParams.get('provider') || 'click';

    console.log(`Processing ${provider} webhook`);

    if (provider === 'click') {
      return await handleClickWebhook(req, supabase);
    } else if (provider === 'payme') {
      return await handlePaymeWebhook(req, supabase);
    }

    return new Response(
      JSON.stringify({ error: 'Unknown provider' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    console.error('Payment webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function handleClickWebhook(req: Request, supabase: any) {
  const payload: ClickPayload = await req.json();
  console.log('Click payload:', payload);

  // Verify signature
  if (!verifyClickSignature(payload)) {
    return new Response(
      JSON.stringify({ error: -1, error_note: 'Invalid signature' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { merchant_trans_id, amount, action, click_trans_id } = payload;

  // Find the transaction
  const { data: transaction } = await supabase
    .from('payment_transactions')
    .select('*, subscription:user_subscriptions(*)')
    .eq('id', merchant_trans_id)
    .single();

  if (!transaction) {
    return new Response(
      JSON.stringify({ error: -5, error_note: 'Transaction not found' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Verify amount
  if (transaction.amount !== amount) {
    return new Response(
      JSON.stringify({ error: -2, error_note: 'Incorrect amount' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  // action: 0 = prepare, 1 = complete
  if (action === 0) {
    // Prepare transaction
    await supabase
      .from('payment_transactions')
      .update({ 
        provider_transaction_id: click_trans_id.toString(),
        status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', merchant_trans_id);

    return new Response(
      JSON.stringify({
        error: 0,
        error_note: 'Success',
        click_trans_id,
        merchant_trans_id,
        merchant_prepare_id: transaction.id
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } else if (action === 1) {
    // Complete transaction
    await supabase
      .from('payment_transactions')
      .update({ 
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', merchant_trans_id);

    // Activate subscription
    if (transaction.subscription_id) {
      await supabase
        .from('user_subscriptions')
        .update({ 
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', transaction.subscription_id);
    }

    // Log event
    await supabase.from('security_events').insert({
      event_type: 'payment_completed',
      severity: 'info',
      description: `Click payment completed: ${amount} UZS`,
      metadata: { transaction_id: merchant_trans_id, provider: 'click' }
    });

    return new Response(
      JSON.stringify({
        error: 0,
        error_note: 'Success',
        click_trans_id,
        merchant_trans_id,
        merchant_confirm_id: transaction.id
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ error: -8, error_note: 'Unknown action' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

async function handlePaymeWebhook(req: Request, supabase: any) {
  const authHeader = req.headers.get('Authorization');
  
  // Verify authorization
  if (!verifyPaymeAuth(authHeader)) {
    return new Response(
      JSON.stringify({ 
        error: { code: -32504, message: 'Unauthorized' },
        id: null 
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  const payload: PaymePayload = await req.json();
  console.log('Payme payload:', payload);

  const { method, params } = payload;

  switch (method) {
    case 'CheckPerformTransaction': {
      // Check if transaction can be performed
      const subscriptionId = params.account?.subscription_id;
      
      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('*, plan:subscription_plans(*)')
        .eq('id', subscriptionId)
        .single();

      if (!subscription) {
        return new Response(
          JSON.stringify({
            error: { code: -31050, message: 'Subscription not found' },
            id: params.id
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          result: { allow: true },
          id: params.id
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    case 'CreateTransaction': {
      const subscriptionId = params.account?.subscription_id;
      const amount = params.amount ? params.amount / 100 : 0; // Payme sends in tiyin
      
      // Find pending transaction for this subscription
      const { data: existingTx } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .eq('status', 'pending')
        .single();

      if (existingTx) {
        // Update existing transaction
        await supabase
          .from('payment_transactions')
          .update({ 
            provider_transaction_id: params.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingTx.id);

        return new Response(
          JSON.stringify({
            result: {
              create_time: Date.now(),
              transaction: existingTx.id,
              state: 1
            },
            id: params.id
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          error: { code: -31050, message: 'Transaction not found' },
          id: params.id
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    case 'PerformTransaction': {
      // Complete the transaction
      const { data: transaction } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('provider_transaction_id', params.id)
        .single();

      if (!transaction) {
        return new Response(
          JSON.stringify({
            error: { code: -31003, message: 'Transaction not found' },
            id: params.id
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Update transaction status
      await supabase
        .from('payment_transactions')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', transaction.id);

      // Activate subscription
      if (transaction.subscription_id) {
        await supabase
          .from('user_subscriptions')
          .update({ 
            status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('id', transaction.subscription_id);
      }

      // Log event
      await supabase.from('security_events').insert({
        event_type: 'payment_completed',
        severity: 'info',
        description: `Payme payment completed: ${transaction.amount} UZS`,
        metadata: { transaction_id: transaction.id, provider: 'payme' }
      });

      return new Response(
        JSON.stringify({
          result: {
            transaction: transaction.id,
            perform_time: Date.now(),
            state: 2
          },
          id: params.id
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    case 'CancelTransaction': {
      // Cancel transaction
      const { data: transaction } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('provider_transaction_id', params.id)
        .single();

      if (transaction) {
        await supabase
          .from('payment_transactions')
          .update({ 
            status: 'refunded',
            updated_at: new Date().toISOString()
          })
          .eq('id', transaction.id);

        // Deactivate subscription
        if (transaction.subscription_id) {
          await supabase
            .from('user_subscriptions')
            .update({ 
              status: 'cancelled',
              updated_at: new Date().toISOString()
            })
            .eq('id', transaction.subscription_id);
        }
      }

      return new Response(
        JSON.stringify({
          result: {
            transaction: transaction?.id || null,
            cancel_time: Date.now(),
            state: -1
          },
          id: params.id
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    case 'CheckTransaction': {
      const { data: transaction } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('provider_transaction_id', params.id)
        .single();

      if (!transaction) {
        return new Response(
          JSON.stringify({
            error: { code: -31003, message: 'Transaction not found' },
            id: params.id
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      const stateMap: Record<string, number> = {
        pending: 1,
        completed: 2,
        refunded: -1,
        failed: -2
      };

      return new Response(
        JSON.stringify({
          result: {
            create_time: new Date(transaction.created_at).getTime(),
            perform_time: transaction.status === 'completed' ? new Date(transaction.updated_at).getTime() : 0,
            cancel_time: transaction.status === 'refunded' ? new Date(transaction.updated_at).getTime() : 0,
            transaction: transaction.id,
            state: stateMap[transaction.status] || 1
          },
          id: params.id
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    default:
      return new Response(
        JSON.stringify({
          error: { code: -32601, message: 'Method not found' },
          id: params.id
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
  }
}
