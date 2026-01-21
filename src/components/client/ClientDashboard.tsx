import { useState } from "react";
import { CreateOrderForm } from "./CreateOrderForm";
import { OrdersList } from "./OrdersList";
import { MyDealsList } from "@/components/deals/MyDealsList";
import { FavoriteCarriersList } from "@/components/favorites/FavoriteCarriersList";
import { DeliveryCostCalculator } from "@/components/calculator/DeliveryCostCalculator";

export const ClientDashboard = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleOrderCreated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-8">
      <div className="grid lg:grid-cols-2 gap-8">
        <CreateOrderForm onSuccess={handleOrderCreated} />
        <DeliveryCostCalculator />
      </div>
      <MyDealsList />
      <FavoriteCarriersList />
      <OrdersList refreshTrigger={refreshTrigger} />
    </div>
  );
};
