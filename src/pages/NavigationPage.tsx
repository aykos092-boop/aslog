import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FullScreenNavigator } from "@/components/navigation/FullScreenNavigator";
import { Loader2 } from "lucide-react";

interface DealWithOrder {
  id: string;
  client_id: string;
  order: {
    pickup_address: string;
    delivery_address: string;
    cargo_type: string;
  };
  client_profile?: {
    full_name: string | null;
    phone: string | null;
  };
}

const NavigationPage = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [deal, setDeal] = useState<DealWithOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dealId || !user) return;

    const fetchDeal = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from("deals")
          .select(`
            id,
            client_id,
            carrier_id,
            order:orders!order_id (
              pickup_address,
              delivery_address,
              cargo_type
            )
          `)
          .eq("id", dealId)
          .single();

        if (fetchError) throw fetchError;

        // Verify user is the carrier
        if (data.carrier_id !== user.id) {
          setError("Доступ запрещён");
          setLoading(false);
          return;
        }

        // Fetch client profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("user_id", data.client_id)
          .single();

        setDeal({
          ...data,
          client_profile: profile || undefined,
        });
      } catch (err: unknown) {
        console.error("Error fetching deal:", err);
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    };

    fetchDeal();
  }, [dealId, user]);

  const handleClose = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Загрузка навигации...</p>
        </div>
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center space-y-4 p-6">
          <p className="text-destructive text-lg">{error || "Заказ не найден"}</p>
          <button 
            onClick={() => navigate("/dashboard")}
            className="text-primary underline"
          >
            Вернуться в панель
          </button>
        </div>
      </div>
    );
  }

  return (
    <FullScreenNavigator
      dealId={deal.id}
      clientId={deal.client_id}
      clientName={deal.client_profile?.full_name || undefined}
      clientPhone={deal.client_profile?.phone || undefined}
      pickupAddress={deal.order.pickup_address}
      deliveryAddress={deal.order.delivery_address}
      cargoType={deal.order.cargo_type}
      onClose={handleClose}
    />
  );
};

export default NavigationPage;
