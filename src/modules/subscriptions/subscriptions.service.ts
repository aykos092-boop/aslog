import { supabase } from '@/integrations/supabase/client';
import { WalletService, TransactionType, TransactionStatus } from '@/modules/wallet/wallet.service';

export interface Subscription {
  id: string;
  name: string;
  monthly_price: number;
  commission_percent: number;
  features: Record<string, any>;
  is_active: boolean;
  trial_days: number;
  trial_enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  subscription_id: string;
  status: 'active' | 'cancelled' | 'expired' | 'trial';
  trial_used: boolean;
  trial_ends_at?: string;
  subscription_expires_at?: string;
  auto_renew: boolean;
  created_at: string;
  updated_at: string;
  subscription?: Subscription;
}

export interface TrialRequest {
  user_id: string;
  subscription_id?: string;
  days?: number;
}

export class SubscriptionService {
  // Get all active subscriptions
  static async getActiveSubscriptions(): Promise<Subscription[]> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Error fetching active subscriptions:', error);
        return [];
      }

      return (data as Subscription[]) || [];
    } catch (error) {
      console.error('Error getting active subscriptions:', error);
      return [];
    }
  }

  // Get subscription by ID
  static async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('Error fetching subscription:', error);
        return null;
      }

      return data as Subscription;
    } catch (error) {
      console.error('Error getting subscription:', error);
      return null;
    }
  }

  // Get user's current subscription
  static async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          subscription_id,
          subscription_expires_at,
          trial_used
        `)
        .eq('user_id', userId)
        .eq('subscription_expires_at', 'not.is', null)
        .gt('subscription_expires_at', new Date().toISOString())
        .single();

      if (error) {
        console.error('Error fetching user subscription:', error);
        return null;
      }

      const profile = data as any;
      if (!profile?.subscription_id) return null;

      // Get subscription details
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('id', profile.subscription_id?.toString())
        .eq('is_active', true)
        .single();

      if (subError) {
        console.error('Error fetching subscription details:', subError);
        return null;
      }

      const now = new Date();
      const expiresAt = new Date(profile.subscription_expires_at);
      const isTrial = !profile.trial_used && profile.subscription_expires_at && 
                     (expiresAt.getTime() - now.getTime()) <= ((subscription as any).trial_days * 24 * 60 * 60 * 1000);

      return {
        id: profile.subscription_id,
        user_id: userId,
        subscription_id: profile.subscription_id,
        status: isTrial ? 'trial' : 'active',
        trial_used: profile.trial_used,
        trial_ends_at: isTrial ? profile.subscription_expires_at : undefined,
        subscription_expires_at: profile.subscription_expires_at,
        auto_renew: true, // Default to true
        created_at: profile.subscription_expires_at, // Approximate
        updated_at: profile.subscription_expires_at,
        subscription: subscription as Subscription
      };
    } catch (error) {
      console.error('Error getting user subscription:', error);
      return null;
    }
  }

  // Start trial subscription
  static async startTrial(request: TrialRequest): Promise<UserSubscription | null> {
    try {
      // Check if user already used trial
      const userProfile = await this.getUserProfile(request.user_id);
      if (userProfile?.trial_used) {
        throw new Error('Trial already used');
      }

      // Get platform settings
      const settings = await this.getPlatformSettings();
      if (!settings.auto_trial_enabled) {
        throw new Error('Auto trial is disabled');
      }

      // Get subscription for trial
      const subscriptionId = request.subscription_id || settings.default_trial_subscription_id;
      if (!subscriptionId) {
        throw new Error('No trial subscription available');
      }

      const subscription = await this.getSubscription(subscriptionId);
      if (!subscription || !subscription.trial_enabled) {
        throw new Error('Trial not available for this subscription');
      }

      const trialDays = request.days || subscription.trial_days || settings.default_trial_days;
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

      // Update user profile with trial
      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_id: subscriptionId,
          subscription_expires_at: trialEndsAt.toISOString(),
          trial_used: true
        })
        .eq('user_id', request.user_id);

      if (error) {
        console.error('Error starting trial:', error);
        throw error;
      }

      // Record trial transaction
      await WalletService.createTransaction(
        request.user_id,
        TransactionType.BONUS,
        0,
        {
          description: `Trial subscription: ${subscription.name}`,
          metadata: {
            operation: 'trial_start',
            subscription_id: subscriptionId,
            trial_days: trialDays,
            trial_ends_at: trialEndsAt.toISOString()
          }
        }
      );

      // Return user subscription
      return await this.getUserSubscription(request.user_id);
    } catch (error) {
      console.error('Error starting trial:', error);
      return null;
    }
  }

  // Purchase subscription
  static async purchaseSubscription(
    userId: string,
    subscriptionId: string,
    months: number = 1
  ): Promise<UserSubscription | null> {
    try {
      const subscription = await this.getSubscription(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const totalPrice = subscription.monthly_price * months;

      // Check user balance
      const balance = await WalletService.getBalance(userId);
      if (!balance || balance.balance < totalPrice) {
        throw new Error('Insufficient balance');
      }

      // Calculate new expiration date
      const userSub = await this.getUserSubscription(userId);
      const now = new Date();
      let expiresAt: Date;

      if (userSub && userSub.subscription_expires_at) {
        // Extend existing subscription
        expiresAt = new Date(userSub.subscription_expires_at);
        if (expiresAt < now) {
          expiresAt = now; // Start from now if expired
        }
      } else {
        expiresAt = now; // Start from now
      }

      expiresAt.setMonth(expiresAt.getMonth() + months);

      // Create payment transaction
      const paymentTransaction = await WalletService.createTransaction(
        userId,
        TransactionType.SUBSCRIPTION_PAYMENT,
        totalPrice,
        {
          description: `Subscription: ${subscription.name} (${months} months)`,
          metadata: {
            operation: 'subscription_purchase',
            subscription_id: subscriptionId,
            months: months,
            unit_price: subscription.monthly_price,
            total_price: totalPrice
          }
        }
      );

      if (!paymentTransaction) {
        throw new Error('Failed to create payment transaction');
      }

      // Confirm payment
      const confirmed = await WalletService.confirmTransaction(
        paymentTransaction.id,
        userId
      );

      if (!confirmed) {
        throw new Error('Failed to confirm payment');
      }

      // Update user subscription
      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_id: subscriptionId,
          subscription_expires_at: expiresAt.toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating subscription:', error);
        throw error;
      }

      // Record platform income
      await this.recordPlatformIncome({
        source: 'subscription',
        amount: totalPrice,
        related_user_id: userId,
        description: `Subscription payment: ${subscription.name} (${months} months)`
      });

      return await this.getUserSubscription(userId);
    } catch (error) {
      console.error('Error purchasing subscription:', error);
      return null;
    }
  }

  // Cancel subscription
  static async cancelSubscription(userId: string): Promise<boolean> {
    try {
      const userSub = await this.getUserSubscription(userId);
      if (!userSub) {
        throw new Error('No active subscription found');
      }

      // Set auto_renew to false (subscription will expire naturally)
      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_expires_at: new Date().toISOString() // Expire immediately
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error cancelling subscription:', error);
        return false;
      }

      // Record cancellation
      await WalletService.createTransaction(
        userId,
        TransactionType.BONUS,
        0,
        {
          description: `Subscription cancelled: ${userSub.subscription?.name}`,
          metadata: {
            operation: 'subscription_cancellation',
            subscription_id: userSub.subscription_id,
            cancelled_at: new Date().toISOString()
          }
        }
      );

      return true;
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      return false;
    }
  }

  // Check if user has active subscription
  static async hasActiveSubscription(userId: string): Promise<boolean> {
    const userSub = await this.getUserSubscription(userId);
    return userSub !== null && userSub.status === 'active';
  }

  // Get user subscription benefits
  static async getUserBenefits(userId: string): Promise<Record<string, any>> {
    const userSub = await this.getUserSubscription(userId);
    
    if (!userSub || !userSub.subscription) {
      return {};
    }

    return {
      commission_percent: userSub.subscription.commission_percent,
      features: userSub.subscription.features,
      status: userSub.status,
      expires_at: userSub.subscription_expires_at,
      trial_ends_at: userSub.trial_ends_at
    };
  }

  // Create or update subscription (admin only)
  static async upsertSubscription(
    subscription: Partial<Subscription>
  ): Promise<Subscription | null> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .upsert(subscription)
        .select()
        .single();

      if (error) {
        console.error('Error upserting subscription:', error);
        return null;
      }

      return data as Subscription;
    } catch (error) {
      console.error('Error upserting subscription:', error);
      return null;
    }
  }

  // Delete subscription (admin only)
  static async deleteSubscription(subscriptionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ is_active: false })
        .eq('id', subscriptionId);

      if (error) {
        console.error('Error deleting subscription:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error deleting subscription:', error);
      return false;
    }
  }

  // Grant free subscription (admin only)
  static async grantFreeSubscription(
    userId: string,
    subscriptionId: string,
    months: number = 1
  ): Promise<UserSubscription | null> {
    try {
      const subscription = await this.getSubscription(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + months);

      // Update user subscription
      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_id: subscriptionId,
          subscription_expires_at: expiresAt.toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error granting free subscription:', error);
        throw error;
      }

      // Record grant
      await WalletService.createTransaction(
        userId,
        TransactionType.BONUS,
        0,
        {
          description: `Free subscription granted: ${subscription.name} (${months} months)`,
          metadata: {
            operation: 'free_subscription_grant',
            subscription_id: subscriptionId,
            months: months,
            granted_by: 'admin',
            granted_at: now.toISOString()
          }
        }
      );

      return await this.getUserSubscription(userId);
    } catch (error) {
      console.error('Error granting free subscription:', error);
      return null;
    }
  }

  // Get subscription statistics
  static async getSubscriptionStats(): Promise<{
    total_active: number;
    total_trial: number;
    total_expired: number;
    revenue_this_month: number;
    subscriptions_by_type: Record<string, number>;
  }> {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get active subscriptions from profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          subscription_id,
          subscription_expires_at,
          trial_used,
          subscriptions!inner(name)
        `)
        .not('subscription_id', 'is', null);

      if (profilesError) {
        console.error('Error fetching subscription stats:', profilesError);
        return {
          total_active: 0,
          total_trial: 0,
          total_expired: 0,
          revenue_this_month: 0,
          subscriptions_by_type: {}
        };
      }

      const stats = {
        total_active: 0,
        total_trial: 0,
        total_expired: 0,
        revenue_this_month: 0,
        subscriptions_by_type: {} as Record<string, number>
      };

      (profiles as any[])?.forEach((profile: any) => {
        const expiresAt = new Date(profile.subscription_expires_at);
        const isActive = expiresAt > now;
        const isTrial = !profile.trial_used && 
                       (expiresAt.getTime() - now.getTime()) <= (profile.subscriptions.trial_days * 24 * 60 * 60 * 1000);

        if (isActive) {
          stats.total_active += 1;
          if (isTrial) {
            stats.total_trial += 1;
          }
        } else {
          stats.total_expired += 1;
        }

        const subName = profile.subscriptions.name;
        stats.subscriptions_by_type[subName] = (stats.subscriptions_by_type[subName] || 0) + 1;
      });

      // Get revenue from platform_income
      const { data: income, error: incomeError } = await supabase
        .from('platform_income')
        .select('amount')
        .eq('source', 'subscription')
        .gte('created_at', monthStart.toISOString());

      if (!incomeError) {
        (income as any[])?.forEach((item: any) => {
          stats.revenue_this_month += item.amount;
        });
      }

      return stats;
    } catch (error) {
      console.error('Error getting subscription stats:', error);
      return {
        total_active: 0,
        total_trial: 0,
        total_expired: 0,
        revenue_this_month: 0,
        subscriptions_by_type: {}
      };
    }
  }

  // Helper methods
  private static async getUserProfile(userId: string): Promise<any> {
    const { data, error } = await supabase
      .from('profiles')
      .select('trial_used, subscription_id, subscription_expires_at')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    return data;
  }

  private static async getPlatformSettings(): Promise<any> {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', ['auto_trial_enabled', 'default_trial_subscription_id', 'default_trial_days']);

    if (error) {
      console.error('Error fetching platform settings:', error);
      return {
        auto_trial_enabled: true,
        default_trial_subscription_id: null,
        default_trial_days: 7
      };
    }

    const settings: any = {};
    (data as any[])?.forEach((setting: any) => {
      settings[setting.key] = setting.value;
    });

    return {
      auto_trial_enabled: settings.auto_trial_enabled === true || settings.auto_trial_enabled === 'true',
      default_trial_subscription_id: settings.default_trial_subscription_id,
      default_trial_days: parseInt(settings.default_trial_days || '7')
    };
  }

  private static async recordPlatformIncome(income: {
    source: string;
    amount: number;
    related_user_id?: string;
    description?: string;
  }): Promise<void> {
    try {
      const { error } = await supabase
        .from('platform_income')
        .insert({
          source: income.source,
          amount: income.amount,
          related_user_id: income.related_user_id,
          description: income.description,
          metadata: { recorded_at: new Date().toISOString() }
        });

      if (error) {
        console.error('Error recording platform income:', error);
      }
    } catch (error) {
      console.error('Error recording platform income:', error);
    }
  }
}
