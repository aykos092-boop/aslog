import { supabase } from '@/integrations/supabase/client';

// Temporary types until Supabase types are regenerated
export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  related_order_id?: string;
  related_deal_id?: string;
  description?: string;
  metadata?: Record<string, any>;
  idempotency_key?: string;
  created_at: string;
  updated_at: string;
  confirmed_at?: string;
}

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAW = 'withdraw',
  FREEZE = 'freeze',
  RELEASE = 'release',
  COMMISSION = 'commission',
  SUBSCRIPTION_PAYMENT = 'subscription_payment',
  PROMOTION = 'promotion',
  FAST_WITHDRAW = 'fast_withdraw',
  REFUND = 'refund',
  BONUS = 'bonus'
}

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
  FAILED = 'failed'
}

export interface UserProfile {
  id: string;
  user_id: string;
  balance: number;
  frozen_balance: number;
  subscription_id?: string;
  subscription_expires_at?: string;
  trial_used: boolean;
  custom_commission_percent?: number;
  turnover_30_days: number;
  commission_level_id?: string;
}

export class WalletService {
  // Get user profile with wallet information
  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    return data as UserProfile;
  }

  // Create transaction with idempotency protection
  static async createTransaction(
    userId: string,
    type: TransactionType,
    amount: number,
    options: {
      related_order_id?: string;
      related_deal_id?: string;
      description?: string;
      metadata?: Record<string, any>;
      idempotency_key?: string;
    } = {}
  ): Promise<Transaction | null> {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          type,
          amount,
          status: TransactionStatus.PENDING,
          ...options
        })
        .select()
        .single();

      if (error) {
        // Check for idempotency key conflict
        if (error.code === '23505' && error.message.includes('idempotency_key')) {
          // Return existing transaction
          const { data: existingTx } = await supabase
            .from('transactions')
            .select('*')
            .eq('idempotency_key', options.idempotency_key)
            .single();
          return existingTx as Transaction;
        }
        throw error;
      }

      return data as Transaction;
    } catch (error) {
      console.error('Error creating transaction:', error);
      return null;
    }
  }

  // Confirm transaction
  static async confirmTransaction(
    transactionId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('confirm_transaction', {
        p_transaction_id: transactionId,
        p_user_id: userId
      } as any);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error confirming transaction:', error);
      return false;
    }
  }

  // Get user transactions
  static async getUserTransactions(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      type?: TransactionType;
      status?: TransactionStatus;
    } = {}
  ): Promise<Transaction[]> {
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options.type) {
      query = query.eq('type', options.type);
    }

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }

    return (data as Transaction[]) || [];
  }

  // Get transaction by ID
  static async getTransaction(transactionId: string): Promise<Transaction | null> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (error) {
      console.error('Error fetching transaction:', error);
      return null;
    }

    return data as Transaction;
  }

  // Deposit funds to user balance
  static async deposit(
    userId: string,
    amount: number,
    options: {
      description?: string;
      idempotency_key?: string;
    } = {}
  ): Promise<Transaction | null> {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const transaction = await this.createTransaction(
      userId,
      TransactionType.DEPOSIT,
      amount,
      {
        description: options.description || `Deposit of $${amount}`,
        idempotency_key: options.idempotency_key
      }
    );

    if (!transaction) return null;

    // Confirm transaction to update balance
    const confirmed = await this.confirmTransaction(transaction.id, userId);
    if (!confirmed) return null;

    return await this.getTransaction(transaction.id);
  }

  // Withdraw funds from user balance
  static async withdraw(
    userId: string,
    amount: number,
    options: {
      description?: string;
      idempotency_key?: string;
    } = {}
  ): Promise<Transaction | null> {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    // Check user balance
    const profile = await this.getUserProfile(userId);
    if (!profile || profile.balance < amount) {
      throw new Error('Insufficient balance');
    }

    const transaction = await this.createTransaction(
      userId,
      TransactionType.WITHDRAW,
      amount,
      {
        description: options.description || `Withdrawal of $${amount}`,
        idempotency_key: options.idempotency_key
      }
    );

    if (!transaction) return null;

    // Confirm transaction to update balance
    const confirmed = await this.confirmTransaction(transaction.id, userId);
    if (!confirmed) return null;

    return await this.getTransaction(transaction.id);
  }

  // Get user balance
  static async getBalance(userId: string): Promise<{
    balance: number;
    frozen_balance: number;
    available_balance: number;
  } | null> {
    const profile = await this.getUserProfile(userId);
    if (!profile) return null;

    return {
      balance: profile.balance,
      frozen_balance: profile.frozen_balance,
      available_balance: profile.balance - profile.frozen_balance
    };
  }

  // Get transaction statistics
  static async getTransactionStats(
    userId: string,
    period: 'week' | 'month' | 'year' = 'month'
  ): Promise<{
    total_deposits: number;
    total_withdrawals: number;
    total_commissions: number;
    net_amount: number;
    transaction_count: number;
  }> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default: // month
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const { data, error } = await supabase
      .from('transactions')
      .select('type, amount, status')
      .eq('user_id', userId)
      .eq('status', TransactionStatus.CONFIRMED)
      .gte('created_at', startDate.toISOString());

    if (error) {
      console.error('Error fetching transaction stats:', error);
      return {
        total_deposits: 0,
        total_withdrawals: 0,
        total_commissions: 0,
        net_amount: 0,
        transaction_count: 0
      };
    }

    const stats = {
      total_deposits: 0,
      total_withdrawals: 0,
      total_commissions: 0,
      net_amount: 0,
      transaction_count: data?.length || 0
    };

    (data as any[])?.forEach((tx: any) => {
      switch (tx.type) {
        case TransactionType.DEPOSIT:
        case TransactionType.BONUS:
          stats.total_deposits += tx.amount;
          break;
        case TransactionType.WITHDRAW:
          stats.total_withdrawals += tx.amount;
          break;
        case TransactionType.COMMISSION:
          stats.total_commissions += tx.amount;
          break;
      }
    });

    stats.net_amount = stats.total_deposits - stats.total_withdrawals - stats.total_commissions;

    return stats;
  }

  // Check if transaction exists with idempotency key
  static async getTransactionByIdempotencyKey(
    idempotencyKey: string
  ): Promise<Transaction | null> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error('Error fetching transaction by idempotency key:', error);
      return null;
    }

    return data as Transaction;
  }
}
