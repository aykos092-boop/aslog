import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { 
  Package, MapPin, MessageSquare, Loader2, 
  Truck, CheckCircle, Navigation, Flag, Star
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Deal {
  id: string;
  order_id: string;
  client_id: string;
  carrier_id: string;
  agreed_price: number;
  status: "pending" | "accepted" | "in_transit" | "delivered" | "cancelled";
  created_at: string;
  order?: {
    cargo_type: string;
    pickup_address: string;
    delivery_address: string;
  };
  other_profile?: {
    full_name: string | null;
  };
}

const statusConfig = {
  pending: { label: "Ожидает", icon: Truck, color: "bg-muted text-muted-foreground" },
  accepted: { label: "Принята", icon: CheckCircle, color: "bg-customer text-white" },
  in_transit: { label: "В пути", icon: Navigation, color: "bg-driver text-white" },
  delivered: { label: "Доставлено", icon: Flag, color: "bg-gold text-white" },
  cancelled: { label: "Отменена", icon: Truck, color: "bg-destructive text-white" },
};

export const MyDealsList = () => {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      if (!user) return;

      setLoading(true);

      const query = supabase
        .from("deals")
        .select(`
          *,
          order:orders(cargo_type, pickup_address, delivery_address)
        `)
        .order("created_at", { ascending: false });

      if (role === "client") {
        query.eq("client_id", user.id);
      } else {
        query.eq("carrier_id", user.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching deals:", error);
        setLoading(false);
        return;
      }

      // Fetch other participant profiles
      const otherUserIds = (data || []).map(d => 
        role === "client" ? d.carrier_id : d.client_id
      );

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", otherUserIds);

      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);

      const dealsWithProfiles = (data || []).map(deal => ({
        ...deal,
        other_profile: profilesMap.get(role === "client" ? deal.carrier_id : deal.client_id),
      }));

      setDeals(dealsWithProfiles);
      setLoading(false);
    };

    fetchDeals();

    // Subscribe to deal updates
    const channel = supabase
      .channel("my-deals")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deals",
        },
        () => {
          fetchDeals();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, role]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (deals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Мои сделки
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
          У вас пока нет активных сделок
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="w-5 h-5" />
          Мои сделки
        </CardTitle>
        <CardDescription>
          {deals.length} сделок
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {deals.map((deal) => {
          const status = statusConfig[deal.status];
          const StatusIcon = status.icon;

          return (
            <div
              key={deal.id}
              className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/deals/${deal.id}/chat`)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{deal.order?.cargo_type}</span>
                    <Badge className={status.color}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {status.label}
                    </Badge>
                  </div>

                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <MapPin className="w-3 h-3" />
                    {deal.order?.pickup_address} → {deal.order?.delivery_address}
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-semibold text-driver">
                      {deal.agreed_price.toLocaleString()} ₽
                    </span>
                    <span className="text-muted-foreground">
                      {role === "client" ? "Перевозчик" : "Клиент"}: {deal.other_profile?.full_name || "—"}
                    </span>
                  </div>
                </div>

                <Button variant="outline" size="sm">
                  <MessageSquare className="w-4 h-4 mr-1" />
                  Чат
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
