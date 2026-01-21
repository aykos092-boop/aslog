import { AvailableOrdersList } from "./AvailableOrdersList";
import { MyResponsesList } from "./MyResponsesList";
import { MyDealsList } from "@/components/deals/MyDealsList";
import { CarrierPreferences } from "./CarrierPreferences";

export const CarrierDashboard = () => {
  return (
    <div className="space-y-8">
      <MyDealsList />
      <AvailableOrdersList />
      <div className="grid lg:grid-cols-2 gap-6">
        <MyResponsesList />
        <CarrierPreferences />
      </div>
    </div>
  );
};
