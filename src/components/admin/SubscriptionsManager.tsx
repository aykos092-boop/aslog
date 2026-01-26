import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Crown, Edit, Loader2, Plus, Trash2, Users, DollarSign, Gift, X } from "lucide-react";

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
  role?: string;
}

interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  current_period_end: string;
  plan?: SubscriptionPlan;
  profiles?: {
    full_name: string | null;
    role: string;
  };
}

export const SubscriptionsManager = () => {
  const { toast } = useToast();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    display_name: "",
    description: "",
    price_monthly: 0,
    price_yearly: 0,
    features: "",
    is_active: true,
    role: "",
  });
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [subscriptionDuration, setSubscriptionDuration] = useState<string>("30");
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchData();
    fetchUsers();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: plansData } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("price_monthly", { ascending: true });

      if (plansData) {
        setPlans(
          plansData.map((p) => ({
            ...p,
            features: Array.isArray(p.features)
              ? p.features
              : typeof p.features === "string"
              ? JSON.parse(p.features)
              : [],
          })) as SubscriptionPlan[]
        );
      }

      const { data: subsData } = await supabase
        .from("user_subscriptions")
        .select(`
          *,
          plan:subscription_plans(*),
          profiles(full_name, role)
        `)
        .order("created_at", { ascending: false });

      if (subsData) {
        setSubscriptions(subsData as any);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить данные",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .order("full_name", { ascending: true });
      
      if (data) {
        setAllUsers(data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleOpenDialog = (plan?: SubscriptionPlan) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        name: plan.name,
        display_name: plan.display_name,
        description: plan.description || "",
        price_monthly: plan.price_monthly,
        price_yearly: plan.price_yearly,
        features: plan.features.join("\n"),
        is_active: plan.is_active,
        role: plan.role || "",
      });
    } else {
      setEditingPlan(null);
      setFormData({
        name: "",
        display_name: "",
        description: "",
        price_monthly: 0,
        price_yearly: 0,
        features: "",
        is_active: true,
        role: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSavePlan = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Ошибка", description: "Введите ID плана", variant: "destructive" });
      return;
    }
    if (!formData.display_name.trim()) {
      toast({ title: "Ошибка", description: "Введите название плана", variant: "destructive" });
      return;
    }
    if (formData.price_monthly < 0 || formData.price_yearly < 0) {
      toast({ title: "Ошибка", description: "Цена не может быть отрицательной", variant: "destructive" });
      return;
    }

    try {
      const featuresArray = formData.features.split("\n").filter((f) => f.trim()).map((f) => f.trim());

      if (featuresArray.length === 0) {
        toast({ title: "Ошибка", description: "Добавьте хотя бы одну функцию", variant: "destructive" });
        return;
      }

      const planData = {
        name: formData.name.trim().toLowerCase(),
        display_name: formData.display_name.trim(),
        description: formData.description.trim() || null,
        price_monthly: formData.price_monthly,
        price_yearly: formData.price_yearly,
        features: featuresArray,
        is_active: formData.is_active,
        role: formData.role || null,
      };

      if (editingPlan) {
        const { error } = await supabase.from("subscription_plans").update(planData).eq("id", editingPlan.id);
        if (error) throw error;
        toast({ title: "Успешно", description: "План обновлен" });
      } else {
        const { error } = await supabase.from("subscription_plans").insert([planData]);
        if (error) throw error;
        toast({ title: "Успешно", description: "План создан" });
      }

      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error saving plan:", error);
      toast({ title: "Ошибка", description: error.message || "Не удалось сохранить план", variant: "destructive" });
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm("Вы уверены, что хотите удалить этот план?")) return;
    try {
      await supabase.from("subscription_plans").delete().eq("id", planId);
      toast({ title: "Успешно", description: "План удален" });
      fetchData();
    } catch (error) {
      console.error("Error deleting plan:", error);
      toast({ title: "Ошибка", description: "Не удалось удалить план", variant: "destructive" });
    }
  };

  const handleAssignSubscription = async () => {
    if (!selectedUser || !selectedPlanId) {
      toast({ title: "Ошибка", description: "Выберите пользователя и план", variant: "destructive" });
      return;
    }

    try {
      const days = parseInt(subscriptionDuration);
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() + days);

      const { data: existing } = await supabase.from("user_subscriptions").select("id").eq("user_id", selectedUser).eq("status", "active").maybeSingle();

      if (existing) {
        await supabase.from("user_subscriptions").update({ status: "cancelled" }).eq("id", existing.id);
      }

      const { error } = await supabase.from("user_subscriptions").insert({
        user_id: selectedUser,
        plan_id: selectedPlanId,
        status: "active",
        current_period_end: periodEnd.toISOString(),
      });

      if (error) throw error;

      toast({ title: "Успешно", description: "Подписка выдана" });
      setIsAssignDialogOpen(false);
      setSelectedUser("");
      setSelectedPlanId("");
      setSubscriptionDuration("30");
      fetchData();
    } catch (error) {
      console.error("Error assigning subscription:", error);
      toast({ title: "Ошибка", description: "Не удалось выдать подписку", variant: "destructive" });
    }
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    if (!confirm("Вы уверены, что хотите отменить подписку?")) return;
    try {
      await supabase.from("user_subscriptions").update({ status: "cancelled", cancel_at_period_end: true }).eq("id", subscriptionId);
      toast({ title: "Успешно", description: "Подписка отменена" });
      fetchData();
    } catch (error) {
      console.error("Error canceling subscription:", error);
      toast({ title: "Ошибка", description: "Не удалось отменить подписку", variant: "destructive" });
    }
  };

  const filteredUsers = allUsers.filter((user) =>
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.role?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary" />
              Планы подписок
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Управление тарифными планами</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="w-4 h-4" />
              Создать план
            </Button>
            <Button onClick={() => setIsAssignDialogOpen(true)} variant="outline" className="gap-2">
              <Gift className="w-4 h-4" />
              Выдать подписку
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <Card key={plan.id} className="relative">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{plan.display_name}</CardTitle>
                      {plan.role && (
                        <Badge variant="outline" className="mt-1 capitalize">{plan.role}</Badge>
                      )}
                    </div>
                    <Badge variant={plan.is_active ? "default" : "secondary"}>
                      {plan.is_active ? "Активен" : "Неактивен"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">{plan.price_monthly.toLocaleString()}</span>
                    <span className="text-muted-foreground">₸/мес</span>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {plan.features.slice(0, 3).map((feature, i) => (
                      <li key={i} className="text-muted-foreground">• {feature}</li>
                    ))}
                    {plan.features.length > 3 && (
                      <li className="text-xs text-muted-foreground">+{plan.features.length - 3} больше</li>
                    )}
                  </ul>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={() => handleOpenDialog(plan)} className="flex-1 gap-2">
                      <Edit className="w-3 h-3" />
                      Изменить
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeletePlan(plan.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Активные подписки ({subscriptions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Пользователь</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead>План</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Действует до</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Нет активных подписок</TableCell>
                  </TableRow>
                ) : (
                  subscriptions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">{sub.profiles?.full_name || "Без имени"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{sub.profiles?.role || "user"}</Badge>
                      </TableCell>
                      <TableCell>{sub.plan?.display_name || "Неизвестно"}</TableCell>
                      <TableCell>
                        <Badge variant={sub.status === "active" ? "default" : sub.status === "cancelled" ? "destructive" : "secondary"}>
                          {sub.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(sub.current_period_end).toLocaleDateString("ru-RU")}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => handleCancelSubscription(sub.id)} disabled={sub.status !== "active"}>
                          <X className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Редактировать план" : "Создать план"}</DialogTitle>
            <DialogDescription>Настройте параметры тарифного плана</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ID плана</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="basic, pro, enterprise" />
              </div>
              <div className="space-y-2">
                <Label>Название</Label>
                <Input value={formData.display_name} onChange={(e) => setFormData({ ...formData, display_name: e.target.value })} placeholder="Basic, Pro, Enterprise" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Описание</Label>
              <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Описание плана" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Цена (месяц)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="number" value={formData.price_monthly} onChange={(e) => setFormData({ ...formData, price_monthly: parseFloat(e.target.value) || 0 })} className="pl-9" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Цена (год)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="number" value={formData.price_yearly} onChange={(e) => setFormData({ ...formData, price_yearly: parseFloat(e.target.value) || 0 })} className="pl-9" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Роль (опционально)</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите роль" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Без роли</SelectItem>
                  <SelectItem value="client">Клиент</SelectItem>
                  <SelectItem value="carrier">Перевозчик</SelectItem>
                  <SelectItem value="admin">Админ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Функции (каждая с новой строки)</Label>
              <Textarea value={formData.features} onChange={(e) => setFormData({ ...formData, features: e.target.value })} placeholder="Функция 1&#10;Функция 2&#10;Функция 3" rows={6} />
            </div>
            <div className="flex items-center space-x-2">
              <Switch checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
              <Label>Активный план</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleSavePlan}>{editingPlan ? "Сохранить" : "Создать"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Выдать подписку</DialogTitle>
            <DialogDescription>Назначить план подписки пользователю</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Пользователь</Label>
              <Input placeholder="Поиск по имени или роли" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="mb-2" />
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите пользователя" />
                </SelectTrigger>
                <SelectContent>
                  {filteredUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>{user.full_name || "Без имени"} ({user.role || "user"})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>План подписки</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите план" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>{plan.display_name} ({plan.price_monthly}₸/мес)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Длительность (дней)</Label>
              <Select value={subscriptionDuration} onValueChange={setSubscriptionDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 дней</SelectItem>
                  <SelectItem value="14">14 дней</SelectItem>
                  <SelectItem value="30">30 дней (1 месяц)</SelectItem>
                  <SelectItem value="90">90 дней (3 месяца)</SelectItem>
                  <SelectItem value="180">180 дней (6 месяцев)</SelectItem>
                  <SelectItem value="365">365 дней (1 год)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleAssignSubscription}>
              <Gift className="w-4 h-4 mr-2" />
              Выдать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
