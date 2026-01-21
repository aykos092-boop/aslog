import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Users, Truck, TrendingUp, ArrowLeft, 
  Shield, Loader2, Tag, Bot, BarChart3, Activity, Package
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersTable } from "@/components/admin/UsersTable";
import { DealsTable } from "@/components/admin/DealsTable";
import { AnalyticsCharts } from "@/components/admin/AnalyticsCharts";
import { PromoCodesManager } from "@/components/admin/PromoCodesManager";
import { AIChatAnalytics } from "@/components/admin/AIChatAnalytics";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    if (!loading && (!user || role !== "admin")) {
      navigate("/dashboard");
    }
  }, [user, role, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground animate-pulse">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (role !== "admin") return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10 backdrop-blur-lg bg-card/80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate("/dashboard")}
                className="hover:scale-105 transition-transform"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 gradient-hero rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">{t("admin.title")}</h1>
                  <p className="text-xs text-muted-foreground">AsiaLog</p>
                </div>
              </div>
            </div>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="grid w-full max-w-3xl grid-cols-5 h-auto p-1 bg-muted/50">
            <TabsTrigger 
              value="analytics" 
              className="flex items-center gap-2 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
            >
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">{t("admin.analytics")}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="users" 
              className="flex items-center gap-2 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">{t("admin.users")}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="deals" 
              className="flex items-center gap-2 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
            >
              <Truck className="w-4 h-4" />
              <span className="hidden sm:inline">{t("admin.deals")}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="promos" 
              className="flex items-center gap-2 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
            >
              <Tag className="w-4 h-4" />
              <span className="hidden sm:inline">{t("admin.promos")}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="ai" 
              className="flex items-center gap-2 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
            >
              <Bot className="w-4 h-4" />
              <span className="hidden sm:inline">{t("admin.aiChat")}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="animate-fade-in">
            <AnalyticsCharts />
          </TabsContent>

          <TabsContent value="users" className="animate-fade-in">
            <UsersTable />
          </TabsContent>

          <TabsContent value="deals" className="animate-fade-in">
            <DealsTable />
          </TabsContent>

          <TabsContent value="promos" className="animate-fade-in">
            <PromoCodesManager />
          </TabsContent>

          <TabsContent value="ai" className="animate-fade-in">
            <AIChatAnalytics />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
