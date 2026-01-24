import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Click and Payme secret keys
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

// MD5 hash implementation for Click signature
async function md5Hash(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('MD5', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verify Click signature using MD5 as per Click API specification
async function verifyClickSignature(payload: ClickPayload): Promise<boolean> {
  if (!CLICK_SECRET_KEY) {
    console.error('CLICK_SECRET_KEY not configured - rejecting request');
    return false;
  }

  try {
    const { click_trans_id, service_id, merchant_trans_id, amount, action, sign_time, sign_string } = payload;
    
    // Build signature string as per Click API docs:
    // MD5(click_trans_id + service_id + secret_key + merchant_trans_id + amount + action + sign_time)
    const signatureString = `${click_trans_id}${service_id}${CLICK_SECRET_KEY}${merchant_trans_id}${amount}${action}${sign_time}`;
    const calculatedSign = await md5Hash(signatureString);
    
    const isValid = calculatedSign === sign_string;
    
    if (!isValid) {
      console.error('Click signature mismatch', { 
        expected: calculatedSign, 
        received: sign_string,
        merchant_trans_id 
      });
    }
    
    return isValid;
  } catch (error) {
    console.error('Click signature verification error:', error);
    return false;
  }
}

// Verify Payme Basic authorization header
function verifyPaymeAuth(authHeader: string | null): boolean {
  if (!PAYME_SECRET_KEY) {
    console.error('PAYME_SECRET_KEY not configured - rejecting request');
    return false;
  }

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    console.error('Missing or invalid Payme auth header');
    return false;
  }

  try {
    // Decode Base64 credentials
    const base64Credentials = authHeader.slice(6); // Remove 'Basic '
    const credentials = atob(base64Credentials);
    const [username, password] = credentials.split(':');
    
    // Payme sends 'Paycom' as username and merchant key as password
    const isValid = username === 'Paycom' && password === PAYME_SECRET_KEY;
    
    if (!isValid) {
      console.error('Payme auth verification failed', { username });
    }
    
    return isValid;
  } catch (error) {
    console.error('Payme auth verification error:', error);
    return false;
  }
}

// Input validation helpers
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function validateClickPayload(payload: unknown): { valid: boolean; error?: string; data?: ClickPayload } {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Invalid payload structure' };
  }

  const p = payload as Record<string, unknown>;

  if (typeof p.click_trans_id !== 'number' || p.click_trans_id <= 0) {
    return { valid: false, error: 'Invalid click_trans_id' };
  }
  if (typeof p.service_id !== 'number' || p.service_id <= 0) {
    return { valid: false, error: 'Invalid service_id' };
  }
  if (typeof p.merchant_trans_id !== 'string' || !isValidUUID(p.merchant_trans_id)) {
    return { valid: false, error: 'Invalid merchant_trans_id' };
  }
  if (typeof p.amount !== 'number' || p.amount <= 0 || p.amount > 100000000) {
    return { valid: false, error: 'Invalid amount' };
  }
  if (typeof p.action !== 'number' || (p.action !== 0 && p.action !== 1)) {
    return { valid: false, error: 'Invalid action' };
  }
  if (typeof p.sign_time !== 'string' || p.sign_time.length > 50) {
    return { valid: false, error: 'Invalid sign_time' };
  }
  if (typeof p.sign_string !== 'string' || p.sign_string.length !== 32) {
    return { valid: false, error: 'Invalid sign_string' };
  }

  return { valid: true, data: payload as ClickPayload };
}

