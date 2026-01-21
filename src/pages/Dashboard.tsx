import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LogOut, User, Truck, Package, TrendingUp, Clock, Star, Loader2 } from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, role, loading, signOut } = useAuth();

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
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarFallback className={`gradient-${role === "client" ? "customer" : "driver"} text-white`}>
                  {user.email?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm hidden md:block">{user.email}</span>
            </div>
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
              <div className="text-2xl font-bold">0</div>
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
              <div className="text-2xl font-bold">0</div>
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
              <div className="text-2xl font-bold">0</div>
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
              <div className="text-2xl font-bold">—</div>
              <p className="text-xs text-muted-foreground">нет оценок</p>
            </CardContent>
          </Card>
        </div>

        {/* Role-specific content */}
        {isClient && (
          <Card>
            <CardHeader>
              <CardTitle>Создать заявку</CardTitle>
              <CardDescription>
                Опишите ваш груз и маршрут для получения предложений от перевозчиков
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="customer" size="lg">
                <Package className="w-4 h-4 mr-2" />
                Новая заявка
              </Button>
            </CardContent>
          </Card>
        )}

        {isCarrier && (
          <Card>
            <CardHeader>
              <CardTitle>Доступные заявки</CardTitle>
              <CardDescription>
                Просмотрите актуальные заявки и откликнитесь на подходящие
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Пока нет доступных заявок
              </div>
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Пользователи</CardTitle>
                <CardDescription>Управление пользователями платформы</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline">Перейти к управлению</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Сделки</CardTitle>
                <CardDescription>Мониторинг всех активных сделок</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline">Смотреть сделки</Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
