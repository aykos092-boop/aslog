import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface LoyaltyState {
  balance: number;
  lifetimeEarned: number;
  loading: boolean;
}

interface LoyaltyReward {
  id: string;
  name: string;
  description: string | null;
  points_cost: number;
  discount_percent: number | null;
  discount_amount: number | null;
}

export const useLoyalty = () => {
  const { user } = useAuth();
  const [state, setState] = useState<LoyaltyState>({
    balance: 0,
    lifetimeEarned: 0,
    loading: true,
  });
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);

  // Load loyalty points
  useEffect(() => {
    const loadLoyalty = async () => {
      if (!user) {
        setState({ balance: 0, lifetimeEarned: 0, loading: false });
        return;
      }

      const { data } = await supabase
        .from("loyalty_points")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setState({
          balance: data.balance,
          lifetimeEarned: data.lifetime_earned,
          loading: false,
        });
      } else {
        // Create loyalty record if doesn't exist
        await supabase
          .from("loyalty_points")
          .insert({ user_id: user.id, balance: 0, lifetime_earned: 0 });
        setState({ balance: 0, lifetimeEarned: 0, loading: false });
      }
    };

    loadLoyalty();
  }, [user]);

  // Load available rewards
  useEffect(() => {
    const loadRewards = async () => {
      const { data } = await supabase
        .from("loyalty_rewards")
        .select("*")
        .eq("is_active", true)
        .order("points_cost", { ascending: true });

      if (data) {
        setRewards(data);
      }
    };

    loadRewards();
  }, []);

  // Earn points
  const earnPoints = async (amount: number, reason: string, referenceId?: string) => {
    if (!user || amount <= 0) return false;

    // Update balance
    const { error: updateError } = await supabase
      .from("loyalty_points")
      .update({
        balance: state.balance + amount,
        lifetime_earned: state.lifetimeEarned + amount,
      })
      .eq("user_id", user.id);

    if (updateError) return false;

    // Log transaction
    await supabase.from("loyalty_transactions").insert({
      user_id: user.id,
      amount,
      type: "earned",
      reason,
      reference_id: referenceId,
    });

    setState((prev) => ({
      ...prev,
      balance: prev.balance + amount,
      lifetimeEarned: prev.lifetimeEarned + amount,
    }));

    return true;
  };

  // Spend points
  const spendPoints = async (amount: number, reason: string, referenceId?: string) => {
    if (!user || amount <= 0 || amount > state.balance) return false;

    // Update balance
    const { error: updateError } = await supabase
      .from("loyalty_points")
      .update({ balance: state.balance - amount })
      .eq("user_id", user.id);

    if (updateError) return false;

    // Log transaction
    await supabase.from("loyalty_transactions").insert({
      user_id: user.id,
      amount: -amount,
      type: "spent",
      reason,
      reference_id: referenceId,
    });

    setState((prev) => ({
      ...prev,
      balance: prev.balance - amount,
    }));

    return true;
  };

  // Redeem reward
  const redeemReward = async (rewardId: string) => {
    const reward = rewards.find((r) => r.id === rewardId);
    if (!reward || state.balance < reward.points_cost) return null;

    const success = await spendPoints(
      reward.points_cost,
      `Обмен на награду: ${reward.name}`,
      rewardId
    );

    if (success) {
      return reward;
    }
    return null;
  };

  return {
    balance: state.balance,
    lifetimeEarned: state.lifetimeEarned,
    loading: state.loading,
    rewards,
    earnPoints,
    spendPoints,
    redeemReward,
  };
};
