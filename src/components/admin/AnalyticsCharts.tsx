import { useEffect, useState } from "react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { 
  TrendingUp, Package, Truck, Users, Star, Loader2, 
  ArrowUpRight, ArrowDownRight, Activity, DollarSign
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
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
  AreaChart,
  Area,
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
  revenue: number;
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
  const { t, language } = useLanguage();
  const [stats, setStats] = useState<Stats | null>(null);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [statusData, setStatusData] = useState<StatusData[]>([]);
  const [loading, setLoading] = useState(true);

  const getDateLocale = () => {
    switch (language) {
      case "en": return enUS;
      default: return ru;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('uz-UZ').format(value);
  };

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);

      const [ordersRes, dealsRes, usersRes, ratingsRes] = await Promise.all([
        supabase.from("orders").select("id, created_at", { count: "exact" }),
        supabase.from("deals").select("id, status, agreed_price, created_at", { count: "exact" }),
        supabase.from("profiles").select("id", { count: "exact" }),
        supabase.from("ratings").select("score"),
      ]);

      const orders = ordersRes.data || [];
      const deals = dealsRes.data || [];
      const ratings = ratingsRes.data || [];

      const avgRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
        : 0;

      const totalRevenue = deals
        .filter((d: any) => d.status === "delivered")
        .reduce((sum: number, d: any) => sum + Number(d.agreed_price), 0);

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
        });

        const dayRevenue = dayDeals
          .filter((d: any) => d.status === "delivered")
          .reduce((sum: number, d: any) => sum + Number(d.agreed_price), 0);

        daily.push({
          date: format(date, "dd.MM", { locale: getDateLocale() }),
          orders: dayOrders,
          deals: dayDeals.length,
          revenue: dayRevenue,
        });
      }
      setDailyData(daily);

      // Status distribution with translated labels
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

      setStatusData(
        Object.entries(statusCounts)
          .filter(([_, value]) => value > 0)
          .map(([key, value]) => ({
            name: t(`deals.status.${key}`),
            value,
            color: COLORS[key as keyof typeof COLORS],
          }))
      );

      setLoading(false);
    };

    fetchAnalytics();
  }, [t, language]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6">
              <div className="w-5 h-5 rounded bg-muted shimmer" />
              <div className="h-8 w-20 mt-2 rounded bg-muted shimmer" />
              <div className="h-4 w-16 mt-1 rounded bg-muted shimmer" />
            </CardContent>
          </Card>
        ))}
      </div>
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
        <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-customer/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Package className="w-5 h-5 text-customer" />
              </div>
              {weekGrowth >= 0 ? (
                <span className="text-xs text-green-500 flex items-center font-medium">
                  <ArrowUpRight className="w-3 h-3" />
                  {weekGrowth}%
                </span>
              ) : (
                <span className="text-xs text-red-500 flex items-center font-medium">
                  <ArrowDownRight className="w-3 h-3" />
                  {Math.abs(weekGrowth)}%
                </span>
              )}
            </div>
            <div className="text-2xl font-bold mt-3">{stats.totalOrders}</div>
            <p className="text-sm text-muted-foreground">{t("admin.totalOrders")}</p>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <CardContent className="pt-6">
            <div className="w-10 h-10 rounded-xl bg-driver/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Truck className="w-5 h-5 text-driver" />
            </div>
            <div className="text-2xl font-bold mt-3">{stats.totalDeals}</div>
            <p className="text-sm text-muted-foreground">{t("admin.totalDeals")}</p>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <CardContent className="pt-6">
            <div className="w-10 h-10 rounded-xl bg-company/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5 text-company" />
            </div>
            <div className="text-2xl font-bold mt-3">{stats.totalUsers}</div>
            <p className="text-sm text-muted-foreground">{t("admin.totalUsers")}</p>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <CardContent className="pt-6">
            <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Star className="w-5 h-5 text-gold" />
            </div>
            <div className="text-2xl font-bold mt-3">{stats.avgRating || "—"}</div>
            <p className="text-sm text-muted-foreground">{t("admin.avgRating")}</p>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 md:col-span-1 col-span-2">
          <CardContent className="pt-6">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <DollarSign className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-2xl font-bold mt-3">
              {formatCurrency(stats.totalRevenue)} <span className="text-sm font-normal text-muted-foreground">{t("common.currency")}</span>
            </div>
            <p className="text-sm text-muted-foreground">{t("admin.revenue")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Daily Activity */}
        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              {t("common.week")}
            </CardTitle>
            <CardDescription>{t("admin.growth")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                orders: { label: t("nav.orders"), color: "hsl(var(--customer))" },
                deals: { label: t("nav.deals"), color: "hsl(var(--driver))" },
              }}
              className="h-64"
            >
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--customer))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--customer))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorDeals" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--driver))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--driver))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area 
                  type="monotone" 
                  dataKey="orders" 
                  stroke="hsl(var(--customer))" 
                  fillOpacity={1} 
                  fill="url(#colorOrders)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="deals" 
                  stroke="hsl(var(--driver))" 
                  fillOpacity={1} 
                  fill="url(#colorDeals)" 
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              {t("admin.deals")}
            </CardTitle>
            <CardDescription>{t("admin.analytics")}</CardDescription>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                {t("dashboard.noDeals")}
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
                    animationBegin={0}
                    animationDuration={800}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            )}
            <div className="flex flex-wrap justify-center gap-3 mt-4">
              {statusData.map((item) => (
                <div key={item.name} className="flex items-center gap-2 text-sm px-3 py-1 rounded-full bg-muted/50">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
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
