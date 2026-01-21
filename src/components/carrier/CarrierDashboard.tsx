import { AvailableOrdersList } from "./AvailableOrdersList";
import { MyResponsesList } from "./MyResponsesList";
import { MyDealsList } from "@/components/deals/MyDealsList";

export const CarrierDashboard = () => {
  return (
    <div className="space-y-8">
      <MyDealsList />
      <AvailableOrdersList />
      <MyResponsesList />
    </div>
  );
};
