import { supabase } from '@/integrations/supabase/client';

export interface CommissionLevel {
  id: string;
  name: string;
  min_turnover: number;
  max_turnover?: number;
  percent: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommissionCalculation {
  order_amount: number;
  commission_percent: number;
  commission_amount: number;
  net_amount: number;
  commission_source: 'custom' | 'subscription' | 'level' | 'global';
  applied_rule: string;
}

export interface PlatformSettings {
  global_commission_percent: number;
  commission_enabled: boolean;
  auto_trial_enabled: boolean;
  default_trial_subscription_id?: string;
  default_trial_days: number;
  fast_withdraw_commission: number;
  min_withdraw_amount: number;
  max_withdraw_amount: number;
}

export class CommissionService {
  // Calculate commission for user based on hybrid rules
  static async calculateCommission(
    userId: string,
    orderAmount: number
  ): Promise<CommissionCalculation> {
    try {
      // Get platform settings
      const settings = await this.getPlatformSettings();
      
      if (!settings.commission_enabled) {
        return {
          order_amount: orderAmount,
          commission_percent: 0,
          commission_amount: 0,
          net_amount: orderAmount,
          commission_source: 'global',
          applied_rule: 'Commission disabled'
        };
      }

      // Priority 1: Custom commission
      const customCommission = await this.getUserCustomCommission(userId);
      if (customCommission !== null) {
        const commissionAmount = orderAmount * (customCommission / 100);
        return {
          order_amount: orderAmount,
          commission_percent: customCommission,
          commission_amount: commissionAmount,
          net_amount: orderAmount - commissionAmount,
          commission_source: 'custom',
          applied_rule: `Custom commission: ${customCommission}%`
        };
      }

      // Priority 2: Active subscription
      const subscriptionCommission = await this.getUserSubscriptionCommission(userId);
      if (subscriptionCommission !== null) {
        const commissionAmount = orderAmount * (subscriptionCommission / 100);
        return {
          order_amount: orderAmount,
          commission_percent: subscriptionCommission,
          commission_amount: commissionAmount,
          net_amount: orderAmount - commissionAmount,
          commission_source: 'subscription',
          applied_rule: `Subscription commission: ${subscriptionCommission}%`
        };
      }

      // Priority 3: Commission level based on turnover
      const levelCommission = await this.getUserLevelCommission(userId);
      if (levelCommission !== null) {
        const commissionAmount = orderAmount * (levelCommission / 100);
        return {
          order_amount: orderAmount,
          commission_percent: levelCommission,
          commission_amount: commissionAmount,
          net_amount: orderAmount - commissionAmount,
          commission_source: 'level',
          applied_rule: `Level commission: ${levelCommission}%`
        };
      }

      // Priority 4: Global commission
      const commissionAmount = orderAmount * (settings.global_commission_percent / 100);
      return {
        order_amount: orderAmount,
        commission_percent: settings.global_commission_percent,
        commission_amount: commissionAmount,
        net_amount: orderAmount - commissionAmount,
        commission_source: 'global',
        applied_rule: `Global commission: ${settings.global_commission_percent}%`
      };
    } catch (error) {
      console.error('Error calculating commission:', error);
      // Return default global commission on error
      const settings = await this.getPlatformSettings();
      const commissionAmount = orderAmount * (settings.global_commission_percent / 100);
      return {
        order_amount: orderAmount,
        commission_percent: settings.global_commission_percent,
        commission_amount: commissionAmount,
        net_amount: orderAmount - commissionAmount,
        commission_source: 'global',
        applied_rule: 'Default global commission (error fallback)'
      };
    }
  }

  // Get user's custom commission
  static async getUserCustomCommission(userId: string): Promise<number | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('custom_commission_percent')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching user custom commission:', error);
        return null;
      }

