import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ClickWebhookData {
  click_trans_id: number;
  service_id: number;
  click_paydoc_id: number;
  merchant_trans_id: string;
  amount: number;
  action: number;
  error: number;
  error_note: string;
  sign_time: number;
  sign_string: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.text()
    const params = new URLSearchParams(body)
    
    // Парсим данные от Click
    const webhookData: ClickWebhookData = {
      click_trans_id: parseInt(params.get('click_trans_id') || '0'),
      service_id: parseInt(params.get('service_id') || '0'),
      click_paydoc_id: parseInt(params.get('click_paydoc_id') || '0'),
      merchant_trans_id: params.get('merchant_trans_id') || '',
      amount: parseInt(params.get('amount') || '0'),
      action: parseInt(params.get('action') || '0'),
      error: parseInt(params.get('error') || '0'),
      error_note: params.get('error_note') || '',
      sign_time: parseInt(params.get('sign_time') || '0'),
      sign_string: params.get('sign_string') || ''
    }

    console.log('Click webhook received:', webhookData)

    // Инициализация Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Обрабатываем разные действия
    let status = 0
    let message = 'OK'

    switch (webhookData.action) {
      case 1: // Подготовка платежа
        await logPayment(supabase, 'click', 'webhook', webhookData.merchant_trans_id, '', webhookData.amount, 'preparing', webhookData)
        break

      case 0: // Успешный платеж
        // Извлекаем user_id из merchant_trans_id
        const userId = extractUserIdFromMerchantTransId(webhookData.merchant_trans_id)
        
        if (userId) {
          // Пополняем баланс пользователя
          const { error: balanceError } = await supabase.rpc('add_user_balance', {
            p_user_id: userId,
            p_amount: webhookData.amount
          })

          if (balanceError) {
            console.error('Error adding balance:', balanceError)
            status = -2
            message = 'Balance update failed'
          } else {
            await logPayment(supabase, 'click', 'webhook', webhookData.merchant_trans_id, userId, webhookData.amount, 'completed', webhookData)
          }
        } else {
          status = -1
          message = 'Invalid user ID'
        }
        break

      case -1: // Отмена платежа
        const userId = extractUserIdFromMerchantTransId(webhookData.merchant_trans_id)
        await logPayment(supabase, 'click', 'webhook', webhookData.merchant_trans_id, userId || '', webhookData.amount, 'cancelled', webhookData)
        break

      default:
        status = -1
        message = 'Unknown action'
    }

    // Формируем ответ для Click
    const response = new URLSearchParams()
    response.append('click_trans_id', webhookData.click_trans_id.toString())
    response.append('merchant_trans_id', webhookData.merchant_trans_id)
    response.append('merchant_prepare_id', webhookData.merchant_trans_id)
    response.append('error', status.toString())
    response.append('error_note', message)

    return new Response(response.toString(), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  } catch (error) {
    console.error('Click webhook error:', error)
    
    // Ответ об ошибке
    const response = new URLSearchParams()
    response.append('error', '-1')
    response.append('error_note', 'Internal server error')

    return new Response(response.toString(), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  }
})

// Извлечение user_id из merchant_trans_id
function extractUserIdFromMerchantTransId(merchantTransId: string): string | null {
  // merchant_trans_id формат: swift_timestamp_userId
  const parts = merchantTransId.split('_')
  return parts.length >= 3 ? parts[2] : null
}

// Логирование платежных операций
async function logPayment(
  supabase: any,
  payment_system: string,
  operation_type: string,
  transaction_id: string | null,
  user_id: string,
  amount: number,
  status: string,
  data: any
): Promise<void> {
  try {
    await supabase
      .from('payment_logs')
      .insert({
        payment_system,
        operation_type,
        transaction_id,
        user_id,
        amount,
        status,
        request_data: data,
        response_data: data
      })
  } catch (error) {
    console.error('Error logging payment:', error)
  }
}
