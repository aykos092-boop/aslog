import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { KPICard } from "@/components/ui/KPICard";
import { SectionCard, QuickActionCard, EmptyState } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/button";
import { ClientDashboard } from "@/components/client/ClientDashboard";
import { CarrierDashboard } from "@/components/carrier/CarrierDashboard";
import { supabase } from "@/integrations/supabase/client";
import { 
  Package, 
  Clock, 
  TrendingUp, 
  Star, 
  Plus, 
  Truck, 
  Shield,
  Calculator,
  Heart,
  BarChart3,
  Users,
  FileText,
  ArrowRight,
} from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState({
    orders: 0,
    activeDeals: 0,
    completed: 0,
    rating: null as number | null,
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      if (role === "client") {
        const { count: ordersCount } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("client_id", user.id);

        const { count: activeDealsCount } = await supabase
          .from("deals")
          .select("*", { count: "exact", head: true })
          .eq("client_id", user.id)
          .in("status", ["pending", "accepted", "in_transit"]);

        const { count: completedCount } = await supabase
          .from("deals")
          .select("*", { count: "exact", head: true })
          .eq("client_id", user.id)
          .eq("status", "delivered");

        const { data: ratingsData } = await supabase
          .from("ratings")
          .select("score")
          .eq("rated_id", user.id);

        const avgRating = ratingsData && ratingsData.length > 0
          ? ratingsData.reduce((acc, r) => acc + r.score, 0) / ratingsData.length
          : null;

        setStats({
          orders: ordersCount || 0,
          activeDeals: activeDealsCount || 0,
          completed: completedCount || 0,
          rating: avgRating,
        });
      } else if (role === "carrier") {
        const { count: openOrdersCount } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("status", "open");

        const { count: activeDealsCount } = await supabase
          .from("deals")
          .select("*", { count: "exact", head: true })
          .eq("carrier_id", user.id)
          .in("status", ["pending", "accepted", "in_transit"]);

        const { count: completedCount } = await supabase
          .from("deals")
          .select("*", { count: "exact", head: true })
          .eq("carrier_id", user.id)
          .eq("status", "delivered");

        const { data: ratingsData } = await supabase
          .from("ratings")
          .select("score")
          .eq("rated_id", user.id);

        const avgRating = ratingsData && ratingsData.length > 0
          ? ratingsData.reduce((acc, r) => acc + r.score, 0) / ratingsData.length
          : null;

        setStats({
          orders: openOrdersCount || 0,
          activeDeals: activeDealsCount || 0,
          completed: completedCount || 0,
          rating: avgRating,
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

  const breadcrumbs = [{ label: t("nav.dashboard") }];

  return (
    <DashboardLayout
      breadcrumbs={breadcrumbs}
      actions={
        isClient && (
          <Button variant="hero" size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            {t("orders.createNew")}
          </Button>
        )
      }
    >
      {/* Welcome Section */}
      <div className="mb-8 animate-fade-up">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
          {getGreeting()}, <span className="text-gradient">{userName}</span>
        </h1>
        <p className="text-muted-foreground">
          {isClient && t("dashboard.subtitle.client")}
          {isCarrier && t("dashboard.subtitle.carrier")}
          {isAdmin && t("dashboard.subtitle.admin")}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="animate-fade-up stagger-1">
          <KPICard
            title={isClient ? t("orders.myOrders") : t("orders.available")}
            value={stats.orders}
            icon={<Package className="w-6 h-6" />}
            variant="primary"
            trend={{ value: 12, label: t("stats.vsLastMonth") || "vs last month" }}
          />
        </div>
        <div className="animate-fade-up stagger-2">
          <KPICard
            title={t("carrier.inProgress")}
            value={stats.activeDeals}
            icon={<Clock className="w-6 h-6" />}
            variant="warning"
          />
        </div>
        <div className="animate-fade-up stagger-3">
          <KPICard
            title={t("carrier.completed")}
            value={stats.completed}
            icon={<TrendingUp className="w-6 h-6" />}
            variant="success"
            trend={{ value: 8, label: t("stats.vsLastMonth") || "vs last month" }}
          />
        </div>
        <div className="animate-fade-up stagger-4">
          <KPICard
            title={t("carrier.rating")}
            value={stats.rating ? stats.rating.toFixed(1) : "—"}
            subtitle={stats.rating ? `${t("stats.outOf") || "out of"} 5.0` : t("stats.noRatings") || "No ratings yet"}
            icon={<Star className="w-6 h-6" />}
          />
        </div>
      </div>

      {/* Quick Actions */}
      {(isClient || isCarrier) && (
        <div className="mb-8 animate-fade-up stagger-5">
          <h2 className="text-lg font-semibold mb-4">{t("dashboard.quickActions") || "Quick Actions"}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {isClient && (
              <>
                <QuickActionCard
                  title={t("orders.createNew")}
                  description={t("orders.createDescription") || "Post a new shipment request"}
                  icon={<Plus className="w-5 h-5" />}
                  variant="primary"
                  onClick={() => navigate("/dashboard#create-order")}
                />
                <QuickActionCard
                  title={t("calculator.title")}
                  description={t("calculator.description") || "Calculate delivery costs"}
                  icon={<Calculator className="w-5 h-5" />}
                  onClick={() => navigate("/dashboard#calculator")}
                />
                <QuickActionCard
                  title={t("favorites.title")}
                  description={t("favorites.description") || "View your favorite carriers"}
                  icon={<Heart className="w-5 h-5" />}
                  onClick={() => navigate("/dashboard#favorites")}
                />
                <QuickActionCard
                  title={t("deals.myDeals")}
                  description={t("deals.viewAll") || "View all your deals"}
                  icon={<FileText className="w-5 h-5" />}
                  onClick={() => navigate("/dashboard#deals")}
                />
              </>
            )}
            {isCarrier && (
              <>
                <QuickActionCard
                  title={t("orders.available")}
                  description={t("orders.browseDescription") || "Browse available shipments"}
                  icon={<Truck className="w-5 h-5" />}
                  variant="success"
                  onClick={() => navigate("/dashboard#available")}
                />
                <QuickActionCard
                  title={t("carrier.myResponses")}
                  description={t("carrier.responsesDescription") || "View your submitted quotes"}
                  icon={<FileText className="w-5 h-5" />}
                  onClick={() => navigate("/dashboard#responses")}
                />
                <QuickActionCard
                  title={t("carrier.achievements")}
                  description={t("carrier.achievementsDescription") || "Check your progress"}
                  icon={<Star className="w-5 h-5" />}
                  onClick={() => navigate("/dashboard#achievements")}
                />
                <QuickActionCard
                  title={t("carrier.preferences")}
                  description={t("carrier.preferencesDescription") || "Update your preferences"}
                  icon={<TrendingUp className="w-5 h-5" />}
                  onClick={() => navigate("/profile")}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* Role-specific content */}
      <div className="animate-fade-up stagger-6">
        {isClient && <ClientDashboard />}
        {isCarrier && <CarrierDashboard />}

        {isAdmin && (
          <SectionCard
            title={t("admin.title")}
            description={t("dashboard.subtitle.admin")}
            icon={<Shield className="w-5 h-5 text-primary" />}
            action={
              <Button onClick={() => navigate("/admin")} className="gap-2">
                {t("nav.admin")}
                <ArrowRight className="w-4 h-4" />
              </Button>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <QuickActionCard
                title={t("admin.users")}
                description={t("admin.usersDescription") || "Manage platform users"}
                icon={<Users className="w-5 h-5" />}
                onClick={() => navigate("/admin#users")}
              />
              <QuickActionCard
                title={t("admin.deals")}
                description={t("admin.dealsDescription") || "Monitor all deals"}
                icon={<FileText className="w-5 h-5" />}
                onClick={() => navigate("/admin#deals")}
              />
              <QuickActionCard
                title={t("admin.analytics")}
                description={t("admin.analyticsDescription") || "View platform analytics"}
                icon={<BarChart3 className="w-5 h-5" />}
                onClick={() => navigate("/admin#analytics")}
              />
            </div>
          </SectionCard>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;