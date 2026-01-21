import { useEffect, useState } from "react";
import { 
  Award, Medal, Trophy, Target, Star, Wallet, 
  Truck, Crown, Zap, Shield, Loader2 
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  requirement: number;
  current: number;
  unlocked: boolean;
  type: "deals" | "earnings" | "rating";
}

export const CarrierAchievements = () => {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchStats();
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;

    // Fetch deals
    const { data: deals } = await supabase
      .from("deals")
      .select("id, status, agreed_price")
      .eq("carrier_id", user.id);

    // Fetch ratings
    const { data: ratings } = await supabase
      .from("ratings")
      .select("score")
      .eq("rated_id", user.id);

    const completedDeals = deals?.filter(d => d.status === "delivered").length || 0;
    const totalEarnings = deals?.filter(d => d.status === "delivered")
      .reduce((acc, d) => acc + (d.agreed_price || 0), 0) || 0;
    
    const avgRating = ratings && ratings.length > 0
      ? ratings.reduce((acc, r) => acc + r.score, 0) / ratings.length
      : 0;

    const achievementDefinitions: Achievement[] = [
      // Deals achievements
      {
        id: "first_order",
        name: "Первый заказ",
        description: "Выполните свой первый заказ",
        icon: Truck,
        color: "text-green-500",
        bgColor: "bg-green-500/10",
        requirement: 1,
        current: completedDeals,
        unlocked: completedDeals >= 1,
        type: "deals",
      },
      {
        id: "ten_orders",
        name: "10 заказов",
        description: "Выполните 10 заказов",
        icon: Medal,
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
        requirement: 10,
        current: completedDeals,
        unlocked: completedDeals >= 10,
        type: "deals",
      },
      {
        id: "fifty_orders",
        name: "50 заказов",
        description: "Выполните 50 заказов",
        icon: Trophy,
        color: "text-purple-500",
        bgColor: "bg-purple-500/10",
        requirement: 50,
        current: completedDeals,
        unlocked: completedDeals >= 50,
        type: "deals",
      },
      {
        id: "hundred_orders",
        name: "100 заказов",
        description: "Выполните 100 заказов. Легенда!",
        icon: Crown,
        color: "text-gold",
        bgColor: "bg-gold/10",
        requirement: 100,
        current: completedDeals,
        unlocked: completedDeals >= 100,
        type: "deals",
      },
      // Earnings achievements (in UZS)
      {
        id: "first_million",
        name: "1 000 000 сум",
        description: "Заработайте 1 000 000 сум",
        icon: Wallet,
        color: "text-emerald-500",
        bgColor: "bg-emerald-500/10",
        requirement: 1000000,
        current: totalEarnings,
        unlocked: totalEarnings >= 1000000,
        type: "earnings",
      },
      {
        id: "five_million",
        name: "5 000 000 сум",
        description: "Заработайте 5 000 000 сум",
        icon: Target,
        color: "text-teal-500",
        bgColor: "bg-teal-500/10",
        requirement: 5000000,
        current: totalEarnings,
        unlocked: totalEarnings >= 5000000,
        type: "earnings",
      },
      {
        id: "ten_million",
        name: "10 000 000 сум",
        description: "Заработайте 10 000 000 сум",
        icon: Zap,
        color: "text-yellow-500",
        bgColor: "bg-yellow-500/10",
        requirement: 10000000,
        current: totalEarnings,
        unlocked: totalEarnings >= 10000000,
        type: "earnings",
      },
      // Rating achievements
      {
        id: "rating_4",
        name: "Рейтинг 4.0",
        description: "Получите средний рейтинг 4.0",
        icon: Star,
        color: "text-amber-500",
        bgColor: "bg-amber-500/10",
        requirement: 4,
        current: avgRating,
        unlocked: avgRating >= 4 && ratings && ratings.length > 0,
        type: "rating",
      },
      {
        id: "rating_5",
        name: "Рейтинг 5.0",
        description: "Идеальный рейтинг 5.0!",
        icon: Shield,
        color: "text-rose-500",
        bgColor: "bg-rose-500/10",
        requirement: 5,
        current: avgRating,
        unlocked: avgRating >= 5,
        type: "rating",
      },
    ];

    setAchievements(achievementDefinitions);
    setLoading(false);
  };

  const formatProgress = (achievement: Achievement) => {
    if (achievement.type === "earnings") {
      return `${(achievement.current / 1000000).toFixed(1)}М / ${(achievement.requirement / 1000000).toFixed(0)}М сум`;
    }
    if (achievement.type === "rating") {
      return `${achievement.current.toFixed(1)} / ${achievement.requirement.toFixed(1)}`;
    }
    return `${achievement.current} / ${achievement.requirement}`;
  };

  const getProgress = (achievement: Achievement) => {
    if (achievement.unlocked) return 100;
    return Math.min((achievement.current / achievement.requirement) * 100, 100);
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

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="w-5 h-5 text-gold" />
          Достижения
        </CardTitle>
        <CardDescription>
          Разблокировано: {unlockedCount} из {achievements.length}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mb-6">
            {achievements.map((achievement) => {
              const Icon = achievement.icon;
              return (
                <Tooltip key={achievement.id}>
                  <TooltipTrigger>
                    <div
                      className={`p-3 rounded-lg text-center transition-all ${
                        achievement.unlocked
                          ? `${achievement.bgColor} ring-2 ring-offset-2 ring-${achievement.color.replace("text-", "")}`
                          : "bg-muted/50 opacity-50 grayscale"
                      }`}
                    >
                      <Icon
                        className={`w-6 h-6 mx-auto mb-1 ${
                          achievement.unlocked ? achievement.color : "text-muted-foreground"
                        }`}
                      />
                      <p className="text-xs font-medium truncate">{achievement.name}</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px]">
                    <p className="font-semibold">{achievement.name}</p>
                    <p className="text-sm text-muted-foreground">{achievement.description}</p>
                    {!achievement.unlocked && (
                      <div className="mt-2">
                        <Progress value={getProgress(achievement)} className="h-1.5" />
                        <p className="text-xs mt-1">{formatProgress(achievement)}</p>
                      </div>
                    )}
                    {achievement.unlocked && (
                      <Badge className="mt-2 bg-green-500">Разблокировано!</Badge>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>

        {/* Next achievements to unlock */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Следующие достижения:</h4>
          {achievements
            .filter(a => !a.unlocked)
            .slice(0, 3)
            .map((achievement) => {
              const Icon = achievement.icon;
              return (
                <div key={achievement.id} className="flex items-center gap-3">
                  <div className={`p-2 rounded ${achievement.bgColor}`}>
                    <Icon className={`w-4 h-4 ${achievement.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{achievement.name}</p>
                    <Progress value={getProgress(achievement)} className="h-1.5 mt-1" />
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatProgress(achievement)}
                  </span>
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
};
