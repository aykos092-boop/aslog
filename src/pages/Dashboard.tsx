import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LogOut, User, Truck, Package, TrendingUp, Clock, Star, Loader2, Shield } from "lucide-react";
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const isClient = role === "client";
  const isCarrier = role === "carrier";
  const isAdmin = role === "admin";

  const getRoleLabel = () => {
    switch (role) {
      case "client":
        return t("role.client");
      case "carrier":
        return t("role.carrier");
      case "admin":
        return t("role.admin");
      default:
        return t("role.client");
    }
  };

  const getRoleIcon = () => {
    switch (role) {
      case "client":
        return <User className="w-4 h-4" />;
      case "carrier":
        return <Truck className="w-4 h-4" />;
      case "admin":
        return <Shield className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">Asia<span className="text-primary">Log</span></h1>
            <Badge variant="outline" className={`bg-${role}-light`}>
              {getRoleIcon()}
              <span className="ml-1">{getRoleLabel()}</span>
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <NotificationCenter />
            <NotificationToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/profile")}
              className="flex items-center gap-2"
            >
              <Avatar className="w-8 h-8">
                <AvatarFallback className={`gradient-${role === "client" ? "customer" : "driver"} text-white`}>
                  {user.email?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:block">{user.email}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              {t("auth.logout")}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2">
            {t("nav.dashboard")}, {user.email?.split("@")[0]}!
          </h2>
          <p className="text-muted-foreground">
            {isClient && t("orders.create")}
            {isCarrier && t("orders.available")}
            {isAdmin && t("nav.settings")}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {isClient ? t("orders.myOrders") : t("orders.available")}
              </CardTitle>
              <Package className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.orders}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("carrier.inProgress")}
              </CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeDeals}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("carrier.completed")}
              </CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("carrier.rating")}
              </CardTitle>
              <Star className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.rating ? stats.rating.toFixed(1) : "—"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Role-specific content */}
        {isClient && <ClientDashboard />}
        {isCarrier && <CarrierDashboard />}

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                {t("role.admin")}
              </CardTitle>
              <CardDescription>
                {t("nav.settings")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/admin")}>
                {t("nav.dashboard")}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      {/* AI Chat Bot */}
      <AIChatBot />
    </div>
  );
};

export default Dashboard;
