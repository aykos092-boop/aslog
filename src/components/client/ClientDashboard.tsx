import { useState } from "react";
import { useLocation } from "react-router-dom";
import { CreateOrderForm } from "./CreateOrderForm";
import { OrdersList } from "./OrdersList";
import { MyDealsList } from "@/components/deals/MyDealsList";
import { FavoriteCarriersList } from "@/components/favorites/FavoriteCarriersList";
import { DeliveryCostCalculator } from "@/components/calculator/DeliveryCostCalculator";
import { ReferralCard } from "@/components/referral/ReferralCard";
import { useLanguage } from "@/contexts/LanguageContext";
import { SectionCard } from "@/components/ui/SectionCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, FileText, Heart, Calculator, Plus, UserPlus } from "lucide-react";

export const ClientDashboard = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const location = useLocation();
  const { t } = useLanguage();

  // Determine active tab from hash
  const hash = location.hash.replace("#", "") || "orders";
  const activeTab = ["orders", "deals", "favorites", "calculator", "create-order"].includes(hash) ? hash : "orders";

  const handleOrderCreated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue={activeTab} className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1 rounded-xl mb-6">
          <TabsTrigger
            value="orders"
            className="flex-1 min-w-[100px] gap-2 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg"
          >
            <Package className="w-4 h-4" />
            <span className="hidden sm:inline">{t("orders.myOrders")}</span>
          </TabsTrigger>
          <TabsTrigger
            value="deals"
            className="flex-1 min-w-[100px] gap-2 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">{t("deals.myDeals")}</span>
          </TabsTrigger>
          <TabsTrigger
            value="favorites"
            className="flex-1 min-w-[100px] gap-2 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg"
          >
            <Heart className="w-4 h-4" />
            <span className="hidden sm:inline">{t("favorites.title")}</span>
          </TabsTrigger>
          <TabsTrigger
            value="calculator"
            className="flex-1 min-w-[100px] gap-2 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg"
          >
            <Calculator className="w-4 h-4" />
            <span className="hidden sm:inline">{t("calculator.title")}</span>
          </TabsTrigger>
          <TabsTrigger
            value="create-order"
            className="flex-1 min-w-[100px] gap-2 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t("orders")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-0 animate-fade-up">
          <OrdersList refreshTrigger={refreshTrigger} />
        </TabsContent>

        <TabsContent value="deals" className="mt-0 animate-fade-up">
          <MyDealsList />
        </TabsContent>

        <TabsContent value="favorites" className="mt-0 animate-fade-up">
          <FavoriteCarriersList />
        </TabsContent>

        <TabsContent value="calculator" className="mt-0 animate-fade-up">
          <div className="grid lg:grid-cols-2 gap-6">
            <DeliveryCostCalculator />
            <ReferralCard />
          </div>
        </TabsContent>

        <TabsContent value="create-order" className="mt-0 animate-fade-up">
          <div className="max-w-2xl">
            <CreateOrderForm onSuccess={handleOrderCreated} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
