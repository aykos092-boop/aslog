import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { KPICard } from "@/components/ui/KPICard";
import { ClientDashboard } from "@/components/client/ClientDashboard";
import { CarrierDashboard } from "@/components/carrier/CarrierDashboard";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Package, Clock, TrendingUp, Star, Shield, ArrowRight, Users, BarChart3, FileText } from "lucide-react";
import { SectionCard, QuickActionCard } from "@/components/ui/SectionCard";
const Dashboard = () => {
  const navigate = useNavigate();
  const {
    user,
    role,
    loading
  } = useAuth();
  const {
    t
  } = useLanguage();
  const [stats, setStats] = useState({
    orders: 0,
    activeDeals: 0,
    completed: 0,
    rating: null as number | null
  });
  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      if (role === "client") {
        const {
          count: ordersCount
        } = await supabase.from("orders").select("*", {
          count: "exact",
          head: true
        }).eq("client_id", user.id);
        const {
          count: activeDealsCount
        } = await supabase.from("deals").select("*", {
          count: "exact",
          head: true
        }).eq("client_id", user.id).in("status", ["pending", "accepted", "in_transit"]);
        const {
          count: completedCount
        } = await supabase.from("deals").select("*", {
          count: "exact",
          head: true
        }).eq("client_id", user.id).eq("status", "delivered");
        const {
          data: ratingsData
        } = await supabase.from("ratings").select("score").eq("rated_id", user.id);
        const avgRating = ratingsData && ratingsData.length > 0 ? ratingsData.reduce((acc, r) => acc + r.score, 0) / ratingsData.length : null;
        setStats({
          orders: ordersCount || 0,
          activeDeals: activeDealsCount || 0,
          completed: completedCount || 0,
          rating: avgRating
        });
      } else if (role === "carrier") {
        const {
          count: openOrdersCount
        } = await supabase.from("orders").select("*", {
          count: "exact",
          head: true
        }).eq("status", "open");
        const {
          count: activeDealsCount
        } = await supabase.from("deals").select("*", {
          count: "exact",
          head: true
        }).eq("carrier_id", user.id).in("status", ["pending", "accepted", "in_transit"]);
        const {
          count: completedCount
        } = await supabase.from("deals").select("*", {
          count: "exact",
          head: true
        }).eq("carrier_id", user.id).eq("status", "delivered");
        const {
          data: ratingsData
        } = await supabase.from("ratings").select("score").eq("rated_id", user.id);
        const avgRating = ratingsData && ratingsData.length > 0 ? ratingsData.reduce((acc, r) => acc + r.score, 0) / ratingsData.length : null;
        setStats({
          orders: openOrdersCount || 0,
          activeDeals: activeDealsCount || 0,
          completed: completedCount || 0,
          rating: avgRating
        });
      }
    };
    fetchStats();
  }, [user, role]);
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);
  if (loading || !user) return null;
  const isClient = role === "client";
  const isCarrier = role === "carrier";
  const isAdmin = role === "admin";
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("greeting.morning") || "Good morning";
    if (hour < 18) return t("greeting.afternoon") || "Good afternoon";
    return t("greeting.evening") || "Good evening";
  };
  const userName = user.email?.split("@")[0] || "User";
  const breadcrumbs = [{
    label: t("nav.dashboard")
  }];
  return <DashboardLayout breadcrumbs={breadcrumbs}>
      {/* Welcome Section */}
      <div className="mb-6 animate-fade-up px-[107px]">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight mb-1">
          {getGreeting()}, <span className="text-gradient">{userName}</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          {isClient && t("dashboard.subtitle.client")}
          {isCarrier && t("dashboard.subtitle.carrier")}
          {isAdmin && t("dashboard.subtitle.admin")}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <div className="animate-fade-up stagger-1">
          <KPICard title={isClient ? t("orders.myOrders") : t("orders.available")} value={stats.orders} icon={<Package className="w-5 h-5 md:w-6 md:h-6" />} variant="primary" />
        </div>
        <div className="animate-fade-up stagger-2">
          <KPICard title={t("carrier.inProgress")} value={stats.activeDeals} icon={<Clock className="w-5 h-5 md:w-6 md:h-6" />} variant="warning" />
        </div>
        <div className="animate-fade-up stagger-3">
          <KPICard title={t("carrier.completed")} value={stats.completed} icon={<TrendingUp className="w-5 h-5 md:w-6 md:h-6" />} variant="success" />
        </div>
        <div className="animate-fade-up stagger-4">
          <KPICard title={t("carrier.rating")} value={stats.rating ? stats.rating.toFixed(1) : "—"} subtitle={stats.rating ? `${t("stats.outOf") || "out of"} 5.0` : t("stats.noRatings") || "No ratings"} icon={<Star className="w-5 h-5 md:w-6 md:h-6" />} />
        </div>
      </div>

      {/* Role-specific content */}
      <div className="animate-fade-up stagger-5">
        {isClient && <ClientDashboard />}
        {isCarrier && <CarrierDashboard />}

        {isAdmin && <SectionCard title={t("admin.title")} description={t("dashboard.subtitle.admin")} icon={<Shield className="w-5 h-5 text-primary" />} action={<Button onClick={() => navigate("/admin")} className="gap-2">
                {t("nav.admin")}
                <ArrowRight className="w-4 h-4" />
              </Button>}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <QuickActionCard title={t("admin.users")} description={t("admin.usersDescription") || "Manage platform users"} icon={<Users className="w-5 h-5" />} onClick={() => navigate("/admin#users")} />
              <QuickActionCard title={t("admin.deals")} description={t("admin.dealsDescription") || "Monitor all deals"} icon={<FileText className="w-5 h-5" />} onClick={() => navigate("/admin#deals")} />
              <QuickActionCard title={t("admin.analytics")} description={t("admin.analyticsDescription") || "View platform analytics"} icon={<BarChart3 className="w-5 h-5" />} onClick={() => navigate("/admin#analytics")} />
            </div>
          </SectionCard>}
      </div>
    </DashboardLayout>;
};
export default Dashboard;