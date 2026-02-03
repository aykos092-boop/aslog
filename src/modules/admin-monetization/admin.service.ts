import { supabase } from '@/integrations/supabase/client';
import { CommissionService } from '@/modules/commission/commission.service';
import { SubscriptionService } from '@/modules/subscriptions/subscriptions.service';
import { WalletService } from '@/modules/wallet/wallet.service';

export interface AdminStats {
  total_users: number;
  active_subscriptions: number;
  trial_users: number;
  total_revenue: number;
  monthly_revenue: number;
  total_transactions: number;
  frozen_funds: number;
  commission_this_month: number;
}

export interface UserMonetizationInfo {
  user_id: string;
  email?: string;
  full_name?: string;
  balance: number;
  frozen_balance: number;
  subscription?: any;
  custom_commission_percent?: number;
  commission_level?: any;
  turnover_30_days: number;
  trial_used: boolean;
  created_at: string;
}

export interface PlatformIncomeReport {
  source: string;
  amount: number;
  count: number;
  percentage: number;
}

export class AdminMonetizationService {
  // Get comprehensive monetization statistics
  static async getMonetizationStats(): Promise<AdminStats> {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get user stats
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, balance, frozen_balance, trial_used, subscription_expires_at, created_at');

      // Get revenue stats
      const { data: income, error: incomeError } = await supabase
        .from('platform_income')
        .select('source, amount, created_at');

      // Get transaction stats
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('amount, status, created_at');

      // Get escrow stats
      const { data: escrow, error: escrowError } = await supabase
        .from('escrow_operations')
        .select('amount, status');

      const stats: AdminStats = {
        total_users: 0,
        active_subscriptions: 0,
        trial_users: 0,
        total_revenue: 0,
        monthly_revenue: 0,
        total_transactions: 0,
        frozen_funds: 0,
        commission_this_month: 0
      };

      // Process profiles
      if (!profilesError && profiles) {
        stats.total_users = profiles.length;
        
        (profiles as any[])?.forEach((profile: any) => {
          stats.frozen_funds += profile.frozen_balance || 0;
          
          if (profile.subscription_expires_at && new Date(profile.subscription_expires_at) > now) {
            stats.active_subscriptions += 1;
          }
          
          if (!profile.trial_used) {
            stats.trial_users += 1;
          }
        });
      }

      // Process income
      if (!incomeError && income) {
        (income as any[])?.forEach((item: any) => {
          stats.total_revenue += item.amount;
          
          if (new Date(item.created_at) >= monthStart) {
            stats.monthly_revenue += item.amount;
          }
        });
      }

      // Process transactions
      if (!txError && transactions) {
        stats.total_transactions = (transactions as any[])?.filter(
          (tx: any) => tx.status === 'confirmed'
        ).length || 0;
      }

      // Process commission
      if (!incomeError && income) {
        (income as any[])?.forEach((item: any) => {
          if (item.source === 'commission' && new Date(item.created_at) >= monthStart) {
            stats.commission_this_month += item.amount;
          }
        });
      }

      return stats;
    } catch (error) {
      console.error('Error getting monetization stats:', error);
      return {
        total_users: 0,
        active_subscriptions: 0,
        trial_users: 0,
        total_revenue: 0,
        monthly_revenue: 0,
        total_transactions: 0,
        frozen_funds: 0,
        commission_this_month: 0
      };
    }
  }

  // Get users with monetization info
  static async getUsersMonetizationInfo(
    options: {
      limit?: number;
      offset?: number;
      search?: string;
      hasSubscription?: boolean;
      hasCustomCommission?: boolean;
    } = {}
  ): Promise<UserMonetizationInfo[]> {
    try {
      let query = supabase
        .from('profiles')
        .select(`
          user_id,
          balance,
          frozen_balance,
          custom_commission_percent,
          turnover_30_days,
          trial_used,
          subscription_id,
          subscription_expires_at,
          commission_level_id,
          created_at,
          commission_levels!inner(name, percent, is_active),
          subscriptions!inner(name, commission_percent, trial_days)
        `)
        .order('created_at', { ascending: false });

      if (options.search) {
        query = query.ilike('full_name', `%${options.search}%`);
      }

      if (options.hasSubscription) {
        query = query.not('subscription_id', 'is', null);
      }

      if (options.hasCustomCommission) {
        query = query.not('custom_commission_percent', 'is', null);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching users monetization info:', error);
        return [];
      }

      return (data as UserMonetizationInfo[]) || [];
    } catch (error) {
      console.error('Error getting users monetization info:', error);
      return [];
    }
  }

  // Get platform income breakdown
  static async getPlatformIncomeReport(
    period: 'week' | 'month' | 'year' = 'month'
  ): Promise<PlatformIncomeReport[]> {
    try {
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
        .from('platform_income')
        .select('source, amount')
        .gte('created_at', startDate.toISOString());

      if (error) {
        console.error('Error fetching platform income report:', error);
        return [];
      }

      const report: Record<string, { amount: number; count: number }> = {};

      (data as any[])?.forEach((item: any) => {
        if (!report[item.source]) {
          report[item.source] = { amount: 0, count: 0 };
        }
        report[item.source].amount += item.amount;
        report[item.source].count += 1;
      });

      const totalAmount = Object.values(report).reduce((sum, item) => sum + item.amount, 0);

      return Object.entries(report).map(([source, data]) => ({
        source,
        amount: data.amount,
        count: data.count,
        percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0
      }));
    } catch (error) {
      console.error('Error getting platform income report:', error);
      return [];
    }
  }

  // Update global commission
  static async updateGlobalCommission(percent: number): Promise<boolean> {
    try {
      if (!CommissionService.validateCommissionPercent(percent)) {
        throw new Error('Invalid commission percent');
      }

      return await CommissionService.updatePlatformSetting('global_commission_percent', percent);
    } catch (error) {
      console.error('Error updating global commission:', error);
      return false;
    }
  }

  // Toggle commission system
  static async toggleCommissionSystem(enabled: boolean): Promise<boolean> {
    try {
      return await CommissionService.updatePlatformSetting('commission_enabled', enabled);
    } catch (error) {
      console.error('Error toggling commission system:', error);
      return false;
    }
  }

  // Set custom commission for user
  static async setUserCustomCommission(
    userId: string,
    commissionPercent: number | null
  ): Promise<boolean> {
    try {
      if (commissionPercent !== null && !CommissionService.validateCommissionPercent(commissionPercent)) {
        throw new Error('Invalid commission percent');
      }

      return await CommissionService.setUserCustomCommission(userId, commissionPercent);
    } catch (error) {
      console.error('Error setting user custom commission:', error);
      return false;
    }
  }

  // Grant free subscription to user
  static async grantFreeSubscription(
    userId: string,
    subscriptionId: string,
    months: number = 1
  ): Promise<boolean> {
    try {
      const result = await SubscriptionService.grantFreeSubscription(userId, subscriptionId, months);
      return result !== null;
    } catch (error) {
      console.error('Error granting free subscription:', error);
      return false;
    }
  }

  // Mass grant trial subscriptions
  static async massGrantTrial(
    userIds: string[],
    subscriptionId?: string,
    days?: number
  ): Promise<{ success: string[]; failed: string[] }> {
    const result = { success: [], failed: [] } as { success: string[]; failed: string[] };

    for (const userId of userIds) {
      try {
        const trialResult = await SubscriptionService.startTrial({
          user_id: userId,
          subscription_id: subscriptionId,
          days: days
        });

        if (trialResult) {
          result.success.push(userId);
        } else {
          result.failed.push(userId);
        }
      } catch (error) {
        result.failed.push(userId);
      }
    }

    return result;
  }

  // Create or update commission level
  static async upsertCommissionLevel(
    level: {
      id?: string;
      name: string;
      min_turnover: number;
      max_turnover?: number;
      percent: number;
      is_active?: boolean;
    }
  ): Promise<boolean> {
    try {
      if (!CommissionService.validateCommissionPercent(level.percent)) {
        throw new Error('Invalid commission percent');
      }

      const result = await CommissionService.upsertCommissionLevel(level);
      return result !== null;
    } catch (error) {
      console.error('Error upserting commission level:', error);
      return false;
    }
  }

  // Create or update subscription
  static async upsertSubscription(
    subscription: {
      id?: string;
      name: string;
      monthly_price: number;
      commission_percent: number;
      features: Record<string, any>;
      trial_days?: number;
      trial_enabled?: boolean;
      is_active?: boolean;
    }
  ): Promise<boolean> {
    try {
      if (!CommissionService.validateCommissionPercent(subscription.commission_percent)) {
        throw new Error('Invalid commission percent');
      }

      const result = await SubscriptionService.upsertSubscription(subscription);
      return result !== null;
    } catch (error) {
      console.error('Error upserting subscription:', error);
      return false;
    }
  }

  // Add balance to user (admin operation)
  static async addUserBalance(
    userId: string,
    amount: number,
    description?: string
  ): Promise<boolean> {
    try {
      if (amount <= 0) {
        throw new Error('Amount must be positive');
      }

      const transaction = await WalletService.deposit(userId, amount, {
        description: description || `Admin balance addition: $${amount}`
      });

      if (transaction) {
        // Add metadata separately if needed
        console.log(`Admin balance addition for user ${userId}: $${amount}`);
      }

      return transaction !== null;
    } catch (error) {
      console.error('Error adding user balance:', error);
      return false;
    }
  }

  // Get admin action logs
  static async getAdminLogs(
    options: {
      limit?: number;
      offset?: number;
      adminId?: string;
      action?: string;
      period?: 'week' | 'month' | 'year';
    } = {}
  ): Promise<any[]> {
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .eq('action_category', 'monetization')
        .order('created_at', { ascending: false });

      if (options.adminId) {
        query = query.eq('user_id', options.adminId);
      }

      if (options.action) {
        query = query.eq('action', options.action);
      }

      if (options.period) {
        const now = new Date();
        let startDate: Date;

        switch (options.period) {
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'year':
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
          default: // month
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        query = query.gte('created_at', startDate.toISOString());
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching admin logs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting admin logs:', error);
      return [];
    }
  }

  // Get revenue chart data
  static async getRevenueChartData(
    period: 'week' | 'month' | 'year' = 'month'
  ): Promise<Array<{ date: string; revenue: number; commission: number; subscriptions: number }>> {
    try {
      const now = new Date();
      let startDate: Date;
      let groupBy: string;

      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          groupBy = 'day';
          break;
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          groupBy = 'month';
          break;
        default: // month
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          groupBy = 'day';
      }

      const { data, error } = await supabase
        .from('platform_income')
        .select('source, amount, created_at')
        .gte('created_at', startDate.toISOString());

      if (error) {
        console.error('Error fetching revenue chart data:', error);
        return [];
      }

      // Group by date
      const groupedData: Record<string, { revenue: number; commission: number; subscriptions: number }> = {};

      (data as any[])?.forEach((item: any) => {
        const date = new Date(item.created_at).toISOString().split('T')[0];
        
        if (!groupedData[date]) {
          groupedData[date] = { revenue: 0, commission: 0, subscriptions: 0 };
        }

        groupedData[date].revenue += item.amount;

        switch (item.source) {
          case 'commission':
            groupedData[date].commission += item.amount;
            break;
          case 'subscription':
            groupedData[date].subscriptions += item.amount;
            break;
        }
      });

      return Object.entries(groupedData).map(([date, data]) => ({
        date,
        revenue: data.revenue,
        commission: data.commission,
        subscriptions: data.subscriptions
      }));
    } catch (error) {
      console.error('Error getting revenue chart data:', error);
      return [];
    }
  }

  // Export user data (CSV)
  static async exportUserData(format: 'csv' | 'json' = 'csv'): Promise<string> {
    try {
      const users = await this.getUsersMonetizationInfo({ limit: 10000 });

      if (format === 'json') {
        return JSON.stringify(users, null, 2);
      }

      // CSV format
      const headers = [
        'User ID',
        'Balance',
        'Frozen Balance',
        'Custom Commission %',
        'Turnover 30 Days',
        'Trial Used',
        'Subscription',
        'Commission Level',
        'Created At'
      ];

      const rows = users.map(user => [
        user.user_id,
        user.balance.toString(),
        user.frozen_balance.toString(),
        user.custom_commission_percent?.toString() || '',
        user.turnover_30_days.toString(),
        user.trial_used.toString(),
        user.subscription?.name || '',
        user.commission_level?.name || '',
        user.created_at
      ]);

      return [headers, ...rows].map(row => row.join(',')).join('\n');
    } catch (error) {
      console.error('Error exporting user data:', error);
      return '';
    }
  }

  // Get system health metrics
  static async getSystemHealth(): Promise<{
    database_status: 'healthy' | 'degraded' | 'down';
    last_transaction: string | null;
    total_balance: number;
    pending_escrow: number;
    error_rate: number;
  }> {
    try {
      // Check database connectivity
      const { data, error } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);

      const dbStatus = error ? 'down' : 'healthy';

      // Get last transaction
      const { data: lastTx } = await supabase
        .from('transactions')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      // Get total balance
      const { data: balanceData } = await supabase
        .from('profiles')
        .select('balance');

      const totalBalance = (balanceData as any[])?.reduce((sum, profile) => sum + (profile.balance || 0), 0) || 0;

      // Get pending escrow
      const { data: escrowData } = await supabase
        .from('escrow_operations')
        .select('amount')
        .eq('status', 'frozen');

      const pendingEscrow = (escrowData as any[])?.reduce((sum, op) => sum + (op.amount || 0), 0) || 0;

      return {
        database_status: dbStatus,
        last_transaction: (lastTx as any[])?.[0]?.created_at || null,
        total_balance: totalBalance,
        pending_escrow: pendingEscrow,
        error_rate: 0 // TODO: Implement error rate calculation
      };
    } catch (error) {
      console.error('Error getting system health:', error);
      return {
        database_status: 'down',
        last_transaction: null,
        total_balance: 0,
        pending_escrow: 0,
        error_rate: 100
      };
    }
  }
}
