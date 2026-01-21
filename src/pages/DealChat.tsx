import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { 
  ArrowLeft, Package, MapPin, MessageSquare, Loader2, 
  Truck, CheckCircle, Navigation, Flag 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { ChatMessages } from "@/components/chat/ChatMessages";

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
    pickup_date: string;
  };
}

const statusConfig = {
  pending: { label: "Ожидает", icon: Truck, color: "bg-muted" },
  accepted: { label: "Принята", icon: CheckCircle, color: "bg-customer" },
  in_transit: { label: "В пути", icon: Navigation, color: "bg-driver" },
  delivered: { label: "Доставлено", icon: Flag, color: "bg-gold" },
  cancelled: { label: "Отменена", icon: Truck, color: "bg-destructive" },
};

const DealChat = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();

  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [otherParticipantName, setOtherParticipantName] = useState<string>("");

  const fetchDeal = async () => {
    if (!dealId || !user) return;

    const { data: dealData, error: dealError } = await supabase
      .from("deals")
      .select(`
        *,
        order:orders(cargo_type, pickup_address, delivery_address, pickup_date)
      `)
      .eq("id", dealId)
      .single();

    if (dealError || !dealData) {
      toast({
        title: "Ошибка",
        description: "Сделка не найдена",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    // Verify user is participant
    const isClient = dealData.client_id === user.id;
    const isCarrier = dealData.carrier_id === user.id;

    if (!isClient && !isCarrier) {
      toast({
        title: "Доступ запрещён",
        description: "Вы не являетесь участником этой сделки",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    setDeal(dealData);

    // Get other participant's name
    const otherUserId = isClient ? dealData.carrier_id : dealData.client_id;
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", otherUserId)
      .single();

    setOtherParticipantName(profileData?.full_name || "Участник");
    setLoading(false);
  };

  useEffect(() => {
    fetchDeal();
  }, [dealId, user]);

  // Subscribe to deal status changes
  useEffect(() => {
    if (!dealId) return;

    const channel = supabase
      .channel(`deal-status-${dealId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "deals",
          filter: `id=eq.${dealId}`,
        },
        (payload) => {
          setDeal((prev) => prev ? { ...prev, ...payload.new } : null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dealId]);

  const updateDealStatus = async (newStatus: Deal["status"], message: string) => {
    if (!deal || !user) return;

    setUpdatingStatus(true);

    // Update deal status
    const { error: dealError } = await supabase
      .from("deals")
      .update({ 
        status: newStatus,
        ...(newStatus === "in_transit" ? { started_at: new Date().toISOString() } : {}),
        ...(newStatus === "delivered" ? { completed_at: new Date().toISOString() } : {}),
      })
      .eq("id", deal.id);

    if (dealError) {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить статус",
        variant: "destructive",
      });
      setUpdatingStatus(false);
      return;
    }

    // Add system message
    await supabase.from("messages").insert({
      deal_id: deal.id,
      sender_id: user.id,
      content: message,
      is_system: true,
    });

    setUpdatingStatus(false);

    toast({
      title: "Статус обновлён",
      description: message,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!deal) return null;

  const status = statusConfig[deal.status];
  const StatusIcon = status.icon;
  const isCarrier = deal.carrier_id === user?.id;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card shrink-0">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-semibold flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Чат сделки
                </h1>
                <p className="text-sm text-muted-foreground">
                  {otherParticipantName}
                </p>
              </div>
            </div>
            <Badge className={`${status.color} text-white`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {status.label}
            </Badge>
          </div>
        </div>
      </header>

      {/* Deal Info & Actions */}
      <div className="border-b bg-muted/30 shrink-0">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{deal.order?.cargo_type}</span>
              </div>
              <div className="font-semibold text-driver">
                {deal.agreed_price.toLocaleString()} ₽
              </div>
            </div>

            {/* Status Actions for Carrier */}
            {isCarrier && (
              <div className="flex gap-2">
                {deal.status === "pending" && (
                  <Button
                    size="sm"
                    variant="driver"
                    onClick={() => updateDealStatus("accepted", "Перевозчик принял заказ")}
                    disabled={updatingStatus}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Принять заказ
                  </Button>
                )}
                {deal.status === "accepted" && (
                  <Button
                    size="sm"
                    variant="driver"
                    onClick={() => updateDealStatus("in_transit", "Груз в пути")}
                    disabled={updatingStatus}
                  >
                    <Navigation className="w-4 h-4 mr-1" />
                    Начать доставку
                  </Button>
                )}
                {deal.status === "in_transit" && (
                  <Button
                    size="sm"
                    variant="driver"
                    onClick={() => updateDealStatus("delivered", "Груз доставлен!")}
                    disabled={updatingStatus}
                  >
                    <Flag className="w-4 h-4 mr-1" />
                    Завершить доставку
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Route */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
            <MapPin className="w-3 h-3" />
            {deal.order?.pickup_address} → {deal.order?.delivery_address}
          </div>
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col min-h-0">
        <ChatMessages
          contextType="deal"
          contextId={dealId!}
          participantIds={[deal.client_id, deal.carrier_id]}
        />
      </div>
    </div>
  );
};

export default DealChat;
