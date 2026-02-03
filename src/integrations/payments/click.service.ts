import { supabase } from '@/integrations/supabase/client';

export interface ClickPaymentRequest {
  amount: number;
  user_id: string;
  description: string;
  return_url?: string;
}

export interface ClickPaymentResponse {
  payment_url: string;
  payment_id: string;
  merchant_trans_id: string;
}

export interface ClickWebhookData {
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

export class ClickService {
  private static readonly MERCHANT_ID = 'swiftship';
  private static readonly SERVICE_ID = 1;
  private static readonly SECRET_KEY = 'your-click-secret-key'; // В реальном приложении должно быть в env

  // Создание платежа через Click
  static async createPayment(request: ClickPaymentRequest): Promise<ClickPaymentResponse | null> {
    try {
      const merchantTransId = `swift_${Date.now()}_${request.user_id}`;
      
      // Логируем создание платежа
      await this.logPayment('click', 'deposit', null, request.user_id, request.amount, 'pending', {
        merchant_trans_id: merchantTransId,
        description: request.description
      });

      // В реальном приложении здесь будет API вызов к Click
      // Сейчас симулируем ответ
      const paymentUrl = `https://my.click.uz/services/pay?service_id=${this.SERVICE_ID}&merchant_trans_id=${merchantTransId}&amount=${request.amount}&return_url=${encodeURIComponent(request.return_url || window.location.origin)}`;
      
      const response: ClickPaymentResponse = {
        payment_url: paymentUrl,
        payment_id: merchantTransId,
        merchant_trans_id: merchantTransId
      };

      // Обновляем лог
      await this.logPayment('click', 'deposit', merchantTransId, request.user_id, request.amount, 'created', response);

      return response;
    } catch (error) {
      console.error('Error creating Click payment:', error);
      await this.logPayment('click', 'deposit', null, request.user_id, request.amount, 'failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  // Обработка вебхука от Click
  static async handleWebhook(webhookData: ClickWebhookData): Promise<{ status: number; message: string }> {
    try {
      // Валидация подписи
      if (!this.validateSignature(webhookData)) {
        await this.logPayment('click', 'webhook', webhookData.merchant_trans_id, '', webhookData.amount, 'failed', {
          error: 'Invalid signature',
          webhook_data: webhookData
        });
        return { status: -1, message: 'Invalid signature' };
      }

      const { merchant_trans_id, amount, action } = webhookData;

      // Ищем лог платежа
      const { data: paymentLog } = await supabase
        .from('payment_logs')
        .select('*')
        .eq('transaction_id', merchant_trans_id)
        .single();

      if (!paymentLog) {
        return { status: -1, message: 'Payment not found' };
      }

      // Обрабатываем разные действия
      switch (action) {
        case 1: // Подготовка платежа
          await this.logPayment('click', 'webhook', merchant_trans_id, paymentLog.user_id, amount, 'preparing', webhookData);
          return { status: 0, message: 'OK' };

        case 0: // Успешный платеж
          // Пополняем баланс пользователя
          const { error: balanceError } = await supabase.rpc('add_user_balance', {
            p_user_id: paymentLog.user_id,
            p_amount: amount
          });

          if (balanceError) {
            console.error('Error adding balance:', balanceError);
            return { status: -2, message: 'Balance update failed' };
          }

          // Обновляем статус платежа
          await this.logPayment('click', 'webhook', merchant_trans_id, paymentLog.user_id, amount, 'completed', webhookData);
          return { status: 0, message: 'OK' };

        case -1: // Отмена платежа
          await this.logPayment('click', 'webhook', merchant_trans_id, paymentLog.user_id, amount, 'cancelled', webhookData);
          return { status: 0, message: 'OK' };

        default:
          return { status: -1, message: 'Unknown action' };
      }
    } catch (error) {
      console.error('Error handling Click webhook:', error);
      return { status: -2, message: 'Internal error' };
    }
  }

  // Создание выплаты на карту через Click
  static async createPayout(user_id: string, amount: number, card_number: string): Promise<boolean> {
    try {
      const payoutId = `payout_${Date.now()}_${user_id}`;
      
      await this.logPayment('click', 'withdraw', payoutId, user_id, amount, 'pending', {
        card_number: card_number
      });

      // В реальном приложении здесь будет API вызов к Click для выплаты
      // Сейчас симулируем успешную выплату
      await this.logPayment('click', 'withdraw', payoutId, user_id, amount, 'completed', {
        card_number: card_number,
        status: 'success'
      });

      return true;
    } catch (error) {
      console.error('Error creating Click payout:', error);
      await this.logPayment('click', 'withdraw', null, user_id, amount, 'failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  // Валидация подписи Click
  private static validateSignature(data: ClickWebhookData): boolean {
    // В реальном приложении здесь будет валидация подписи
    // Сейчас просто возвращаем true для демонстрации
    return true;
  }

  // Логирование платежных операций
  private static async logPayment(
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
        });
    } catch (error) {
      console.error('Error logging payment:', error);
    }
  }

  // Получение настроек Click
  static async getSettings() {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('click_merchant_id, click_service_id, click_secret_key, click_webhook_url, click_enabled')
        .eq('is_active', true)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting Click settings:', error);
      return null;
    }
  }

  // Проверка статуса платежа
  static async checkPaymentStatus(merchant_trans_id: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('payment_logs')
        .select('status')
        .eq('transaction_id', merchant_trans_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      return data?.status || null;
    } catch (error) {
      console.error('Error checking payment status:', error);
      return null;
    }
  }
}