function validatePaymePayload(payload: unknown): { valid: boolean; error?: string; data?: PaymePayload } {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Invalid payload structure' };
  }

  const p = payload as Record<string, unknown>;

  if (typeof p.method !== 'string' || p.method.length > 50) {
    return { valid: false, error: 'Invalid method' };
  }

  const validMethods = ['CheckPerformTransaction', 'CreateTransaction', 'PerformTransaction', 'CancelTransaction', 'CheckTransaction'];
  if (!validMethods.includes(p.method)) {
    return { valid: false, error: 'Unknown method' };
  }

  if (!p.params || typeof p.params !== 'object') {
    return { valid: false, error: 'Invalid params' };
  }

  return { valid: true, data: payload as PaymePayload };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const clientIp = req.headers.get('x-forwarded-for') || 'unknown';

  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get('provider') || 'click';

    console.log(`Processing ${provider} webhook from ${clientIp}`);

    if (provider === 'click') {
      return await handleClickWebhook(req, supabase, clientIp);
    } else if (provider === 'payme') {
      return await handlePaymeWebhook(req, supabase, clientIp);
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

async function handleClickWebhook(req: Request, supabase: any, clientIp: string) {
  let rawPayload: unknown;
  try {
    rawPayload = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: -8, error_note: 'Invalid JSON' }),
      { headers: { 'Content-Type': 'application/json' }, status: 400 }
    );
  }

  // Validate payload structure
  const validation = validateClickPayload(rawPayload);
  if (!validation.valid || !validation.data) {
    console.error('Click payload validation failed:', validation.error);
    return new Response(
      JSON.stringify({ error: -8, error_note: validation.error || 'Invalid payload' }),
      { headers: { 'Content-Type': 'application/json' }, status: 400 }
    );
  }

  const payload = validation.data;
  console.log('Click payload:', { 
    merchant_trans_id: payload.merchant_trans_id, 
    amount: payload.amount, 
    action: payload.action 
  });

  // Verify signature - CRITICAL SECURITY CHECK
  const signatureValid = await verifyClickSignature(payload);
  if (!signatureValid) {
    // Log security event for failed verification
    await supabase.from('security_events').insert({
      event_type: 'webhook_verification_failed',
      severity: 'critical',
      description: 'Click webhook signature verification failed',
      ip_address: clientIp,
      metadata: { 
        merchant_trans_id: payload.merchant_trans_id,
        provider: 'click'
      }
    });

    return new Response(
      JSON.stringify({ error: -1, error_note: 'Invalid signature' }),
      { headers: { 'Content-Type': 'application/json' }, status: 401 }
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

  // Verify amount matches
  if (Math.abs(transaction.amount - amount) > 0.01) {
    console.error('Amount mismatch:', { expected: transaction.amount, received: amount });
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
      ip_address: clientIp,
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

async function handlePaymeWebhook(req: Request, supabase: any, clientIp: string) {
  const authHeader = req.headers.get('Authorization');
  
  // Verify authorization - CRITICAL SECURITY CHECK
  if (!verifyPaymeAuth(authHeader)) {
    // Log security event for failed verification
    await supabase.from('security_events').insert({
      event_type: 'webhook_verification_failed',
      severity: 'critical',
      description: 'Payme webhook authorization verification failed',
      ip_address: clientIp,
      metadata: { provider: 'payme' }
    });

    return new Response(
      JSON.stringify({ 
        error: { code: -32504, message: 'Unauthorized' },
        id: null 
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 401 }
    );
  }

  let rawPayload: unknown;
  try {
    rawPayload = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ 
        error: { code: -32700, message: 'Parse error' },
        id: null 
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 400 }
    );
  }

  // Validate payload structure
  const validation = validatePaymePayload(rawPayload);
  if (!validation.valid || !validation.data) {
    return new Response(
      JSON.stringify({ 
        error: { code: -32600, message: validation.error || 'Invalid request' },
        id: null 
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 400 }
    );
  }

  const payload = validation.data;
  console.log('Payme payload:', { method: payload.method });

  const { method, params } = payload;

  switch (method) {
    case 'CheckPerformTransaction': {
      // Check if transaction can be performed
      const subscriptionId = params.account?.subscription_id;
      
      if (!subscriptionId || !isValidUUID(subscriptionId)) {
        return new Response(
          JSON.stringify({
            error: { code: -31050, message: 'Invalid subscription_id' },
            id: params.id
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

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
      
      if (!subscriptionId || !isValidUUID(subscriptionId)) {
        return new Response(
          JSON.stringify({
            error: { code: -31050, message: 'Invalid subscription_id' },
            id: params.id
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

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
        ip_address: clientIp,
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
