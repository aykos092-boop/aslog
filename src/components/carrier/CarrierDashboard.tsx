import { AvailableOrdersList } from "./AvailableOrdersList";
import { MyResponsesList } from "./MyResponsesList";

export const CarrierDashboard = () => {
  return (
    <div className="space-y-8">
      <AvailableOrdersList />
      <MyResponsesList />
    </div>
  );
};
