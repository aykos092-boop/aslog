import { supabase } from '@/integrations/supabase/client';
import { WalletService, TransactionType, TransactionStatus } from '@/modules/wallet/wallet.service';

export interface EscrowOperation {
  id: string;
  order_id: string;
  client_id: string;
  carrier_id: string;
  amount: number;
  status: 'frozen' | 'released' | 'refunded';
  frozen_at: string;
  released_at?: string;
  refunded_at?: string;
  related_deal_id?: string;
  metadata?: Record<string, any>;
}

export interface FreezeRequest {
  order_id: string;
  client_id: string;
  amount: number;
  description?: string;
  idempotency_key?: string;
}

export interface ReleaseRequest {
  order_id: string;
  carrier_id: string;
  amount: number;
  commission_amount: number;
  description?: string;
  idempotency_key?: string;
}

export class EscrowService {
  // Freeze funds when order is created/accepted
  static async freezeFunds(request: FreezeRequest): Promise<EscrowOperation | null> {
    try {
      // Check if user has sufficient balance
      const canAfford = await this.checkUserCanAfford(request.client_id, request.amount);
      if (!canAfford) {
        throw new Error('Insufficient balance for escrow freeze');
      }

      // Create freeze transaction
      const freezeTransaction = await WalletService.createTransaction(
        request.client_id,
        TransactionType.FREEZE,
        request.amount,
        {
          related_order_id: request.order_id,
          description: request.description || `Escrow freeze for order ${request.order_id}`,
          idempotency_key: request.idempotency_key,
          metadata: { operation: 'escrow_freeze' }
        }
      );

      if (!freezeTransaction) {
        throw new Error('Failed to create freeze transaction');
      }

      // Confirm freeze transaction
      const confirmed = await WalletService.confirmTransaction(
        freezeTransaction.id,
        request.client_id
      );

      if (!confirmed) {
        throw new Error('Failed to confirm freeze transaction');
      }

      // Create escrow operation record
      const { data: escrowOp, error } = await supabase
        .from('escrow_operations')
        .insert({
          order_id: request.order_id,
          client_id: request.client_id,
          amount: request.amount,
          status: 'frozen',
          frozen_at: new Date().toISOString(),
          metadata: { transaction_id: freezeTransaction.id }
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating escrow operation:', error);
        throw error;
      }

      return escrowOp as EscrowOperation;
    } catch (error) {
      console.error('Error freezing funds:', error);
      return null;
    }
  }

  // Release funds to carrier after delivery confirmation
  static async releaseFunds(request: ReleaseRequest): Promise<EscrowOperation | null> {
    try {
      // Get escrow operation
      const escrowOp = await this.getEscrowOperation(request.order_id);
      if (!escrowOp) {
        throw new Error('Escrow operation not found');
      }

      if (escrowOp.status !== 'frozen') {
        throw new Error('Funds already released or refunded');
      }

      // Create release transaction (unfreeze)
      const releaseTransaction = await WalletService.createTransaction(
        escrowOp.client_id,
        TransactionType.RELEASE,
        request.amount,
        {
          related_order_id: request.order_id,
          description: request.description || `Escrow release for order ${request.order_id}`,
          idempotency_key: request.idempotency_key,
          metadata: { 
            operation: 'escrow_release',
            carrier_id: request.carrier_id
          }
        }
      );

      if (!releaseTransaction) {
        throw new Error('Failed to create release transaction');
      }

      // Confirm release transaction
      const confirmed = await WalletService.confirmTransaction(
        releaseTransaction.id,
        escrowOp.client_id
      );

      if (!confirmed) {
        throw new Error('Failed to confirm release transaction');
      }

      // Calculate carrier earnings (amount - commission)
      const carrierEarnings = request.amount - request.commission_amount;

      // Create earnings transaction for carrier
      const earningsTransaction = await WalletService.createTransaction(
        request.carrier_id,
        TransactionType.DEPOSIT,
        carrierEarnings,
        {
          related_order_id: request.order_id,
          description: `Earnings from order ${request.order_id}`,
          metadata: { 
            operation: 'carrier_earnings',
            commission_amount: request.commission_amount,
            gross_amount: request.amount
          }
        }
      );

      if (!earningsTransaction) {
        throw new Error('Failed to create earnings transaction');
      }

      // Confirm earnings transaction
      const earningsConfirmed = await WalletService.confirmTransaction(
        earningsTransaction.id,
        request.carrier_id
      );

      if (!earningsConfirmed) {
        throw new Error('Failed to confirm earnings transaction');
      }

      // Create commission transaction
      if (request.commission_amount > 0) {
        const commissionTransaction = await WalletService.createTransaction(
          request.carrier_id,
          TransactionType.COMMISSION,
          request.commission_amount,
          {
            related_order_id: request.order_id,
            description: `Commission for order ${request.order_id}`,
            metadata: { 
              operation: 'platform_commission',
              gross_amount: request.amount,
              net_amount: carrierEarnings
            }
          }
        );

        if (commissionTransaction) {
          await WalletService.confirmTransaction(
            commissionTransaction.id,
            request.carrier_id
          );

          // Record platform income
          await this.recordPlatformIncome({
            source: 'commission',
            amount: request.commission_amount,
            related_user_id: request.carrier_id,
            related_order_id: request.order_id,
            description: `Commission from order ${request.order_id}`
          });
        }
      }

      // Update escrow operation
      const { data: updatedOp, error } = await supabase
        .from('escrow_operations')
        .update({
          status: 'released',
          released_at: new Date().toISOString(),
          metadata: {
            ...escrowOp.metadata,
            release_transaction_id: releaseTransaction.id,
            earnings_transaction_id: earningsTransaction.id,
            commission_amount: request.commission_amount,
            carrier_earnings: carrierEarnings
          }
        })
        .eq('id', escrowOp.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating escrow operation:', error);
        throw error;
      }

      return updatedOp as EscrowOperation;
    } catch (error) {
      console.error('Error releasing funds:', error);
      return null;
    }
  }

  // Refund funds to client if order is cancelled
  static async refundFunds(
    orderId: string,
    reason?: string
  ): Promise<EscrowOperation | null> {
    try {
      const escrowOp = await this.getEscrowOperation(orderId);
      if (!escrowOp) {
        throw new Error('Escrow operation not found');
      }

      if (escrowOp.status !== 'frozen') {
        throw new Error('Funds already released or refunded');
      }

      // Create release transaction (unfreeze)
      const releaseTransaction = await WalletService.createTransaction(
        escrowOp.client_id,
        TransactionType.RELEASE,
        escrowOp.amount,
        {
          related_order_id: orderId,
          description: `Refund for cancelled order ${orderId}: ${reason || 'No reason provided'}`,
          metadata: { 
            operation: 'escrow_refund',
            reason: reason || 'Order cancelled'
          }
        }
      );

      if (!releaseTransaction) {
        throw new Error('Failed to create refund transaction');
      }

      // Confirm release transaction
      const confirmed = await WalletService.confirmTransaction(
        releaseTransaction.id,
        escrowOp.client_id
      );

      if (!confirmed) {
        throw new Error('Failed to confirm refund transaction');
      }

      // Create refund transaction
      const refundTransaction = await WalletService.createTransaction(
        escrowOp.client_id,
        TransactionType.REFUND,
        escrowOp.amount,
        {
          related_order_id: orderId,
          description: `Refund for order ${orderId}`,
          metadata: { 
            operation: 'order_refund',
            reason: reason || 'Order cancelled'
          }
        }
      );

      if (!refundTransaction) {
        throw new Error('Failed to create refund transaction');
      }

      // Confirm refund transaction
      const refundConfirmed = await WalletService.confirmTransaction(
        refundTransaction.id,
        escrowOp.client_id
      );

      if (!refundConfirmed) {
        throw new Error('Failed to confirm refund transaction');
      }

      // Update escrow operation
      const { data: updatedOp, error } = await supabase
        .from('escrow_operations')
        .update({
          status: 'refunded',
          refunded_at: new Date().toISOString(),
          metadata: {
            ...escrowOp.metadata,
            refund_transaction_id: refundTransaction.id,
            release_transaction_id: releaseTransaction.id,
            refund_reason: reason || 'Order cancelled'
          }
        })
        .eq('id', escrowOp.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating escrow operation:', error);
        throw error;
      }

      return updatedOp as EscrowOperation;
    } catch (error) {
      console.error('Error refunding funds:', error);
      return null;
    }
  }

  // Get escrow operation by order ID
  static async getEscrowOperation(orderId: string): Promise<EscrowOperation | null> {
    const { data, error } = await supabase
      .from('escrow_operations')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error('Error fetching escrow operation:', error);
      return null;
    }

    return data as EscrowOperation;
  }

