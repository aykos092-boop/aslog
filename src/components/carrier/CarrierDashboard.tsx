import { useLocation } from "react-router-dom";
import { AvailableOrdersList } from "./AvailableOrdersList";
import { MyResponsesList } from "./MyResponsesList";
import { MyDealsList } from "@/components/deals/MyDealsList";
import { CarrierPreferences } from "./CarrierPreferences";
import { CarrierStats } from "./CarrierStats";
import { CarrierAchievements } from "./CarrierAchievements";
import { CarrierLevel } from "./CarrierLevel";
import { DriverPanel } from "./DriverPanel";
import { CentralAsiaRouteCalculator } from "@/components/calculator/CentralAsiaRouteCalculator";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, MessageSquare, FileText, Star, Settings, Navigation } from "lucide-react";

export const CarrierDashboard = () => {
  const location = useLocation();
  const { t } = useLanguage();
  
  // Determine active tab from hash
  const hash = location.hash.replace('#', '') || 'available';
  const activeTab = ['available', 'responses', 'deals', 'navigation', 'achievements', 'settings'].includes(hash) ? hash : 'available';

  return (
    <div className="space-y-6">
      {/* Top Stats Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <CarrierLevel />
        <div className="lg:col-span-2">
          <CarrierStats />
        </div>
      </div>

      <Tabs defaultValue={activeTab} className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1 rounded-xl mb-6">
          <TabsTrigger 
            value="available" 
            className="flex-1 min-w-[80px] gap-2 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg text-xs sm:text-sm"
          >
            <Truck className="w-4 h-4" />
            <span className="hidden sm:inline">{t("orders.available")}</span>
          </TabsTrigger>
          <TabsTrigger 
            value="responses" 
            className="flex-1 min-w-[80px] gap-2 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg text-xs sm:text-sm"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">{t("carrier.myResponses")}</span>
          </TabsTrigger>
          <TabsTrigger 
            value="deals" 
            className="flex-1 min-w-[80px] gap-2 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg text-xs sm:text-sm"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">{t("deals.myDeals")}</span>
          </TabsTrigger>
          <TabsTrigger 
            value="navigation" 
            className="flex-1 min-w-[80px] gap-2 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg text-xs sm:text-sm"
          >
            <Navigation className="w-4 h-4" />
            <span className="hidden sm:inline">{t("carrier.navigation") || "Навигация"}</span>
          </TabsTrigger>
          <TabsTrigger 
            value="achievements" 
            className="flex-1 min-w-[80px] gap-2 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg text-xs sm:text-sm"
          >
            <Star className="w-4 h-4" />
            <span className="hidden sm:inline">{t("carrier.achievements")}</span>
          </TabsTrigger>
          <TabsTrigger 
            value="settings" 
            className="flex-1 min-w-[80px] gap-2 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg text-xs sm:text-sm"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">{t("carrier.preferences")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="mt-0 animate-fade-up">
          <AvailableOrdersList />
        </TabsContent>

        <TabsContent value="responses" className="mt-0 animate-fade-up">
          <MyResponsesList />
        </TabsContent>

        <TabsContent value="deals" className="mt-0 animate-fade-up">
          <MyDealsList />
        </TabsContent>

        <TabsContent value="navigation" className="mt-0 animate-fade-up">
          <DriverPanel />
        </TabsContent>

        <TabsContent value="achievements" className="mt-0 animate-fade-up">
          <CarrierAchievements />
        </TabsContent>

        <TabsContent value="settings" className="mt-0 animate-fade-up">
          <div className="grid lg:grid-cols-2 gap-6">
            <CarrierPreferences />
            <CentralAsiaRouteCalculator />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
