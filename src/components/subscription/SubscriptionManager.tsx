import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Crown, Check, CreditCard, Loader2, Sparkles, 
  Zap, Building2, AlertCircle, ExternalLink, Star, Lock, Shield, MessageSquare, BarChart3, Navigation
} from "lucide-react";
import { PaymentModal } from "@/components/payment/PaymentModal";

interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  features: string[];
  is_active: boolean;
}

const PLAN_ICONS: Record<string, typeof Crown> = {
  basic: Zap,
  pro: Crown,
  enterprise: Building2,
};

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('uz-UZ', {
    style: 'currency',
    currency: 'UZS',
    minimumFractionDigits: 0,
  }).format(price);
};

export const SubscriptionManager = () => {
  const { user } = useFirebaseAuth();
  const { toast } = useToast();
  
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);

  useEffect(() => {
    fetchPlans();
    fetchCurrentSubscription();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data: plansData } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true });

      if (plansData) {
        setPlans(plansData.map(p => ({
          ...p,
          features: Array.isArray(p.features) ? p.features : (typeof p.features === 'object' ? p.features : [])
        })) as SubscriptionPlan[]);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentSubscription = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans (
            name,
            display_name
          )
        `)
        .eq('user_id', user.uid)
        .eq('status', 'active')
        .maybeSingle();

      setCurrentSubscription(data);
    } catch (error) {
      console.error('Error fetching subscription:', error);
    }
  };

  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    if (plan.name === 'basic' || plan.price_monthly === 0) {
      await subscribeToFreePlan(plan);
    } else {
      setSelectedPlan(plan);
      setIsPaymentModalOpen(true);
    }
  };

  const subscribeToFreePlan = async (plan: SubscriptionPlan) => {
    if (!user) return;

    try {
      const periodEnd = new Date();
      periodEnd.setFullYear(periodEnd.getFullYear() + 100);

      await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: user.uid,
          plan_id: plan.name,
          status: 'active',
          current_period_end: periodEnd.toISOString(),
        }, {
          onConflict: 'user_id'
        });

      toast({
        title: "Подписка активирована!",
        description: `Вы перешли на план ${plan.display_name || plan.name}`,
      });

      fetchCurrentSubscription();
    } catch (error) {
      console.error('Subscription error:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось оформить подписку",
        variant: "destructive"
      });
    }
  };

  const getFeatureIcon = (feature: string) => {
    if (feature.includes('заказ')) return <CreditCard className="w-5 h-5" />;
    if (feature.includes('поддержк')) return <MessageSquare className="w-5 h-5" />;
    if (feature.includes('аналитик')) return <BarChart3 className="w-5 h-5" />;
    if (feature.includes('GPS') || feature.includes('трекинг')) return <Navigation className="w-5 h-5" />;
    if (feature.includes('AI') || feature.includes('чат')) return <MessageSquare className="w-5 h-5" />;
    if (feature.includes('API')) return <Shield className="w-5 h-5" />;
    if (feature.includes('менеджер')) return <Star className="w-5 h-5" />;
    return <Check className="w-5 h-5" />;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        </CardContent>
      </Card>
    );
  }

  const currentPlanName = currentSubscription?.subscription_plans?.name || 'basic';

  return (
    <div className="space-y-6">
      {/* Current subscription status */}
      {currentSubscription && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-primary" />
                Текущий план
              </CardTitle>
              <Badge className="bg-primary text-primary-foreground">
                {currentSubscription.subscription_plans?.display_name || 'Базовый'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Статус</span>
                <p className="font-medium">
                  {currentSubscription.status === 'active' ? 'Активна' : 'Ожидает'}
                </p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">План</span>
                <p className="font-medium capitalize">{currentSubscription.subscription_plans?.display_name || 'Базовый'}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Действует до</span>
                <p className="font-medium">
                  {currentSubscription.current_period_end ? 
                    new Date(currentSubscription.current_period_end).toLocaleDateString('ru-RU') : 
                    'Бессрочно'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Billing period toggle */}
      <div className="flex justify-center">
        <Tabs value={billingPeriod} onValueChange={(v) => setBillingPeriod(v as 'monthly' | 'yearly')}>
          <TabsList>
            <TabsTrigger value="monthly">Ежемесячно</TabsTrigger>
            <TabsTrigger value="yearly" className="relative">
              Ежегодно
              <Badge className="absolute -top-2 -right-2 bg-green-500 text-white text-xs">
                -17%
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const PlanIcon = PLAN_ICONS[plan.name] || Zap;
          const isCurrentPlan = plan.name === currentPlanName;
          const price = billingPeriod === 'monthly' ? plan.price_monthly : plan.price_yearly;
          
          return (
            <Card 
              key={plan.id}
              className={`relative ${
                plan.name === 'pro' 
                  ? 'border-primary shadow-lg scale-105' 
                  : ''
              } ${isCurrentPlan ? 'ring-2 ring-primary' : ''}`}
            >
              {plan.name === 'pro' && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Популярный
                </Badge>
              )}
              
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    plan.name === 'pro' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted'
                  }`}>
                    <PlanIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle>{plan.display_name || plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div>
                  <span className="text-3xl font-bold">
                    {price === 0 ? 'Бесплатно' : formatPrice(price)}
                  </span>
                  {price > 0 && (
                    <span className="text-muted-foreground">/{billingPeriod === 'monthly' ? 'мес' : 'год'}</span>
                  )}
                </div>
                
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {getFeatureIcon(feature)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">{feature}</p>
                        {plan.name !== 'basic' && (
                          <p className="text-xs text-muted-foreground">
                            {feature.includes('заказ') && 'Создавайте безлимитные заказы каждый месяц'}
                            {feature.includes('поддержк') && 'Ответ в течение 15 минут, 24/7'}
                            {feature.includes('аналитик') && 'Детальная статистика и отчеты'}
                            {feature.includes('GPS') && 'Отслеживайте грузы в реальном времени'}
                            {feature.includes('AI') && 'Умный помощник для оптимизации логистики'}
                            {feature.includes('API') && 'Полный доступ к API для интеграций'}
                            {feature.includes('менеджер') && 'Персональный менеджер для вашего бизнеса'}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
              
              <CardFooter>
                <Button 
                  className="w-full"
                  variant={plan.name === 'pro' ? 'default' : 'outline'}
                  disabled={isCurrentPlan}
                  onClick={() => handleSelectPlan(plan)}
                >
                  {isCurrentPlan ? (
                    'Текущий план'
                  ) : plan.price_monthly === 0 ? (
                    'Перейти на бесплатный'
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Оформить
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Features showcase */}
      <Card>
        <CardHeader>
          <CardTitle>Как работают преимущества подписки</CardTitle>
          <CardDescription>
            Все функции активно работают после оформления подписки
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <CreditCard className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="font-semibold">Безлимитные заказы</h4>
                <p className="text-sm text-muted-foreground">
                  Создавайте любое количество заказов в месяц без ограничений
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <MessageSquare className="w-5 h-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-semibold">Приоритетная поддержка</h4>
                <p className="text-sm text-muted-foreground">
                  Быстрая помощь 24/7 с ответом в течение 15 минут
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <BarChart3 className="w-5 h-5 text-purple-500 mt-0.5" />
              <div>
                <h4 className="font-semibold">Расширенная аналитика</h4>
                <p className="text-sm text-muted-foreground">
                  Детальная статистика заказов, доходов и эффективности
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <Navigation className="w-5 h-5 text-orange-500 mt-0.5" />
              <div>
                <h4 className="font-semibold">GPS трекинг</h4>
                <p className="text-sm text-muted-foreground">
                  Отслеживание грузов в реальном времени на карте
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        planName={selectedPlan?.display_name || selectedPlan?.name || ''}
        price={billingPeriod === 'monthly' ? (selectedPlan?.price_monthly || 0) : (selectedPlan?.price_yearly || 0)}
        planId={selectedPlan?.name || ''}
      />
    </div>
  );
};
