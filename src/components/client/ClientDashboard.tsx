import { useState } from "react";
import { CreateOrderForm } from "./CreateOrderForm";
import { OrdersList } from "./OrdersList";
import { MyDealsList } from "@/components/deals/MyDealsList";

export const ClientDashboard = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleOrderCreated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-8">
      <CreateOrderForm onSuccess={handleOrderCreated} />
      <MyDealsList />
      <OrdersList refreshTrigger={refreshTrigger} />
    </div>
  );
};
