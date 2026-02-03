import { useEffect, useState } from "react";
import { 
  Crown, Star, Shield, Zap, Award, TrendingUp, 
  Check, Lock, Loader2, ChevronRight
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

interface LevelConfig {
  id: string;
  name: string;
  nameKey: string;
  minDeals: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  privileges: string[];
  privilegeKeys: string[];
}

const levels: LevelConfig[] = [
  {
    id: "beginner",
    name: "Новичок",
    nameKey: "level.beginner",
    minDeals: 0,
    icon: Star,
    color: "text-slate-500",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500",
    privileges: ["Базовый доступ к заказам"],
    privilegeKeys: ["level.priorityOrders"],
  },
  {
    id: "experienced",
    name: "Опытный",
    nameKey: "level.experienced",
    minDeals: 10,
    icon: Shield,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500",
    privileges: ["Приоритетные заказы", "Сниженная комиссия 3%"],
    privilegeKeys: ["level.priorityOrders", "level.reducedCommission"],
  },
  {
    id: "professional",
    name: "Профессионал",
    nameKey: "level.professional",
    minDeals: 50,
    icon: Award,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500",
    privileges: ["Значок проверенного", "Премиум поддержка", "Комиссия 2%"],
    privilegeKeys: ["level.verifiedBadge", "level.premiumSupport", "level.reducedCommission"],
  },
  {
    id: "expert",
    name: "Эксперт",
    nameKey: "level.expert",
    minDeals: 100,
    icon: Crown,
    color: "text-gold",
    bgColor: "bg-gold/10",
    borderColor: "border-gold",
    privileges: ["Топ размещение", "Эксклюзивные предложения", "Без комиссии"],
    privilegeKeys: ["level.topPlacement", "level.exclusiveOffers", "level.reducedCommission"],
  },
];

export const CarrierLevel = () => {
  const { user } = useFirebaseAuth();
  const { t } = useLanguage();
  const [completedDeals, setCompletedDeals] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchStats();
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;

    const { data: deals } = await supabase
      .from("deals")
      .select("id")
      .eq("carrier_id", user.id)
      .eq("status", "delivered");

    setCompletedDeals(deals?.length || 0);
    setLoading(false);
  };

  const getCurrentLevel = () => {
    for (let i = levels.length - 1; i >= 0; i--) {
      if (completedDeals >= levels[i].minDeals) {
        return { level: levels[i], index: i };
      }
    }
    return { level: levels[0], index: 0 };
  };

  const getNextLevel = () => {
    const { index } = getCurrentLevel();
    return index < levels.length - 1 ? levels[index + 1] : null;
  };

  const getProgressToNext = () => {
    const { level, index } = getCurrentLevel();
    const next = getNextLevel();
    
    if (!next) return 100;
    
    const currentMin = level.minDeals;
    const nextMin = next.minDeals;
    const progress = ((completedDeals - currentMin) / (nextMin - currentMin)) * 100;
    
    return Math.min(progress, 100);
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

  const { level: currentLevel, index: currentIndex } = getCurrentLevel();
  const nextLevel = getNextLevel();
  const LevelIcon = currentLevel.icon;

  return (
    <Card className={`border-2 ${currentLevel.borderColor}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          {t("level.yourLevel")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Level Display */}
        <div className={`p-6 rounded-xl ${currentLevel.bgColor} text-center relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
            <LevelIcon className="w-full h-full" />
          </div>
          <LevelIcon className={`w-12 h-12 mx-auto mb-3 ${currentLevel.color}`} />
          <h3 className={`text-2xl font-bold ${currentLevel.color}`}>
            {t(currentLevel.nameKey)}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {completedDeals} {t("level.dealsNeeded")}
          </p>
        </div>

        {/* Progress to Next Level */}
        {nextLevel && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("level.nextLevel")}</span>
              <span className="font-medium flex items-center gap-1">
                {t(nextLevel.nameKey)}
                <ChevronRight className="w-4 h-4" />
              </span>
            </div>
            <Progress value={getProgressToNext()} className="h-3" />
            <p className="text-xs text-muted-foreground text-center">
              {nextLevel.minDeals - completedDeals} {t("level.dealsNeeded")}
            </p>
          </div>
        )}

        {/* Current Level Privileges */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">{t("level.privileges")}</h4>
          <div className="space-y-2">
            {currentLevel.privilegeKeys.map((key, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Check className={`w-4 h-4 ${currentLevel.color}`} />
                <span>{t(key)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* All Levels Progress */}
        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium mb-3">{t("carrier.history")}</h4>
          <div className="flex justify-between">
            {levels.map((level, index) => {
              const Icon = level.icon;
              const isUnlocked = index <= currentIndex;
              const isCurrent = index === currentIndex;
              
              return (
                <div 
                  key={level.id}
                  className={`flex flex-col items-center gap-1 ${
                    isUnlocked ? "" : "opacity-40"
                  }`}
                >
                  <div className={`p-2 rounded-full ${
                    isCurrent ? level.bgColor : isUnlocked ? "bg-muted" : "bg-muted/50"
                  }`}>
                    {isUnlocked ? (
                      <Icon className={`w-5 h-5 ${isCurrent ? level.color : "text-muted-foreground"}`} />
                    ) : (
                      <Lock className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <span className="text-xs text-center">{t(level.nameKey)}</span>
                  <span className="text-xs text-muted-foreground">{level.minDeals}+</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
