import { useEffect, useState } from "react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import { 
  TrendingUp, Package, Truck, Users, Star, Loader2, 
  ArrowUpRight, ArrowDownRight 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

interface Stats {
  totalOrders: number;
  totalDeals: number;
  totalUsers: number;
  avgRating: number;
  totalRevenue: number;
  ordersThisWeek: number;
  ordersLastWeek: number;
}

interface DailyData {
  date: string;
  orders: number;
  deals: number;
}

interface StatusData {
  name: string;
  value: number;
  color: string;
}

const COLORS = {
  pending: "hsl(var(--muted-foreground))",
  accepted: "hsl(var(--customer))",
  in_transit: "hsl(var(--driver))",
  delivered: "hsl(var(--gold))",
  cancelled: "hsl(var(--destructive))",
};

export const AnalyticsCharts = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [statusData, setStatusData] = useState<StatusData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);

      // Fetch counts
      const [ordersRes, dealsRes, usersRes, ratingsRes] = await Promise.all([
        supabase.from("orders").select("id, created_at", { count: "exact" }),
        supabase.from("deals").select("id, status, agreed_price, created_at", { count: "exact" }),
        supabase.from("profiles").select("id", { count: "exact" }),
        supabase.from("ratings").select("score"),
      ]);

      const orders = ordersRes.data || [];
      const deals = dealsRes.data || [];
      const ratings = ratingsRes.data || [];

      // Calculate stats
      const avgRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
        : 0;

      const totalRevenue = deals
        .filter((d: any) => d.status === "delivered")
        .reduce((sum: number, d: any) => sum + Number(d.agreed_price), 0);

      // Orders this week vs last week
      const now = new Date();
      const weekAgo = subDays(now, 7);
      const twoWeeksAgo = subDays(now, 14);

      const ordersThisWeek = orders.filter(
        o => new Date(o.created_at) >= weekAgo
      ).length;

      const ordersLastWeek = orders.filter(
        o => new Date(o.created_at) >= twoWeeksAgo && new Date(o.created_at) < weekAgo
      ).length;

      setStats({
        totalOrders: ordersRes.count || 0,
        totalDeals: dealsRes.count || 0,
        totalUsers: usersRes.count || 0,
        avgRating: Math.round(avgRating * 10) / 10,
        totalRevenue,
        ordersThisWeek,
        ordersLastWeek,
      });

      // Daily data for last 7 days
      const daily: DailyData[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = subDays(now, i);
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);

        const dayOrders = orders.filter(o => {
          const created = new Date(o.created_at);
          return created >= dayStart && created <= dayEnd;
        }).length;

        const dayDeals = deals.filter((d: any) => {
          const created = new Date(d.created_at);
          return created >= dayStart && created <= dayEnd;
        }).length;

        daily.push({
          date: format(date, "dd.MM", { locale: ru }),
          orders: dayOrders,
          deals: dayDeals,
        });
      }
      setDailyData(daily);

      // Status distribution
      const statusCounts: Record<string, number> = {
        pending: 0,
        accepted: 0,
        in_transit: 0,
        delivered: 0,
        cancelled: 0,
      };

      deals.forEach((d: any) => {
        if (statusCounts[d.status] !== undefined) {
          statusCounts[d.status]++;
        }
      });

      const statusLabels: Record<string, string> = {
        pending: "Ожидает",
        accepted: "Принята",
        in_transit: "В пути",
        delivered: "Доставлено",
        cancelled: "Отменена",
      };

      setStatusData(
        Object.entries(statusCounts)
          .filter(([_, value]) => value > 0)
          .map(([key, value]) => ({
            name: statusLabels[key],
            value,
            color: COLORS[key as keyof typeof COLORS],
          }))
      );

      setLoading(false);
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Загрузка аналитики...</p>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const weekGrowth = stats.ordersLastWeek > 0
    ? Math.round(((stats.ordersThisWeek - stats.ordersLastWeek) / stats.ordersLastWeek) * 100)
    : stats.ordersThisWeek > 0 ? 100 : 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Package className="w-5 h-5 text-muted-foreground" />
              {weekGrowth >= 0 ? (
                <span className="text-xs text-green-500 flex items-center">
                  <ArrowUpRight className="w-3 h-3" />
                  {weekGrowth}%
                </span>
              ) : (
                <span className="text-xs text-red-500 flex items-center">
                  <ArrowDownRight className="w-3 h-3" />
                  {Math.abs(weekGrowth)}%
                </span>
              )}
            </div>
            <div className="text-2xl font-bold mt-2">{stats.totalOrders}</div>
            <p className="text-sm text-muted-foreground">Заявок</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <Truck className="w-5 h-5 text-muted-foreground" />
            <div className="text-2xl font-bold mt-2">{stats.totalDeals}</div>
            <p className="text-sm text-muted-foreground">Сделок</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <Users className="w-5 h-5 text-muted-foreground" />
            <div className="text-2xl font-bold mt-2">{stats.totalUsers}</div>
            <p className="text-sm text-muted-foreground">Пользователей</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <Star className="w-5 h-5 text-gold" />
            <div className="text-2xl font-bold mt-2">{stats.avgRating || "—"}</div>
            <p className="text-sm text-muted-foreground">Средний рейтинг</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <div className="text-2xl font-bold mt-2">
              {stats.totalRevenue.toLocaleString()} ₽
            </div>
            <p className="text-sm text-muted-foreground">Выручка</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Daily Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Активность за неделю</CardTitle>
            <CardDescription>Заявки и сделки по дням</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                orders: { label: "Заявки", color: "hsl(var(--customer))" },
                deals: { label: "Сделки", color: "hsl(var(--driver))" },
              }}
              className="h-64"
            >
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="orders" fill="hsl(var(--customer))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="deals" fill="hsl(var(--driver))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Статусы сделок</CardTitle>
            <CardDescription>Распределение по статусам</CardDescription>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Нет данных для отображения
              </div>
            ) : (
              <ChartContainer config={{}} className="h-64">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            )}
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {statusData.map((item) => (
                <div key={item.name} className="flex items-center gap-2 text-sm">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span>{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
