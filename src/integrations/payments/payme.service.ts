import { supabase } from '@/integrations/supabase/client';

export interface PaymePaymentRequest {
  amount: number;
  user_id: string;
  description: string;
  return_url?: string;
}

export interface PaymePaymentResponse {
  payment_url: string;
  payment_id: string;
  created_at: string;
}

export interface PaymeWebhookData {
  id: number;
  time: number;
  amount: number;
  account: {
    user_id: string;
  };
  create_time: number;
  perform_time: number;
  cancel_time: number;
  transaction: string;
  state: number;
  reason: number;
  receivers: any[];
}

export class PaymeService {
  private static readonly MERCHANT_ID = 'swiftship';
  private static readonly SECRET_KEY = 'your-payme-secret-key'; // В реальном приложении должно быть в env

  // Создание платежа через Payme
  static async createPayment(request: PaymePaymentRequest): Promise<PaymePaymentResponse | null> {
    try {
      const paymentId = `payme_${Date.now()}_${request.user_id}`;
      
      // Логируем создание платежа
      await this.logPayment('payme', 'deposit', paymentId, request.user_id, request.amount, 'pending', {
        description: request.description
      });

      // В реальном приложении здесь будет API вызов к Payme
      // Сейчас симулируем ответ
      const paymentUrl = `https://checkout.paycom.uz/${this.MERCHANT_ID}/${paymentId}`;
      
      const response: PaymePaymentResponse = {
        payment_url: paymentUrl,
        payment_id: paymentId,
        created_at: new Date().toISOString()
      };

      // Обновляем лог
      await this.logPayment('payme', 'deposit', paymentId, request.user_id, request.amount, 'created', response);

      return response;
    } catch (error) {
      console.error('Error creating Payme payment:', error);
      await this.logPayment('payme', 'deposit', null, request.user_id, request.amount, 'failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  // Обработка вебхука от Payme
  static async handleWebhook(webhookData: PaymeWebhookData): Promise<any> {
    try {
      const { transaction, amount, account, state } = webhookData;

      // Ищем лог платежа
      const { data: paymentLog } = await supabase
        .from('payment_logs')
        .select('*')
        .eq('transaction_id', transaction)
        .single();

      if (!paymentLog) {
        return {
          error: {
            code: -32603,
            message: {
              ru: 'Транзакция не найдена',
              uz: 'Tranzaksiya topilmadi',
              en: 'Transaction not found'
            }
          }
        };
      }

      // Обрабатываем разные статусы
      switch (state) {
        case 1: // Создан, ожидает оплаты
          await this.logPayment('payme', 'webhook', transaction, account.user_id, amount, 'created', webhookData);
          return { result: { transaction, state: 1 } };

        case 2: // Успешно выполнен
          // Пополняем баланс пользователя
          const { error: balanceError } = await supabase.rpc('add_user_balance', {
            p_user_id: account.user_id,
            p_amount: amount
          });

          if (balanceError) {
            console.error('Error adding balance:', balanceError);
            return {
              error: {
                code: -32603,
                message: {
                  ru: 'Ошибка пополнения баланса',
                  uz: 'Balansni to\'ldirishda xatolik',
                  en: 'Balance update error'
                }
              }
            };
          }

          // Обновляем статус платежа
          await this.logPayment('payme', 'webhook', transaction, account.user_id, amount, 'completed', webhookData);
          return { result: { transaction, state: 2, perform_time: Date.now() } };

        case -1: // Отменен
        case -2: // Просрочен
          await this.logPayment('payme', 'webhook', transaction, account.user_id, amount, 'cancelled', webhookData);
          return { result: { transaction, state, cancel_time: Date.now() } };

        default:
          return {
            error: {
              code: -32603,
              message: {
                ru: 'Неизвестный статус транзакции',
                uz: 'Noma\'lum tranzaksiya statusi',
                en: 'Unknown transaction state'
              }
            }
          };
      }
    } catch (error) {
      console.error('Error handling Payme webhook:', error);
      return {
        error: {
          code: -32603,
          message: {
            ru: 'Внутренняя ошибка сервера',
            uz: 'Server ichki xatoligi',
            en: 'Internal server error'
          }
        }
      };
    }
  }

  // Создание выплаты на карту через Payme
  static async createPayout(user_id: string, amount: number, card_number: string): Promise<boolean> {
    try {
      const payoutId = `payout_payme_${Date.now()}_${user_id}`;
      
      await this.logPayment('payme', 'withdraw', payoutId, user_id, amount, 'pending', {
        card_number: card_number
      });

      // В реальном приложении здесь будет API вызов к Payme для выплаты
      // Сейчас симулируем успешную выплату
      await this.logPayment('payme', 'withdraw', payoutId, user_id, amount, 'completed', {
        card_number: card_number,
        status: 'success'
      });

      return true;
    } catch (error) {
      console.error('Error creating Payme payout:', error);
      await this.logPayment('payme', 'withdraw', null, user_id, amount, 'failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
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

  // Получение настроек Payme
  static async getSettings() {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('payme_merchant_id, payme_secret_key, payme_webhook_url, payme_enabled')
        .eq('is_active', true)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting Payme settings:', error);
      return null;
    }
  }

  // Проверка статуса платежа
  static async checkPaymentStatus(transaction_id: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('payment_logs')
        .select('status')
        .eq('transaction_id', transaction_id)
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
