import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Users, Truck, Package, TrendingUp, ArrowLeft, 
  Shield, Loader2 
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersTable } from "@/components/admin/UsersTable";
import { DealsTable } from "@/components/admin/DealsTable";
import { AnalyticsCharts } from "@/components/admin/AnalyticsCharts";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();

  useEffect(() => {
    if (!loading && (!user || role !== "admin")) {
      navigate("/dashboard");
    }
  }, [user, role, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (role !== "admin") return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Shield className="w-6 h-6 text-primary" />
                <h1 className="text-xl font-bold">Админ-панель</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Аналитика
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Пользователи
            </TabsTrigger>
            <TabsTrigger value="deals" className="flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Сделки
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics">
            <AnalyticsCharts />
          </TabsContent>

          <TabsContent value="users">
            <UsersTable />
          </TabsContent>

          <TabsContent value="deals">
            <DealsTable />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
