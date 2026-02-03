import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Users, Truck, TrendingUp, ArrowLeft, 
  Shield, Loader2, Tag, Bot, FileCheck, Clock, UserCheck, CreditCard, DollarSign, FileText
} from "lucide-react";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersTable } from "@/components/admin/UsersTable";
import { DealsTable } from "@/components/admin/DealsTable";
import { AnalyticsCharts } from "@/components/admin/AnalyticsCharts";
import { PromoCodesManager } from "@/components/admin/PromoCodesManager";
import { AIChatAnalytics } from "@/components/admin/AIChatAnalytics";
import { EnhancedKYCDashboard } from "@/components/admin/EnhancedKYCDashboard";
import { AuditLogsTable } from "@/components/admin/AuditLogsTable";
import { RegistrationRequestsTable } from "@/components/admin/RegistrationRequestsTable";
import { AdminRolesManager } from "@/components/admin/AdminRolesManager";
import { SubscriptionsManager } from "@/components/admin/SubscriptionsManager";
import { PaymentManager } from "@/components/admin/PaymentManager";
import MonetizationDashboard from "@/components/admin/MonetizationDashboard";
import { DocumentsManager } from "@/components/admin/DocumentsManager";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useFirebaseAuth();
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
        <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="shrink-0">
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 gradient-hero rounded-xl flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base sm:text-xl font-bold truncate">{t("admin.title")}</h1>
                  <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Admin Panel</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <ThemeSwitcher />
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
        <Tabs defaultValue="analytics" className="space-y-4 sm:space-y-6">
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <TabsList className="inline-flex w-auto min-w-full sm:min-w-0 h-auto gap-1 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="analytics" className="gap-1 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3">
                <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm">Analytics</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-1 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3">
                <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm">Users</span>
              </TabsTrigger>
              <TabsTrigger value="deals" className="gap-1 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3">
                <Truck className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm">Deals</span>
              </TabsTrigger>
              <TabsTrigger value="registrations" className="gap-1 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3">
                <UserCheck className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm hidden md:inline">Registrations</span>
                <span className="text-xs sm:text-sm md:hidden">Reg</span>
              </TabsTrigger>
              <TabsTrigger value="kyc" className="gap-1 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3">
                <FileCheck className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm">KYC</span>
              </TabsTrigger>
              <TabsTrigger value="subscriptions" className="gap-1 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3">
                <CreditCard className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm hidden md:inline">Subscriptions</span>
                <span className="text-xs sm:text-sm md:hidden">Subs</span>
              </TabsTrigger>
              <TabsTrigger value="payments" className="gap-1 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3">
                <DollarSign className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm hidden md:inline">Payments</span>
                <span className="text-xs sm:text-sm md:hidden">Pay</span>
              </TabsTrigger>
              <TabsTrigger value="roles" className="gap-1 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3">
                <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm">RBAC</span>
              </TabsTrigger>
              <TabsTrigger value="audit" className="gap-1 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm">Audit</span>
              </TabsTrigger>
              <TabsTrigger value="promos" className="gap-1 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3">
                <Tag className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm">Promos</span>
              </TabsTrigger>
              <TabsTrigger value="ai" className="gap-1 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3">
                <Bot className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm">AI</span>
              </TabsTrigger>
              <TabsTrigger value="monetization" className="gap-1 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3">
                <DollarSign className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm hidden md:inline">Monetization</span>
                <span className="text-xs sm:text-sm md:hidden">$</span>
              </TabsTrigger>
              <TabsTrigger value="documents" className="gap-1 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3">
                <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm hidden md:inline">Documents</span>
                <span className="text-xs sm:text-sm md:hidden">Docs</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="analytics"><AnalyticsCharts /></TabsContent>
          <TabsContent value="users"><UsersTable /></TabsContent>
          <TabsContent value="deals"><DealsTable /></TabsContent>
          <TabsContent value="registrations"><RegistrationRequestsTable /></TabsContent>
          <TabsContent value="kyc"><EnhancedKYCDashboard /></TabsContent>
          <TabsContent value="subscriptions"><SubscriptionsManager /></TabsContent>
          <TabsContent value="payments"><PaymentManager /></TabsContent>
          <TabsContent value="roles"><AdminRolesManager /></TabsContent>
          <TabsContent value="audit"><AuditLogsTable /></TabsContent>
          <TabsContent value="promos"><PromoCodesManager /></TabsContent>
          <TabsContent value="ai"><AIChatAnalytics /></TabsContent>
          <TabsContent value="monetization"><MonetizationDashboard /></TabsContent>
          <TabsContent value="documents"><DocumentsManager /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
