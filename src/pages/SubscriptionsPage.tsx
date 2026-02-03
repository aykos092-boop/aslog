import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Crown, Star, Shield, Check, CreditCard, Gift } from "lucide-react";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubscriptionService } from "@/modules/subscriptions/subscriptions.service";
import { useToast } from "@/hooks/use-toast";

interface Subscription {
  id: string;
  name: string;
  monthly_price: number;
  commission_percent: number;
  features: Record<string, any>;
  trial_days?: number;
  trial_enabled?: boolean;
  is_active?: boolean;
}

interface UserSubscription {
  id: string;
  subscription_id: string;
  status: string;
  subscription_expires_at?: string;
  subscription?: Subscription;
}

const SubscriptionsPage = () => {
  const navigate = useNavigate();
  const { user } = useFirebaseAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [userSubscription, setUserSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [subsData, userSubData] = await Promise.all([
        SubscriptionService.getActiveSubscriptions(),
        SubscriptionService.getUserSubscription(user?.uid || "")
      ]);

      setSubscriptions(subsData || []);
      setUserSubscription(userSubData);
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseSubscription = async (subscriptionId: string, months: number = 1) => {
    setPurchasing(subscriptionId);

    try {
      const result = await SubscriptionService.purchaseSubscription(
        user?.uid || "",
        subscriptionId,
        months
      );

      if (result) {
        toast({
          title: "✅ Подписка оформлена!",
          description: `Подписка активна на ${months} месяц(ев)`,
        });
        await loadData();
      } else {
        throw new Error("Не удалось оформить подписку");
      }
    } catch (error) {
      toast({
        title: "❌ Ошибка",
        description: "Не удалось оформить подписку. Попробуйте позже.",
        variant: "destructive",
      });
    } finally {
      setPurchasing(null);
    }
  };

  const handleStartTrial = async (subscriptionId: string) => {
    try {
      const result = await SubscriptionService.startTrial({
        user_id: user?.uid || "",
        subscription_id: subscriptionId
      });

      if (result) {
        toast({
          title: "🎁 Trial активирован!",
          description: "Пробный период активирован на 7 дней",
        });
        await loadData();
      } else {
        throw new Error("Не удалось активировать trial");
      }
    } catch (error) {
      toast({
        title: "❌ Ошибка",
        description: "Не удалось активировать trial. Возможно вы уже использовали пробный период.",
        variant: "destructive",
      });
    }
  };

  const getSubscriptionIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'basic':
        return <Star className="w-6 h-6" />;
      case 'pro':
        return <Shield className="w-6 h-6" />;
      case 'elite':
        return <Crown className="w-6 h-6" />;
      default:
        return <Star className="w-6 h-6" />;
    }
  };

  const getSubscriptionColor = (name: string) => {
    switch (name.toLowerCase()) {
      case 'basic':
        return 'border-gray-200 bg-gray-50';
      case 'pro':
        return 'border-blue-200 bg-blue-50';
      case 'elite':
        return 'border-purple-200 bg-purple-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const isSubscriptionActive = (subscriptionId: string) => {
    return userSubscription?.subscription_id?.toString() === subscriptionId && 
           userSubscription?.status === 'active' &&
           new Date(userSubscription.subscription_expires_at || '') > new Date();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Подписки</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Current Subscription */}
        {userSubscription && userSubscription.status === 'active' && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-green-800">
                    🎉 У вас активна подписка: {userSubscription.subscription?.name}
                  </h3>
                  <p className="text-sm text-green-600">
                    Действует до: {new Date(userSubscription.subscription_expires_at || '').toLocaleDateString('ru-RU')}
                  </p>
                  <p className="text-sm text-green-600">
                    Комиссия: {userSubscription.subscription?.commission_percent}%
                  </p>
                </div>
                <Badge className="bg-green-500 text-white">
                  Активна
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Subscriptions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {subscriptions.map((subscription) => {
            const isActive = isSubscriptionActive(subscription.id);
            const isPopular = subscription.name.toLowerCase() === 'pro';
            
            return (
              <Card 
                key={subscription.id} 
                className={`relative ${getSubscriptionColor(subscription.name)} ${
                  isActive ? 'ring-2 ring-green-500' : ''
                } ${isPopular ? 'border-2 border-blue-500' : ''}`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-blue-500 text-white">
                      Популярный
                    </Badge>
                  </div>
                )}
                
                {isActive && (
                  <div className="absolute -top-3 right-4">
                    <Badge className="bg-green-500 text-white">
                      Активна
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center">
                  <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    {getSubscriptionIcon(subscription.name)}
                  </div>
                  <CardTitle className="text-xl">{subscription.name}</CardTitle>
                  <CardDescription>
                    Комиссия: {subscription.commission_percent}%
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Price */}
                  <div className="text-center">
                    <div className="text-3xl font-bold">
                      {(subscription.monthly_price / 1000000).toFixed(1)}M UZS
                    </div>
                    <p className="text-sm text-muted-foreground">в месяц</p>
                  </div>

                  {/* Features */}
                  <div className="space-y-2">
                    {subscription.features && Object.entries(subscription.features).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        <span className="text-sm">{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Trial Info */}
                  {subscription.trial_enabled && !userSubscription && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Gift className="w-4 h-4 text-yellow-600" />
                        <span className="text-yellow-800">
                          Пробный период: {subscription.trial_days} дней
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    {isActive ? (
                      <Button className="w-full" disabled>
                        <Check className="w-4 h-4 mr-2" />
                        Активна
                      </Button>
                    ) : (
                      <>
                        {subscription.trial_enabled && !userSubscription && (
                          <Button 
                            variant="outline" 
                            className="w-full"
                            onClick={() => handleStartTrial(subscription.id)}
                          >
                            <Gift className="w-4 h-4 mr-2" />
                            Попробовать бесплатно
                          </Button>
                        )}
                        
                        <div className="grid grid-cols-2 gap-2">
                          <Button 
                            size="sm"
                            onClick={() => handlePurchaseSubscription(subscription.id, 1)}
                            disabled={purchasing === subscription.id}
                          >
                            {purchasing === subscription.id ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              '1 мес'
                            )}
                          </Button>
                          
                          <Button 
                            size="sm"
                            variant="outline"
                            onClick={() => handlePurchaseSubscription(subscription.id, 3)}
                            disabled={purchasing === subscription.id}
                          >
                            {purchasing === subscription.id ? (
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              '3 мес'
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Info Section */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <Crown className="w-5 h-5 text-primary" />
                Преимущества подписки
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Сниженная комиссия на все сделки</li>
                <li>• Приоритетная поддержка</li>
                <li>• Доступ к расширенной аналитике</li>
                <li>• Быстрый вывод средств без комиссии</li>
                <li>• Повышенная видимость в поиске</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Оплата и безопасность
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Оплата через надежные платежные системы</li>
                <li>• Автоматическое продление подписки</li>
                <li>• Отмена в любой момент</li>
                <li>• Возврат средств за неиспользованный период</li>
                <li>• Защита данных и конфиденциальность</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default SubscriptionsPage;
