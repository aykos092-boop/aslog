import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { 
  Crown, Check, CreditCard, Loader2, Sparkles, 
  Zap, Building2, AlertCircle
} from "lucide-react";

interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  features: string[];
  limits: Record<string, unknown> | null;
  is_active: boolean;
}

interface UserSubscription {
  id: string;
  plan_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string | null;
  payme_subscription_id: string | null;
  plan?: SubscriptionPlan;
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
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [paymentProvider, setPaymentProvider] = useState<'click' | 'payme'>('click');
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPlansAndSubscription();
  }, [user]);

  const fetchPlansAndSubscription = async () => {
    if (!user) return;

    try {
      // Fetch plans
      const { data: plansData } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true });

      if (plansData) {
        setPlans(plansData.map(p => ({
          ...p,
          features: Array.isArray(p.features) ? p.features : (typeof p.features === 'string' ? JSON.parse(p.features) : [])
        })) as SubscriptionPlan[]);
      }

      // Fetch current subscription
      const { data: subData } = await supabase
        .from('user_subscriptions')
        .select('*, plan:subscription_plans(*)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (subData) {
        const plan = subData.plan ? {
          ...subData.plan,
          features: Array.isArray(subData.plan.features) 
            ? subData.plan.features 
            : (typeof subData.plan.features === 'string' ? JSON.parse(subData.plan.features) : [])
        } : undefined;
        
        setCurrentSubscription({
          id: subData.id,
          plan_id: subData.plan_id,
          status: subData.status,
          current_period_start: subData.current_period_start,
          current_period_end: subData.current_period_end,
          cancel_at_period_end: subData.cancel_at_period_end,
          stripe_subscription_id: subData.stripe_subscription_id,
          payme_subscription_id: subData.payme_subscription_id,
          plan: plan as SubscriptionPlan | undefined,
        });
      }
    } catch (error) {
      console.error('Error fetching subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    if (plan.name === 'basic' || plan.price_monthly === 0) {
      // Free plan - just subscribe
      subscribeToPlan(plan, null);
    } else {
      setSelectedPlan(plan);
      setIsPaymentDialogOpen(true);
    }
  };

  const subscribeToPlan = async (plan: SubscriptionPlan, provider: 'click' | 'payme' | null) => {
    if (!user) return;

    setProcessing(true);
    try {
      const periodEnd = new Date();
      if (billingPeriod === 'monthly') {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      } else {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      }

      // Cancel existing subscription if any
      if (currentSubscription) {
        await supabase
          .from('user_subscriptions')
          .update({ status: 'cancelled' })
          .eq('id', currentSubscription.id);
      }

      // Create new subscription
      const { data: newSub, error } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: user.id,
          plan_id: plan.id,
          status: provider ? 'pending' : 'active', // Pending if payment required
          current_period_end: periodEnd.toISOString(),
          payme_subscription_id: provider === 'payme' ? 'pending_' + Date.now() : null,
        })
        .select()
        .single();

      if (error) throw error;

      // If paid plan, show payment message (stub)
      if (provider && newSub) {
        const price = billingPeriod === 'monthly' ? plan.price_monthly : plan.price_yearly;

        toast({
          title: "Перенаправление на оплату",
          description: `Вы будете перенаправлены на ${provider === 'click' ? 'Click' : 'Payme'} для оплаты ${formatPrice(price)}`,
        });

        // Simulate payment success after 2 seconds (STUB)
        setTimeout(async () => {
          await supabase
            .from('user_subscriptions')
            .update({ status: 'active' })
            .eq('id', newSub.id);

          fetchPlansAndSubscription();
          
          toast({
            title: "Подписка активирована!",
            description: `План ${plan.display_name || plan.name} успешно оплачен`,
          });
        }, 2000);
      } else {
        toast({
          title: "Подписка активирована!",
          description: `Вы перешли на план ${plan.display_name || plan.name}`,
        });
        fetchPlansAndSubscription();
      }

      setIsPaymentDialogOpen(false);
    } catch (error) {
      console.error('Subscription error:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось оформить подписку",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
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

  const currentPlanName = currentSubscription?.plan?.name || 'basic';

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
                {currentSubscription.plan?.display_name || currentSubscription.plan?.name || 'Базовый'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Статус</span>
                <Badge variant={currentSubscription.status === 'active' ? 'default' : 'secondary'}>
                  {currentSubscription.status === 'active' ? 'Активна' : 'Ожидает'}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Действует до</span>
                <p className="font-medium">
                  {new Date(currentSubscription.current_period_end).toLocaleDateString('ru-RU')}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Автопродление</span>
                <p className="font-medium">
                  {currentSubscription.cancel_at_period_end ? 'Отключено' : 'Включено'}
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
              <Badge className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] px-1">
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
          const monthlyEquivalent = billingPeriod === 'yearly' ? plan.price_yearly / 12 : plan.price_monthly;
          
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
                <div className="flex items-center gap-2">
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
                    {price === 0 ? 'Бесплатно' : formatPrice(monthlyEquivalent)}
                  </span>
                  {price > 0 && (
                    <span className="text-muted-foreground">/мес</span>
                  )}
                  {billingPeriod === 'yearly' && price > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(price)} в год
                    </p>
                  )}
                </div>
                
                <ul className="space-y-2">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              
              <CardFooter>
                <Button 
                  className="w-full"
                  variant={plan.name === 'pro' ? 'default' : 'outline'}
                  disabled={isCurrentPlan || processing}
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

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Выберите способ оплаты</DialogTitle>
            <DialogDescription>
              {selectedPlan && (
                <>
                  Оплата плана {selectedPlan.display_name || selectedPlan.name} ({billingPeriod === 'monthly' ? 'ежемесячно' : 'ежегодно'})
                  <br />
                  <span className="font-semibold text-foreground">
                    {formatPrice(billingPeriod === 'monthly' ? selectedPlan.price_monthly : selectedPlan.price_yearly)}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <RadioGroup 
            value={paymentProvider} 
            onValueChange={(v) => setPaymentProvider(v as 'click' | 'payme')}
            className="space-y-3"
          >
            <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="click" id="click" />
              <Label htmlFor="click" className="flex items-center gap-3 cursor-pointer flex-1">
                <div className="w-12 h-12 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold">
                  CLICK
                </div>
                <div>
                  <p className="font-medium">Click</p>
                  <p className="text-sm text-muted-foreground">Оплата через Click</p>
                </div>
              </Label>
            </div>
            
            <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="payme" id="payme" />
              <Label htmlFor="payme" className="flex items-center gap-3 cursor-pointer flex-1">
                <div className="w-12 h-12 rounded-lg bg-cyan-500 flex items-center justify-center text-white font-bold text-xs">
                  PAYME
                </div>
                <div>
                  <p className="font-medium">Payme</p>
                  <p className="text-sm text-muted-foreground">Оплата через Payme</p>
                </div>
              </Label>
            </div>
          </RadioGroup>

          <div className="p-3 rounded-lg bg-yellow-50 text-yellow-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-sm">
              Это демо-версия. Реальная оплата не будет произведена.
            </p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
              Отмена
            </Button>
            <Button 
              onClick={() => selectedPlan && subscribeToPlan(selectedPlan, paymentProvider)}
              disabled={processing}
            >
              {processing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Оплатить
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
