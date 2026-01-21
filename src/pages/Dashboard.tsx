import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LogOut, User, Truck, Package, TrendingUp, Clock, Star, Loader2, Shield } from "lucide-react";
import { ClientDashboard } from "@/components/client/ClientDashboard";
import { CarrierDashboard } from "@/components/carrier/CarrierDashboard";
import { NotificationToggle } from "@/components/notifications/NotificationToggle";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, role, loading, signOut } = useAuth();
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
        // Count client's orders
        const { count: ordersCount } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("client_id", user.id);

        // Count active deals
        const { count: activeDealsCount } = await supabase
          .from("deals")
          .select("*", { count: "exact", head: true })
          .eq("client_id", user.id)
          .in("status", ["pending", "accepted", "in_transit"]);

        // Count completed deals
        const { count: completedCount } = await supabase
          .from("deals")
          .select("*", { count: "exact", head: true })
          .eq("client_id", user.id)
          .eq("status", "delivered");

        // Get average rating
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
        // Count open orders
        const { count: openOrdersCount } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("status", "open");

        // Count active deals
        const { count: activeDealsCount } = await supabase
          .from("deals")
          .select("*", { count: "exact", head: true })
          .eq("carrier_id", user.id)
          .in("status", ["pending", "accepted", "in_transit"]);

        // Count completed deals
        const { count: completedCount } = await supabase
          .from("deals")
          .select("*", { count: "exact", head: true })
          .eq("carrier_id", user.id)
          .eq("status", "delivered");

        // Get average rating
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
        return "Клиент";
      case "carrier":
        return "Перевозчик";
      case "admin":
        return "Администратор";
      default:
        return "Пользователь";
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

  const getRoleVariant = () => {
    switch (role) {
      case "client":
        return "customer";
      case "carrier":
        return "driver";
      default:
        return "default";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">LogiFlow</h1>
            <Badge variant="outline" className={`bg-${role}-light`}>
              {getRoleIcon()}
              <span className="ml-1">{getRoleLabel()}</span>
            </Badge>
          </div>
          <div className="flex items-center gap-2">
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
              Выйти
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2">
            Добро пожаловать, {user.email?.split("@")[0]}!
          </h2>
          <p className="text-muted-foreground">
            {isClient && "Создавайте заявки и управляйте своими перевозками"}
            {isCarrier && "Просматривайте доступные заявки и выполняйте заказы"}
            {isAdmin && "Управляйте платформой и пользователями"}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {isClient ? "Мои заявки" : "Доступные заявки"}
              </CardTitle>
              <Package className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.orders}</div>
              <p className="text-xs text-muted-foreground">
                {isClient ? "всего создано" : "ожидают отклика"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Активные сделки
              </CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeDeals}</div>
              <p className="text-xs text-muted-foreground">в процессе</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Завершено
              </CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
              <p className="text-xs text-muted-foreground">успешных сделок</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Рейтинг
              </CardTitle>
              <Star className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.rating ? stats.rating.toFixed(1) : "—"}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.rating ? "средняя оценка" : "нет оценок"}
              </p>
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
                Панель администратора
              </CardTitle>
              <CardDescription>
                Управление пользователями, сделками и аналитика платформы
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/admin")}>
                Открыть админ-панель
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