      return (data as any)?.custom_commission_percent || null;
    } catch (error) {
      console.error('Error getting user custom commission:', error);
      return null;
    }
  }

  // Get user's subscription commission
  static async getUserSubscriptionCommission(userId: string): Promise<number | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          subscription_id,
          subscription_expires_at
        `)
        .eq('user_id', userId)
        .eq('subscription_expires_at', 'not.is', null)
        .gt('subscription_expires_at', new Date().toISOString())
        .single();

      if (error) {
        console.error('Error fetching user subscription commission:', error);
        return null;
      }

      // Get subscription details
      if ((data as any)?.subscription_id) {
        const { data: subscription, error: subError } = await supabase
          .from('subscriptions')
          .select('commission_percent')
          .eq('id', (data as any).subscription_id?.toString())
          .single();

        if (subError) {
          console.error('Error fetching subscription details:', subError);
          return null;
        }

        return (subscription as any)?.commission_percent || null;
      }

      return null;
    } catch (error) {
      console.error('Error getting user subscription commission:', error);
      return null;
    }
  }

  // Get user's level commission based on turnover
  static async getUserLevelCommission(userId: string): Promise<number | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          commission_level_id,
          commission_levels!inner(percent, is_active)
        `)
        .eq('user_id', userId)
        .eq('commission_levels.is_active', true)
        .single();

      if (error) {
        console.error('Error fetching user level commission:', error);
        return null;
      }

      return (data as any)?.commission_levels?.percent || null;
    } catch (error) {
      console.error('Error getting user level commission:', error);
      return null;
    }
  }

  // Update user's commission level based on turnover
  static async updateUserCommissionLevel(userId: string): Promise<void> {
    try {
      await supabase.rpc('update_user_commission_level', {
        p_user_id: userId
      } as any);
    } catch (error) {
      console.error('Error updating user commission level:', error);
    }
  }

  // Update user turnover (should be called when deal is completed)
  static async updateUserTurnover(userId: string): Promise<void> {
    try {
      await supabase.rpc('update_user_turnover', {
        p_user_id: userId
      } as any);
    } catch (error) {
      console.error('Error updating user turnover:', error);
    }
  }

  // Get all commission levels
  static async getCommissionLevels(): Promise<CommissionLevel[]> {
    try {
      const { data, error } = await supabase
        .from('commission_levels')
        .select('*')
        .eq('is_active', true)
        .order('min_turnover', { ascending: true });

      if (error) {
        console.error('Error fetching commission levels:', error);
        return [];
      }

      return (data as CommissionLevel[]) || [];
    } catch (error) {
      console.error('Error getting commission levels:', error);
      return [];
    }
  }

  // Create or update commission level (admin only)
  static async upsertCommissionLevel(
    level: Partial<CommissionLevel>
  ): Promise<CommissionLevel | null> {
    try {
      const { data, error } = await supabase
        .from('commission_levels')
        .upsert(level)
        .select()
        .single();

      if (error) {
        console.error('Error upserting commission level:', error);
        return null;
      }

      return data as CommissionLevel;
    } catch (error) {
      console.error('Error upserting commission level:', error);
      return null;
    }
  }

  // Delete commission level (admin only)
  static async deleteCommissionLevel(levelId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('commission_levels')
        .update({ is_active: false })
        .eq('id', levelId);

      if (error) {
        console.error('Error deleting commission level:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error deleting commission level:', error);
      return false;
    }
  }

  // Set custom commission for user (admin only)
  static async setUserCustomCommission(
    userId: string,
    commissionPercent: number | null
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          custom_commission_percent: commissionPercent
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error setting user custom commission:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error setting user custom commission:', error);
      return false;
    }
  }

  // Get platform settings
  static async getPlatformSettings(): Promise<PlatformSettings> {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('key, value')
        .in('key', [
          'global_commission_percent',
          'commission_enabled',
          'auto_trial_enabled',
          'default_trial_subscription_id',
          'default_trial_days',
          'fast_withdraw_commission',
          'min_withdraw_amount',
          'max_withdraw_amount'
        ]);

      if (error) {
        console.error('Error fetching platform settings:', error);
        return this.getDefaultSettings();
      }

      const settings: any = {};
      (data as any[])?.forEach((setting: any) => {
        settings[setting.key] = setting.value;
      });

      return {
        global_commission_percent: parseFloat(settings.global_commission_percent || '5.0'),
        commission_enabled: settings.commission_enabled === true || settings.commission_enabled === 'true',
        auto_trial_enabled: settings.auto_trial_enabled === true || settings.auto_trial_enabled === 'true',
        default_trial_subscription_id: settings.default_trial_subscription_id,
        default_trial_days: parseInt(settings.default_trial_days || '7'),
        fast_withdraw_commission: parseFloat(settings.fast_withdraw_commission || '2.0'),
        min_withdraw_amount: parseFloat(settings.min_withdraw_amount || '10.00'),
        max_withdraw_amount: parseFloat(settings.max_withdraw_amount || '10000.00')
      };
    } catch (error) {
      console.error('Error getting platform settings:', error);
      return this.getDefaultSettings();
    }
  }

  // Update platform setting (admin only)
  static async updatePlatformSetting(
    key: string,
    value: any
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('platform_settings')
        .upsert({
          key,
          value,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error updating platform setting:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating platform setting:', error);
      return false;
    }
  }

  // Get commission statistics
  static async getCommissionStats(
    period: 'week' | 'month' | 'year' = 'month'
  ): Promise<{
    total_commission: number;
    total_orders: number;
    average_commission: number;
    commission_by_source: Record<string, number>;
  }> {
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
        .eq('source', 'commission')
        .gte('created_at', startDate.toISOString());

      if (error) {
        console.error('Error fetching commission stats:', error);
        return {
          total_commission: 0,
          total_orders: 0,
          average_commission: 0,
          commission_by_source: {}
        };
      }

      const stats = {
        total_commission: 0,
        total_orders: 0,
        average_commission: 0,
        commission_by_source: {} as Record<string, number>
      };

      (data as any[])?.forEach((income: any) => {
        stats.total_commission += income.amount;
        stats.total_orders += 1;
      });

      stats.average_commission = stats.total_orders > 0 ? stats.total_commission / stats.total_orders : 0;

      return stats;
    } catch (error) {
      console.error('Error getting commission stats:', error);
      return {
        total_commission: 0,
        total_orders: 0,
        average_commission: 0,
        commission_by_source: {}
      };
    }
  }

  // Get default settings
  private static getDefaultSettings(): PlatformSettings {
    return {
      global_commission_percent: 5.0,
      commission_enabled: true,
      auto_trial_enabled: true,
      default_trial_subscription_id: undefined,
      default_trial_days: 7,
      fast_withdraw_commission: 2.0,
      min_withdraw_amount: 10.00,
      max_withdraw_amount: 10000.00
    };
  }

  // Calculate fast withdraw commission
  static calculateFastWithdrawCommission(amount: number): number {
    return amount * (2.0 / 100); // 2% default fast withdraw commission
  }

  // Validate commission percent
  static validateCommissionPercent(percent: number): boolean {
    return percent >= 0 && percent <= 100;
  }

  // Get commission calculation history for user
  static async getUserCommissionHistory(
    userId: string,
    limit: number = 20
  ): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          orders(id, cargo_type, pickup_address, delivery_address)
        `)
        .eq('user_id', userId)
        .eq('type', 'commission')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching user commission history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting user commission history:', error);
      return [];
    }
  }
}
