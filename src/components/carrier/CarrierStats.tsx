import { useEffect, useState } from "react";
import { 
  TrendingUp, Package, Star, Wallet, Award, 
  CheckCircle, Clock, Loader2, BarChart3 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface CarrierStats {
  totalDeals: number;
  completedDeals: number;
  cancelledDeals: number;
  inProgressDeals: number;
  totalEarnings: number;
  averageRating: number | null;
  totalRatings: number;
  thisMonthDeals: number;
  thisMonthEarnings: number;
}

export const CarrierStats = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<CarrierStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchStats();
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;

    // Fetch all deals where user is carrier
    const { data: deals } = await supabase
      .from("deals")
      .select("id, status, agreed_price, created_at, completed_at")
      .eq("carrier_id", user.id);

    // Fetch ratings
    const { data: ratings } = await supabase
      .from("ratings")
      .select("score")
      .eq("rated_id", user.id);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const allDeals = deals || [];
    const completedDeals = allDeals.filter(d => d.status === "delivered");
    const cancelledDeals = allDeals.filter(d => d.status === "cancelled");
    const inProgressDeals = allDeals.filter(d => 
      ["pending", "accepted", "in_transit"].includes(d.status)
    );

    const thisMonthDeals = completedDeals.filter(d => 
      d.completed_at && new Date(d.completed_at) >= startOfMonth
    );

    const totalEarnings = completedDeals.reduce((acc, d) => acc + (d.agreed_price || 0), 0);
    const thisMonthEarnings = thisMonthDeals.reduce((acc, d) => acc + (d.agreed_price || 0), 0);

    const allRatings = ratings || [];
    const averageRating = allRatings.length > 0
      ? allRatings.reduce((acc, r) => acc + r.score, 0) / allRatings.length
      : null;

    setStats({
      totalDeals: allDeals.length,
      completedDeals: completedDeals.length,
      cancelledDeals: cancelledDeals.length,
      inProgressDeals: inProgressDeals.length,
      totalEarnings,
      averageRating,
      totalRatings: allRatings.length,
      thisMonthDeals: thisMonthDeals.length,
      thisMonthEarnings,
    });

    setLoading(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const completionRate = stats.totalDeals > 0 
    ? Math.round((stats.completedDeals / stats.totalDeals) * 100) 
    : 0;

  const getRatingLevel = (rating: number | null) => {
    if (!rating) return { label: "Sharhlar yo'q", color: "text-muted-foreground" };
    if (rating >= 4.5) return { label: "A'lo", color: "text-green-500" };
    if (rating >= 4.0) return { label: "Yaxshi", color: "text-blue-500" };
    if (rating >= 3.0) return { label: "O'rtacha", color: "text-yellow-500" };
    return { label: "Yomon", color: "text-red-500" };
  };

  const ratingLevel = getRatingLevel(stats.averageRating);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Haydovchi statistikasi
        </CardTitle>
        <CardDescription>
          Sizning tarix va yutuqlaringiz
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Completed Deals */}
          <div className="p-4 rounded-lg bg-green-500/10 text-center">
            <CheckCircle className="w-6 h-6 mx-auto mb-2 text-green-500" />
            <p className="text-2xl font-bold">{stats.completedDeals}</p>
            <p className="text-xs text-muted-foreground">Bajarildi</p>
          </div>

          {/* Total Earnings */}
          <div className="p-4 rounded-lg bg-primary/10 text-center">
            <Wallet className="w-6 h-6 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">
              {stats.totalEarnings >= 1000000 
                ? `${(stats.totalEarnings / 1000000).toFixed(1)}M` 
                : stats.totalEarnings >= 1000
                ? `${(stats.totalEarnings / 1000).toFixed(0)}K`
                : stats.totalEarnings}
            </p>
            <p className="text-xs text-muted-foreground">Topilgan so'm</p>
          </div>

          {/* Average Rating */}
          <div className="p-4 rounded-lg bg-gold/10 text-center">
            <Star className="w-6 h-6 mx-auto mb-2 text-gold" />
            <p className="text-2xl font-bold">
              {stats.averageRating ? stats.averageRating.toFixed(1) : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Reyting</p>
          </div>

          {/* In Progress */}
          <div className="p-4 rounded-lg bg-blue-500/10 text-center">
            <Clock className="w-6 h-6 mx-auto mb-2 text-blue-500" />
            <p className="text-2xl font-bold">{stats.inProgressDeals}</p>
            <p className="text-xs text-muted-foreground">Jarayonda</p>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Bajarilish darajasi</span>
            <span className="font-medium">{completionRate}%</span>
          </div>
          <Progress value={completionRate} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {stats.completedDeals} / {stats.totalDeals} ta buyurtma bajarildi
          </p>
        </div>

        {/* Rating Details */}
        {stats.averageRating && (
          <div className="p-4 rounded-lg border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-gold" />
                <span className="font-medium">Sizning reytingingiz</span>
              </div>
              <Badge className={ratingLevel.color}>{ratingLevel.label}</Badge>
            </div>
            <div className="flex gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-5 h-5 ${
                    s <= Math.round(stats.averageRating || 0)
                      ? "fill-gold text-gold"
                      : "text-muted-foreground"
                  }`}
                />
              ))}
              <span className="ml-2 text-sm text-muted-foreground">
                ({stats.totalRatings} ta sharh)
              </span>
            </div>
          </div>
        )}

        {/* This Month */}
        <div className="p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="font-medium">Bu oy</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-xl font-bold">{stats.thisMonthDeals}</p>
              <p className="text-xs text-muted-foreground">Buyurtmalar</p>
            </div>
            <div>
              <p className="text-xl font-bold">
                {stats.thisMonthEarnings.toLocaleString("ru-RU")} so'm
              </p>
              <p className="text-xs text-muted-foreground">Topilgan</p>
            </div>
          </div>
        </div>

        {/* Cancelled */}
        {stats.cancelledDeals > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Bekor qilindi: {stats.cancelledDeals} ta buyurtma
          </p>
        )}
      </CardContent>
    </Card>
  );
};
