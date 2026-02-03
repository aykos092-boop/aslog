import { useState, useEffect } from "react";
import { 
  TrendingUp, DollarSign, Users, CreditCard, 
  Settings, Download, Upload, Gift, Target,
  AlertCircle, CheckCircle, Clock, ArrowUpRight,
  ArrowDownRight, Wallet, FileText, Shield, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AdminMonetizationService } from "@/modules/admin-monetization/admin.service";
import { CommissionService } from "@/modules/commission/commission.service";
import { SubscriptionService } from "@/modules/subscriptions/subscriptions.service";

interface AdminStats {
  total_users: number;
  active_subscriptions: number;
  trial_users: number;
  total_revenue: number;
  monthly_revenue: number;
  total_transactions: number;
  frozen_funds: number;
  commission_this_month: number;
}

interface PlatformIncomeReport {
  source: string;
  amount: number;
  count: number;
  percentage: number;
}

const MonetizationDashboard = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [incomeReport, setIncomeReport] = useState<PlatformIncomeReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalCommission, setGlobalCommission] = useState(5);
  const [commissionEnabled, setCommissionEnabled] = useState(true);
  const [autoTrialEnabled, setAutoTrialEnabled] = useState(true);
  const [customCommissionUserId, setCustomCommissionUserId] = useState("");
  const [customCommissionValue, setCustomCommissionValue] = useState("");
  const [freeSubscriptionUserId, setFreeSubscriptionUserId] = useState("");
  const [selectedSubscription, setSelectedSubscription] = useState("");
  const [freeMonths, setFreeMonths] = useState("1");
  const [addBalanceUserId, setAddBalanceUserId] = useState("");
  const [addBalanceAmount, setAddBalanceAmount] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsData, incomeData, settings] = await Promise.all([
        AdminMonetizationService.getMonetizationStats(),
        AdminMonetizationService.getPlatformIncomeReport(),
        CommissionService.getPlatformSettings()
      ]);

      setStats(statsData);
      setIncomeReport(incomeData || []);
      setGlobalCommission(settings?.global_commission_percent || 5);
      setCommissionEnabled(settings?.commission_enabled || true);
      setAutoTrialEnabled(settings?.auto_trial_enabled || true);
    } catch (error) {
      console.error('Error loading monetization data:', error);
      // Устанавливаем значения по умолчанию при ошибке
      setStats(null);
      setIncomeReport([]);
      setGlobalCommission(5);
      setCommissionEnabled(true);
      setAutoTrialEnabled(true);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGlobalCommission = async () => {
    try {
      const success = await AdminMonetizationService.updateGlobalCommission(globalCommission);
      if (success) {
        alert('Глобальная комиссия обновлена');
        loadData();
      }
    } catch (error) {
      alert('Ошибка при обновлении комиссии');
    }
  };

  const handleToggleCommission = async () => {
    try {
      const success = await AdminMonetizationService.toggleCommissionSystem(!commissionEnabled);
      if (success) {
        setCommissionEnabled(!commissionEnabled);
        alert(`Система комиссий ${!commissionEnabled ? 'включена' : 'выключена'}`);
      }
    } catch (error) {
      alert('Ошибка при изменении системы комиссий');
    }
  };

  const handleSetCustomCommission = async () => {
    if (!customCommissionUserId || !customCommissionValue) {
      alert('Заполните все поля');
      return;
    }

    try {
      const success = await AdminMonetizationService.setUserCustomCommission(
        customCommissionUserId,
        parseFloat(customCommissionValue)
      );
      if (success) {
        alert('Индивидуальная комиссия установлена');
        setCustomCommissionUserId('');
        setCustomCommissionValue('');
        loadData();
      }
    } catch (error) {
      alert('Ошибка при установке комиссии');
    }
  };

  const handleGrantFreeSubscription = async () => {
    if (!freeSubscriptionUserId || !selectedSubscription) {
      alert('Заполните все поля');
      return;
    }

    try {
      const success = await AdminMonetizationService.grantFreeSubscription(
        freeSubscriptionUserId,
        selectedSubscription,
        parseInt(freeMonths)
      );
      if (success) {
        alert('Бесплатная подписка выдана');
        setFreeSubscriptionUserId('');
        setSelectedSubscription('');
        setFreeMonths('1');
        loadData();
      }
    } catch (error) {
      alert('Ошибка при выдаче подписки');
    }
  };

  const handleAddBalance = async () => {
    if (!addBalanceUserId || !addBalanceAmount) {
      alert('Заполните все поля');
      return;
    }

    try {
      const success = await AdminMonetizationService.addUserBalance(
        addBalanceUserId,
        parseFloat(addBalanceAmount),
        'Пополнение админом'
      );
      if (success) {
        alert('Баланс пополнен');
        setAddBalanceUserId('');
        setAddBalanceAmount('');
        loadData();
      }
    } catch (error) {
      alert('Ошибка при пополнении баланса');
    }
  };

  const handleExportData = async (format: 'csv' | 'json') => {
    try {
      const data = await AdminMonetizationService.exportUserData(format);
      const blob = new Blob([data], { 
        type: format === 'csv' ? 'text/csv' : 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Ошибка при экспорте данных');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего пользователей</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_users || 0}</div>
            <p className="text-xs text-muted-foreground">
              Активные подписки: {stats?.active_subscriptions || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Общий доход</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((stats?.total_revenue || 0) / 1000000).toFixed(1)}M UZS
            </div>
            <p className="text-xs text-muted-foreground">
              За месяц: {((stats?.monthly_revenue || 0) / 1000000).toFixed(1)}M UZS
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Заморожено средств</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((stats?.frozen_funds || 0) / 1000000).toFixed(1)}M UZS
            </div>
            <p className="text-xs text-muted-foreground">
              Комиссия за месяц: {((stats?.commission_this_month || 0) / 1000000).toFixed(1)}M UZS
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trial пользователи</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.trial_users || 0}</div>
            <p className="text-xs text-muted-foreground">
              Всего транзакций: {stats?.total_transactions || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Источники дохода */}
      <Card>
        <CardHeader>
          <CardTitle>Источники дохода</CardTitle>
          <CardDescription>Распределение доходов по источникам за последний месяц</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {incomeReport.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-primary"></div>
                  <span className="text-sm font-medium capitalize">
                    {item.source === 'commission' ? 'Комиссии' :
                     item.source === 'subscription' ? 'Подписки' :
                     item.source === 'fast_withdraw' ? 'Быстрый вывод' :
                     item.source === 'promotion' ? 'Продвижение' : item.source}
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm">
                    {(item.amount / 1000000).toFixed(2)}M UZS
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.count} операций
                  </span>
                  <Badge variant="secondary">
                    {item.percentage.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Управление */}
      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">Настройки</TabsTrigger>
          <TabsTrigger value="users">Пользователи</TabsTrigger>
          <TabsTrigger value="subscriptions">Подписки</TabsTrigger>
          <TabsTrigger value="export">Экспорт</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Глобальные настройки</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="commission-enabled">Система комиссий</Label>
                  <Switch
                    id="commission-enabled"
                    checked={commissionEnabled}
                    onCheckedChange={handleToggleCommission}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="global-commission">Глобальная комиссия (%)</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="global-commission"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={globalCommission}
                      onChange={(e) => setGlobalCommission(parseFloat(e.target.value))}
                    />
                    <Button onClick={handleUpdateGlobalCommission}>
                      Обновить
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-trial">Автоматический trial</Label>
                  <Switch
                    id="auto-trial"
                    checked={autoTrialEnabled}
                    onCheckedChange={setAutoTrialEnabled}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Быстрые действия</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => handleExportData('csv')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Экспорт пользователей (CSV)
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => handleExportData('json')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Экспорт пользователей (JSON)
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={loadData}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Обновить данные
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Установить индивидуальную комиссию</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="custom-user-id">ID пользователя</Label>
                  <Input
                    id="custom-user-id"
                    value={customCommissionUserId}
                    onChange={(e) => setCustomCommissionUserId(e.target.value)}
                    placeholder="UUID пользователя"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-commission">Комиссия (%)</Label>
                  <Input
                    id="custom-commission"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={customCommissionValue}
                    onChange={(e) => setCustomCommissionValue(e.target.value)}
                    placeholder="2.5"
                  />
                </div>
                <Button onClick={handleSetCustomCommission} className="w-full">
                  Установить комиссию
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Пополнить баланс</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="balance-user-id">ID пользователя</Label>
                  <Input
                    id="balance-user-id"
                    value={addBalanceUserId}
                    onChange={(e) => setAddBalanceUserId(e.target.value)}
                    placeholder="UUID пользователя"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="balance-amount">Сумма (UZS)</Label>
                  <Input
                    id="balance-amount"
                    type="number"
                    min="0"
                    value={addBalanceAmount}
                    onChange={(e) => setAddBalanceAmount(e.target.value)}
                    placeholder="100000"
                  />
                </div>
                <Button onClick={handleAddBalance} className="w-full">
                  Пополнить баланс
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Выдать бесплатную подписку</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="free-user-id">ID пользователя</Label>
                  <Input
                    id="free-user-id"
                    value={freeSubscriptionUserId}
                    onChange={(e) => setFreeSubscriptionUserId(e.target.value)}
                    placeholder="UUID пользователя"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="free-subscription">Подписка</Label>
                  <Select value={selectedSubscription} onValueChange={setSelectedSubscription}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите подписку" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="elite">Elite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="free-months">Количество месяцев</Label>
                  <Input
                    id="free-months"
                    type="number"
                    min="1"
                    max="12"
                    value={freeMonths}
                    onChange={(e) => setFreeMonths(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleGrantFreeSubscription} className="w-full">
                    <Gift className="w-4 h-4 mr-2" />
                    Выдать подписку
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Экспорт данных</CardTitle>
              <CardDescription>
                Экспортируйте данные пользователей для анализа
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button 
                  variant="outline" 
                  className="w-full justify-start h-20"
                  onClick={() => handleExportData('csv')}
                >
                  <div className="text-left">
                    <div className="flex items-center mb-2">
                      <Download className="w-4 h-4 mr-2" />
                      <span className="font-medium">CSV формат</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Для Excel и Google Sheets
                    </span>
                  </div>
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start h-20"
                  onClick={() => handleExportData('json')}
                >
                  <div className="text-left">
                    <div className="flex items-center mb-2">
                      <Download className="w-4 h-4 mr-2" />
                      <span className="font-medium">JSON формат</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Для программной обработки
                    </span>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MonetizationDashboard;
