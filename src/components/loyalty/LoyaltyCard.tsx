import { useState } from "react";
import { Gift, Star, Coins, ChevronDown, ChevronUp, Check } from "lucide-react";
import { useLoyalty } from "@/hooks/useLoyalty";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export const LoyaltyCard = () => {
  const { balance, lifetimeEarned, loading, rewards, redeemReward } = useLoyalty();
  const [isExpanded, setIsExpanded] = useState(false);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const { toast } = useToast();

  const handleRedeem = async (rewardId: string) => {
    setRedeeming(rewardId);
    const reward = await redeemReward(rewardId);
    setRedeeming(null);

    if (reward) {
      toast({
        title: "Награда получена! 🎉",
        description: `${reward.name} добавлена к вашему аккаунту`,
      });
    } else {
      toast({
        title: "Недостаточно баллов",
        description: "Накопите больше баллов для этой награды",
        variant: "destructive",
      });
    }
  };

  // Calculate progress to next reward
  const nextReward = rewards.find((r) => r.points_cost > balance);
  const progressPercent = nextReward
    ? Math.min((balance / nextReward.points_cost) * 100, 100)
    : 100;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="animate-pulse flex items-center gap-4">
            <div className="w-12 h-12 bg-muted rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-3 bg-muted rounded w-1/3" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 bg-primary/10 rounded-full">
              <Coins className="w-5 h-5 text-primary" />
            </div>
            Программа лояльности
          </CardTitle>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {balance.toLocaleString()} баллов
          </Badge>
        </div>
        <CardDescription>
          Всего заработано: {lifetimeEarned.toLocaleString()} баллов
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress to next reward */}
        {nextReward && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">До награды "{nextReward.name}"</span>
              <span className="font-medium">
                {balance} / {nextReward.points_cost}
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}

        {/* Expand/Collapse button */}
        <Button
          variant="ghost"
          className="w-full justify-between"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="flex items-center gap-2">
            <Gift className="w-4 h-4" />
            Доступные награды ({rewards.filter((r) => r.points_cost <= balance).length})
          </span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>

        {/* Rewards list */}
        {isExpanded && (
          <div className="space-y-3 pt-2">
            {rewards.map((reward) => {
              const canAfford = balance >= reward.points_cost;
              const isRedeeming = redeeming === reward.id;

              return (
                <div
                  key={reward.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    canAfford ? "bg-primary/5 border-primary/20" : "bg-muted/50"
                  )}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{reward.name}</span>
                      {reward.discount_percent && (
                        <Badge variant="outline" className="text-xs">
                          −{reward.discount_percent}%
                        </Badge>
                      )}
                      {reward.discount_amount && (
                        <Badge variant="outline" className="text-xs">
                          −{reward.discount_amount}₽
                        </Badge>
                      )}
                    </div>
                    {reward.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {reward.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-1 text-xs">
                      <Star className="w-3 h-3 text-yellow-500" />
                      <span className={canAfford ? "text-primary font-medium" : "text-muted-foreground"}>
                        {reward.points_cost} баллов
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={canAfford ? "default" : "outline"}
                    disabled={!canAfford || isRedeeming}
                    onClick={() => handleRedeem(reward.id)}
                  >
                    {isRedeeming ? (
                      <span className="animate-spin">⏳</span>
                    ) : canAfford ? (
                      <>
                        <Check className="w-3 h-3 mr-1" />
                        Получить
                      </>
                    ) : (
                      "Недоступно"
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* How to earn */}
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          <p className="font-medium mb-1">Как заработать баллы:</p>
          <ul className="space-y-1">
            <li>• 100 баллов за каждую завершённую доставку</li>
            <li>• 50 баллов за отзыв о перевозчике</li>
            <li>• Бонусные баллы за приглашение друзей</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
