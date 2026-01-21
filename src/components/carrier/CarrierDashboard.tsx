import { AvailableOrdersList } from "./AvailableOrdersList";
import { MyResponsesList } from "./MyResponsesList";
import { MyDealsList } from "@/components/deals/MyDealsList";
import { CarrierPreferences } from "./CarrierPreferences";
import { CarrierStats } from "./CarrierStats";
import { CarrierAchievements } from "./CarrierAchievements";
import { CentralAsiaRouteCalculator } from "@/components/calculator/CentralAsiaRouteCalculator";

export const CarrierDashboard = () => {
  return (
    <div className="space-y-8">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <MyDealsList />
        </div>
        <div className="space-y-6">
          <CarrierStats />
          <CarrierAchievements />
        </div>
      </div>
      <AvailableOrdersList />
      <div className="grid lg:grid-cols-2 gap-6">
        <MyResponsesList />
        <div className="space-y-6">
          <CarrierPreferences />
          <CentralAsiaRouteCalculator />
        </div>
      </div>
    </div>
  );
};