  // Get user's escrow operations
  static async getUserEscrowOperations(
    userId: string,
    status?: 'frozen' | 'released' | 'refunded'
  ): Promise<EscrowOperation[]> {
    let query = supabase
      .from('escrow_operations')
      .select('*')
      .or(`client_id.eq.${userId},carrier_id.eq.${userId}`)
      .order('frozen_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching user escrow operations:', error);
      return [];
    }

    return (data as EscrowOperation[]) || [];
  }

  // Check if user can afford amount
  static async checkUserCanAfford(userId: string, amount: number): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('can_user_afford', {
        p_user_id: userId,
        p_amount: amount
      } as any);

      if (error) {
        console.error('Error checking if user can afford:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Error checking user affordability:', error);
      return false;
    }
  }

  // Get escrow statistics
  static async getEscrowStats(userId?: string): Promise<{
    total_frozen: number;
    total_released: number;
    total_refunded: number;
    pending_operations: number;
    total_volume: number;
  }> {
    let query = supabase
      .from('escrow_operations')
      .select('status, amount');

    if (userId) {
      query = query.or(`client_id.eq.${userId},carrier_id.eq.${userId}`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching escrow stats:', error);
      return {
        total_frozen: 0,
        total_released: 0,
        total_refunded: 0,
        pending_operations: 0,
        total_volume: 0
      };
    }

    const stats = {
      total_frozen: 0,
      total_released: 0,
      total_refunded: 0,
      pending_operations: 0,
      total_volume: 0
    };

    (data as any[])?.forEach((op: any) => {
      stats.total_volume += op.amount;
      
      switch (op.status) {
        case 'frozen':
          stats.total_frozen += op.amount;
          stats.pending_operations += 1;
          break;
        case 'released':
          stats.total_released += op.amount;
          break;
        case 'refunded':
          stats.total_refunded += op.amount;
          break;
      }
    });

    return stats;
  }

  // Record platform income
  private static async recordPlatformIncome(income: {
    source: string;
    amount: number;
    related_user_id?: string;
    related_order_id?: string;
    description?: string;
  }): Promise<void> {
    try {
      const { error } = await supabase
        .from('platform_income')
        .insert({
          source: income.source,
          amount: income.amount,
          related_user_id: income.related_user_id,
          related_order_id: income.related_order_id,
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

  // Double release protection - check if already released
  static async isAlreadyReleased(orderId: string): Promise<boolean> {
    const escrowOp = await this.getEscrowOperation(orderId);
    return escrowOp?.status === 'released';
  }

  // Get frozen amount for order
  static async getFrozenAmount(orderId: string): Promise<number> {
    const escrowOp = await this.getEscrowOperation(orderId);
    return escrowOp?.status === 'frozen' ? escrowOp.amount : 0;
  }
}
