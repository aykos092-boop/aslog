import { supabase } from '@/integrations/supabase/client';
import { EscrowService } from '@/modules/escrow/escrow.service';
import { CommissionService } from '@/modules/commission/commission.service';
import { SubscriptionService } from '@/modules/subscriptions/subscriptions.service';
import { DocumentsService, DocumentType } from '@/modules/documents/documents.service';

export class OrderMonetizationIntegration {
  // Enhanced order creation with monetization
  static async createOrderWithMonetization(
    userId: string,
    orderData: {
      cargo_type: string;
      weight?: number;
      length?: number;
      width?: number;
      height?: number;
      pickup_address: string;
      delivery_address: string;
      pickup_date: string;
      description?: string;
      budget?: number;
      is_priority?: boolean;
    }
  ): Promise<any> {
    try {
      // Start database transaction
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          client_id: userId,
          ...orderData,
          status: 'open'
        })
        .select()
        .single();

      if (orderError) {
        console.error('Error creating order:', orderError);
        throw orderError;
      }

      // Check if user has active trial and grant if eligible
      await this.checkAndGrantTrial(userId);

      // Generate initial documents if needed
      if (orderData.budget && orderData.budget > 1000) {
        await DocumentsService.generateDocumentPDF(
          DocumentType.TRANSPORT_CONTRACT,
          {
            order_id: order.id,
            client_info: { user_id: userId },
            cargo_details: {
              type: orderData.cargo_type,
              weight: orderData.weight,
              dimensions: `${orderData.length || 0}x${orderData.width || 0}x${orderData.height || 0}`
            },
            route: {
              from: orderData.pickup_address,
              to: orderData.delivery_address
            },
            price: {
              amount: orderData.budget,
              currency: 'UZS'
            }
          },
          {
            orderId: order.id,
            userId: userId
          }
        );
      }

