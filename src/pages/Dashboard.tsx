import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LogOut, User, Truck, Package, TrendingUp, Clock, Star, Loader2, Shield, Home } from "lucide-react";
import { ClientDashboard } from "@/components/client/ClientDashboard";
import { CarrierDashboard } from "@/components/carrier/CarrierDashboard";
import { NotificationToggle } from "@/components/notifications/NotificationToggle";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { AIChatBot } from "@/components/ai/AIChatBot";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, role, loading, signOut } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState({
    orders: 0,
    activeDeals: 0,
    completed: 0,
    rating: null as number | null,
  });

  // Fetch stats
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

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground animate-pulse">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const isClient = role === "client";
  const isCarrier = role === "carrier";
  const isAdmin = role === "admin";

  const getRoleLabel = () => {
    switch (role) {
      case "client": return t("role.client");
      case "carrier": return t("role.carrier");
      case "admin": return t("role.admin");
      default: return t("role.client");
    }
  };

  const getRoleIcon = () => {
    switch (role) {
      case "client": return <User className="w-4 h-4" />;
      case "carrier": return <Truck className="w-4 h-4" />;
      case "admin": return <Shield className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getSubtitle = () => {
    switch (role) {
      case "client": return t("dashboard.subtitle.client");
      case "carrier": return t("dashboard.subtitle.carrier");
      case "admin": return t("dashboard.subtitle.admin");
      default: return "";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-lg sticky top-0 z-10">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <Link to="/" className="flex items-center gap-2 group">
                <div className="w-8 h-8 sm:w-10 sm:h-10 gradient-hero rounded-xl flex items-center justify-center transition-transform group-hover:scale-105">
                  <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <span className="text-lg sm:text-xl font-bold hidden sm:inline">
                  Asia<span className="text-primary">Log</span>
                </span>
              </Link>
              <Badge variant="outline" className="hidden sm:flex gap-1">
                {getRoleIcon()}
                <span>{getRoleLabel()}</span>
              </Badge>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2">
              <LanguageSwitcher />
              <NotificationCenter />
              <NotificationToggle />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/profile")}
                className="hidden sm:flex items-center gap-2"
              >
                <Avatar className="w-7 h-7 sm:w-8 sm:h-8">
                  <AvatarFallback className={`gradient-${role === "client" ? "customer" : "driver"} text-white text-xs`}>
                    {user.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:block text-sm truncate max-w-[120px]">{user.email}</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-1 sm:gap-2">
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">{t("auth.logout")}</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8 animate-fade-in">
          <h2 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">
            {t("dashboard.welcome")}, {user.email?.split("@")[0]}!
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            {getSubtitle()}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                {isClient ? t("orders.myOrders") : t("orders.available")}
              </CardTitle>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-customer/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Package className="w-4 h-4 sm:w-5 sm:h-5 text-customer" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold">{stats.orders}</div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                {t("carrier.inProgress")}
              </CardTitle>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-driver/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-driver" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold">{stats.activeDeals}</div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                {t("carrier.completed")}
              </CardTitle>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-company/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-company" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold">{stats.completed}</div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                {t("carrier.rating")}
              </CardTitle>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gold/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Star className="w-4 h-4 sm:w-5 sm:h-5 text-gold" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold">
                {stats.rating ? stats.rating.toFixed(1) : "—"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Role-specific content */}
        <div className="animate-fade-in" style={{ animationDelay: "0.5s" }}>
          {isClient && <ClientDashboard />}
          {isCarrier && <CarrierDashboard />}

          {isAdmin && (
            <Card className="hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-10 h-10 gradient-hero rounded-xl flex items-center justify-center">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  {t("admin.title")}
                </CardTitle>
                <CardDescription>
                  {t("dashboard.subtitle.admin")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => navigate("/admin")} 
                  className="w-full sm:w-auto transition-all hover:scale-105"
                >
                  {t("nav.admin")}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* AI Chat Bot */}
      <AIChatBot />
    </div>
  );
};

export default Dashboard;
