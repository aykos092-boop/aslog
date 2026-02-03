import { useEffect, useState } from "react";
import { 
  TrendingUp, Star, Wallet, Award, 
  CheckCircle, Clock, Loader2, BarChart3 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface CarrierStatsData {
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
  const { user } = useFirebaseAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState<CarrierStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchStats();
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;

    try {
      // Fetch deals stats
      const { data: dealsData, error: dealsError } = await supabase
        .from('deals')
        .select('*')
        .eq('carrier_id', user.uid)
        .eq('status', 'delivered');

      if (dealsError) throw dealsError;

      // Fetch ratings
      const { data: ratings } = await supabase
        .from("ratings")
        .select("score")
        .eq("rated_id", user.uid);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const allDeals = dealsData || [];
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
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="h-full">
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
    if (!rating) return { label: t("stats.noRating") || "Нет отзывов", color: "text-muted-foreground" };
    if (rating >= 4.5) return { label: t("stats.excellent") || "Отлично", color: "text-green-500" };
    if (rating >= 4.0) return { label: t("stats.good") || "Хорошо", color: "text-blue-500" };
    if (rating >= 3.0) return { label: t("stats.average") || "Средне", color: "text-yellow-500" };
    return { label: t("stats.poor") || "Плохо", color: "text-red-500" };
  };

  const ratingLevel = getRatingLevel(stats.averageRating);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="w-5 h-5" />
          {t("carrier.stats") || "Статистика"}
        </CardTitle>
        <CardDescription className="text-xs">
          {t("carrier.history") || "История и достижения"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Completed Deals */}
          <div className="p-3 rounded-lg bg-green-500/10 text-center">
            <CheckCircle className="w-5 h-5 mx-auto mb-1 text-green-500" />
            <p className="text-xl font-bold">{stats.completedDeals}</p>
            <p className="text-xs text-muted-foreground">{t("carrier.completed") || "Выполнено"}</p>
          </div>

          {/* Total Earnings */}
          <div className="p-3 rounded-lg bg-primary/10 text-center">
            <Wallet className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-xl font-bold">
              {stats.totalEarnings >= 1000000 
                ? `${(stats.totalEarnings / 1000000).toFixed(1)}M` 
                : stats.totalEarnings >= 1000
                ? `${(stats.totalEarnings / 1000).toFixed(0)}K`
                : stats.totalEarnings}
            </p>
            <p className="text-xs text-muted-foreground">{t("carrier.earned") || "Заработано"}</p>
          </div>

          {/* Average Rating */}
          <div className="p-3 rounded-lg bg-gold/10 text-center">
            <Star className="w-5 h-5 mx-auto mb-1 text-gold" />
            <p className="text-xl font-bold">
              {stats.averageRating ? stats.averageRating.toFixed(1) : "—"}
            </p>
            <p className="text-xs text-muted-foreground">{t("carrier.rating") || "Рейтинг"}</p>
          </div>

          {/* In Progress */}
          <div className="p-3 rounded-lg bg-blue-500/10 text-center">
            <Clock className="w-5 h-5 mx-auto mb-1 text-blue-500" />
            <p className="text-xl font-bold">{stats.inProgressDeals}</p>
            <p className="text-xs text-muted-foreground">{t("carrier.inProgress") || "В работе"}</p>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("carrier.completionRate") || "Завершённость"}</span>
            <span className="font-medium">{completionRate}%</span>
          </div>
          <Progress value={completionRate} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {stats.completedDeals} / {stats.totalDeals} {t("carrier.ordersCompleted") || "заказов"}
          </p>
        </div>

        {/* Rating Details */}
        {stats.totalRatings > 0 && (
          <div className="p-3 rounded-lg border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-gold" />
                <span className="font-medium text-sm">{t("carrier.yourRating") || "Ваш рейтинг"}</span>
              </div>
              <Badge className={ratingLevel.color} variant="outline">{ratingLevel.label}</Badge>
            </div>
            <div className="flex gap-0.5 mt-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-4 h-4 ${
                    s <= Math.round(stats.averageRating || 0)
                      ? "fill-gold text-gold"
                      : "text-muted-foreground"
                  }`}
                />
              ))}
              <span className="ml-2 text-xs text-muted-foreground">
                ({stats.totalRatings} {t("carrier.reviews") || "отзывов"})
              </span>
            </div>
          </div>
        )}

        {/* This Month */}
        <div className="p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">{t("carrier.thisMonth") || "В этом месяце"}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-lg font-bold">{stats.thisMonthDeals}</p>
              <p className="text-xs text-muted-foreground">{t("carrier.orders") || "Заказов"}</p>
            </div>
            <div>
              <p className="text-lg font-bold">
                {stats.thisMonthEarnings >= 1000
                  ? `${(stats.thisMonthEarnings / 1000).toFixed(0)}K`
                  : stats.thisMonthEarnings}
              </p>
              <p className="text-xs text-muted-foreground">{t("carrier.earned") || "Заработано"}</p>
            </div>
          </div>
        </div>

        {/* Cancelled */}
        {stats.cancelledDeals > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            {t("carrier.cancelled") || "Отменено"}: {stats.cancelledDeals}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