      return order;
    } catch (error) {
      console.error('Error creating order with monetization:', error);
      throw error;
    }
  }

  // Handle order response with escrow
  static async handleOrderResponse(
    orderId: string,
    carrierId: string,
    responsePrice: number,
    deliveryTime?: string,
    comment?: string
  ): Promise<any> {
    try {
      // Create response
      const { data: response, error: responseError } = await supabase
        .from('responses')
        .insert({
          order_id: orderId,
          carrier_id: carrierId,
          price: responsePrice,
          delivery_time: deliveryTime,
          comment: comment,
          is_accepted: false
        })
        .select()
        .single();

      if (responseError) {
        console.error('Error creating response:', responseError);
        throw responseError;
      }

      return response;
    } catch (error) {
      console.error('Error handling order response:', error);
      throw error;
    }
  }

  // Accept response and create deal with escrow
  static async acceptResponseAndCreateDeal(
    orderId: string,
    responseId: string,
    clientId: string
  ): Promise<any> {
    try {
      // Get order and response details
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      const { data: response, error: responseError } = await supabase
        .from('responses')
        .select('*')
        .eq('id', responseId)
        .single();

      if (orderError || responseError) {
        throw new Error('Order or response not found');
      }

      // Update response as accepted
      await supabase
        .from('responses')
        .update({ is_accepted: true })
        .eq('id', responseId);

      // Create deal
      const { data: deal, error: dealError } = await supabase
        .from('deals')
        .insert({
          order_id: orderId,
          client_id: clientId,
          carrier_id: response.carrier_id,
          agreed_price: response.price,
          status: 'pending',
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (dealError) {
        console.error('Error creating deal:', dealError);
        throw dealError;
      }

      // Freeze funds from client
      const escrowResult = await EscrowService.freezeFunds({
        order_id: orderId,
        client_id: clientId,
        amount: response.price,
        description: `Escrow for order ${orderId}`
      });

      if (!escrowResult) {
        // Rollback deal creation if escrow fails
        await supabase.from('deals').delete().eq('id', deal.id);
        throw new Error('Failed to freeze funds');
      }

      // Update order status
      await supabase
        .from('orders')
        .update({ status: 'in_progress' })
        .eq('id', orderId);

      // Generate waybill
      await DocumentsService.generateDocumentPDF(
        DocumentType.WAYBILL,
        {
          waybillNumber: `ТТН-${Date.now()}`,
          sender: { name: 'Client', address: order.pickup_address },
          receiver: { name: 'Receiver', address: order.delivery_address },
          cargo: {
            name: order.cargo_type,
            weight: order.weight,
            volume: (order.length || 0) * (order.width || 0) * (order.height || 0) / 1000000
          },
          vehicle: { brand: 'TBD', plateNumber: 'TBD' },
          driver: { name: 'TBD' }
        },
        {
          orderId: orderId,
          userId: clientId
        }
      );

      return deal;
    } catch (error) {
      console.error('Error accepting response and creating deal:', error);
      throw error;
    }
  }

  // Complete deal and release funds
  static async completeDeal(
    dealId: string,
    proofPhotoUrl?: string
  ): Promise<any> {
    try {
      // Get deal details
      const { data: deal, error: dealError } = await supabase
        .from('deals')
        .select(`
          *,
          orders!inner(client_id, pickup_address, delivery_address, cargo_type),
          responses!inner(carrier_id, price)
        `)
        .eq('id', dealId)
        .single();

      if (dealError) {
        console.error('Error fetching deal:', dealError);
        throw dealError;
      }

      // Calculate commission
      const commissionCalculation = await CommissionService.calculateCommission(
        (deal as any).responses.carrier_id,
        (deal as any).responses.price
      );

      // Release funds to carrier
      const releaseResult = await EscrowService.releaseFunds({
        order_id: (deal as any).order_id,
        carrier_id: (deal as any).responses.carrier_id,
        amount: (deal as any).responses.price,
        commission_amount: commissionCalculation.commission_amount,
        description: `Deal completion - Order ${(deal as any).order_id}`
      });

      if (!releaseResult) {
        throw new Error('Failed to release funds');
      }

      // Update deal status
      const { data: updatedDeal, error: updateError } = await supabase
        .from('deals')
        .update({
          status: 'delivered',
          completed_at: new Date().toISOString(),
          proof_photo_url: proofPhotoUrl,
          client_fee: commissionCalculation.commission_amount,
          carrier_earnings: commissionCalculation.net_amount,
          platform_commission: commissionCalculation.commission_amount,
          commission_percent: commissionCalculation.commission_percent,
          frozen_amount: (deal as any).responses.price,
          released_at: new Date().toISOString()
        })
        .eq('id', dealId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating deal:', updateError);
        throw updateError;
      }

      // Update order status
      await supabase
        .from('orders')
        .update({ status: 'completed' })
        .eq('id', (deal as any).order_id);

      // Update carrier turnover for commission level calculation
      await CommissionService.updateUserTurnover((deal as any).responses.carrier_id);

      // Generate completion act
      await DocumentsService.generateDocumentPDF(
        DocumentType.COMPLETION_ACT,
        {
          actNumber: `АКТ-${Date.now()}`,
          order: {
            id: (deal as any).order_id,
            date: (deal as any).created_at
          },
          route: {
            from: (deal as any).orders.pickup_address,
            to: (deal as any).orders.delivery_address
          },
          completionDate: new Date().toISOString(),
          amount: commissionCalculation.net_amount,
          currency: 'UZS'
        },
        {
          orderId: (deal as any).order_id,
          userId: (deal as any).responses.carrier_id
        }
      );

      // Generate invoice
      await DocumentsService.generateDocumentPDF(
        DocumentType.INVOICE,
        {
          invoiceNumber: `СЧ-${Date.now()}`,
          billing: {
            name: 'Client',
            inn: 'TBD',
            address: 'TBD'
          },
          services: [
            {
              name: `Перевозка груза: ${(deal as any).orders.cargo_type}`,
              amount: commissionCalculation.net_amount
            }
          ],
          total: commissionCalculation.net_amount,
          currency: 'UZS',
          paymentTerms: 'Оплата в течение 7 дней'
        },
        {
          orderId: (deal as any).order_id,
          userId: (deal as any).orders.client_id
        }
      );

      return updatedDeal;
    } catch (error) {
      console.error('Error completing deal:', error);
      throw error;
    }
  }

  // Cancel order and refund if applicable
  static async cancelOrder(
    orderId: string,
    userId: string,
    reason?: string
  ): Promise<boolean> {
    try {
      // Check if there's an active escrow operation
      const escrowOp = await EscrowService.getEscrowOperation(orderId);

      if (escrowOp && escrowOp.status === 'frozen') {
        // Refund frozen funds
        const refundResult = await EscrowService.refundFunds(orderId, reason);
        if (!refundResult) {
          throw new Error('Failed to refund funds');
        }
      }

      // Update order status
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
        .eq('client_id', userId);

      if (error) {
        console.error('Error cancelling order:', error);
        return false;
      }

      // Cancel any related deals
      await supabase
        .from('deals')
        .update({ status: 'cancelled' })
        .eq('order_id', orderId);

      return true;
    } catch (error) {
      console.error('Error cancelling order:', error);
      return false;
    }
  }

  // Get order with monetization info
  static async getOrderWithMonetization(orderId: string, userId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          responses(
            id,
            carrier_id,
            price,
            delivery_time,
            comment,
            is_accepted,
            profiles!inner(full_name, phone)
          ),
          deals(
            id,
            carrier_id,
            agreed_price,
            status,
            started_at,
            completed_at,
            platform_commission,
            carrier_earnings
          ),
          escrow_operations(
            id,
            amount,
            status,
            frozen_at,
            released_at
          ),
          documents(
            id,
            type,
            file_name,
            status,
            created_at
          )
        `)
        .eq('id', orderId)
        .or(`client_id.eq.${userId},responses.carrier_id.eq.${userId}`)
        .single();

      if (error) {
        console.error('Error fetching order with monetization:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error getting order with monetization:', error);
      return null;
    }
  }

  // Get user's monetization summary
  static async getUserMonetizationSummary(userId: string): Promise<{
    total_orders: number;
    completed_orders: number;
    total_spent: number;
    total_earned: number;
    current_balance: number;
    frozen_balance: number;
    active_subscription?: any;
    commission_level?: any;
  }> {
    try {
      // Get orders as client
      const { data: clientOrders } = await supabase
        .from('orders')
        .select('id, status, budget')
        .eq('client_id', userId);

      // Get deals as carrier
      const { data: carrierDeals } = await supabase
        .from('deals')
        .select('agreed_price, status, platform_commission')
        .eq('carrier_id', userId);

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select(`
          balance,
          frozen_balance,
          subscription_id,
          subscription_expires_at,
          commission_level_id,
          commission_levels!inner(name, percent),
          subscriptions!inner(name, commission_percent)
        `)
        .eq('user_id', userId)
        .single();

      const summary = {
        total_orders: clientOrders?.length || 0,
        completed_orders: 0,
        total_spent: 0,
        total_earned: 0,
        current_balance: (profile as any)?.balance || 0,
        frozen_balance: (profile as any)?.frozen_balance || 0,
        active_subscription: (profile as any)?.subscriptions,
        commission_level: (profile as any)?.commission_levels
      };

      // Calculate client stats
      (clientOrders as any[])?.forEach((order: any) => {
        if (order.status === 'completed') {
          summary.completed_orders += 1;
        }
        summary.total_spent += order.budget || 0;
      });

      // Calculate carrier earnings
      (carrierDeals as any[])?.forEach((deal: any) => {
        if (deal.status === 'delivered') {
          summary.total_earned += (deal.agreed_price || 0) - (deal.platform_commission || 0);
        }
      });

      return summary;
    } catch (error) {
      console.error('Error getting user monetization summary:', error);
      return {
        total_orders: 0,
        completed_orders: 0,
        total_spent: 0,
        total_earned: 0,
        current_balance: 0,
        frozen_balance: 0
      };
    }
  }

  // Check and grant trial to eligible users
  private static async checkAndGrantTrial(userId: string): Promise<void> {
    try {
      const userSub = await SubscriptionService.getUserSubscription(userId);
      
      if (!userSub) {
        // User has no subscription, check if eligible for trial
        const userProfile = await this.getUserProfile(userId);
        
        if (userProfile && !userProfile.trial_used) {
          const settings = await CommissionService.getPlatformSettings();
          
          if (settings.auto_trial_enabled) {
            await SubscriptionService.startTrial({
              user_id: userId
            });
          }
        }
      }
    } catch (error) {
      console.error('Error checking trial eligibility:', error);
    }
  }

  private static async getUserProfile(userId: string): Promise<any> {
    const { data, error } = await supabase
      .from('profiles')
      .select('trial_used')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    return data;
  }
}
