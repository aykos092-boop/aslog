import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Users, Truck, TrendingUp, ArrowLeft, 
  Shield, Loader2, Tag, Bot, FileCheck, Clock, UserCheck
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
import { KYCDashboard } from "@/components/admin/KYCDashboard";
import { AuditLogsTable } from "@/components/admin/AuditLogsTable";
import { RegistrationRequestsTable } from "@/components/admin/RegistrationRequestsTable";
import { AdminRolesManager } from "@/components/admin/AdminRolesManager";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";

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
      <header className="border-b bg-card sticky top-0 z-10 backdrop-blur-lg bg-card/80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 gradient-hero rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">{t("admin.title")}</h1>
                  <p className="text-xs text-muted-foreground">Enterprise Admin Panel</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeSwitcher />
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="analytics" className="gap-2 py-2.5">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2 py-2.5">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="deals" className="gap-2 py-2.5">
              <Truck className="w-4 h-4" />
              <span className="hidden sm:inline">Deals</span>
            </TabsTrigger>
            <TabsTrigger value="registrations" className="gap-2 py-2.5">
              <UserCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Registrations</span>
            </TabsTrigger>
            <TabsTrigger value="kyc" className="gap-2 py-2.5">
              <FileCheck className="w-4 h-4" />
              <span className="hidden sm:inline">KYC</span>
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-2 py-2.5">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">RBAC</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2 py-2.5">
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">Audit</span>
            </TabsTrigger>
            <TabsTrigger value="promos" className="gap-2 py-2.5">
              <Tag className="w-4 h-4" />
              <span className="hidden sm:inline">Promos</span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2 py-2.5">
              <Bot className="w-4 h-4" />
              <span className="hidden sm:inline">AI</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics"><AnalyticsCharts /></TabsContent>
          <TabsContent value="users"><UsersTable /></TabsContent>
          <TabsContent value="deals"><DealsTable /></TabsContent>
          <TabsContent value="registrations"><RegistrationRequestsTable /></TabsContent>
          <TabsContent value="kyc"><KYCDashboard /></TabsContent>
          <TabsContent value="roles"><AdminRolesManager /></TabsContent>
          <TabsContent value="audit"><AuditLogsTable /></TabsContent>
          <TabsContent value="promos"><PromoCodesManager /></TabsContent>
          <TabsContent value="ai"><AIChatAnalytics /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
