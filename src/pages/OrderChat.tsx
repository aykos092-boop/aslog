import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowLeft, Package, MapPin, MessageSquare, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChatMessages } from "@/components/chat/ChatMessages";

interface Order {
  id: string;
  client_id: string;
  cargo_type: string;
  pickup_address: string;
  delivery_address: string;
  pickup_date: string;
  status: string;
}

const OrderChat = () => {
  const { orderId, carrierId } = useParams<{ orderId: string; carrierId: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [otherParticipantName, setOtherParticipantName] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      if (!orderId || !user) return;

      setLoading(true);

      // Fetch order
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (orderError || !orderData) {
        toast({
          title: "Ошибка",
          description: "Заявка не найдена",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      // Verify user is participant
      const isClient = orderData.client_id === user.id;
      const isCarrier = role === "carrier";

      if (!isClient && !isCarrier) {
        toast({
          title: "Доступ запрещён",
          description: "Вы не являетесь участником этого чата",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setOrder(orderData);

      // Get other participant's name
      const otherUserId = isClient ? carrierId : orderData.client_id;
      if (otherUserId) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", otherUserId)
          .single();

        setOtherParticipantName(profileData?.full_name || "Участник");
      }

      setLoading(false);
    };

    fetchData();
  }, [orderId, carrierId, user, role]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) return null;

  const participantIds = [order.client_id];
  if (carrierId) participantIds.push(carrierId);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card shrink-0">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-semibold flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Чат по заявке
                </h1>
                <p className="text-sm text-muted-foreground">
                  {otherParticipantName}
                </p>
              </div>
            </div>
            <Badge variant="outline">Обсуждение</Badge>
          </div>
        </div>
      </header>

      {/* Order Info */}
      <div className="border-b bg-muted/30 shrink-0">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{order.cargo_type}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-3 h-3" />
              {order.pickup_address} → {order.delivery_address}
            </div>
          </div>
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col min-h-0">
        <ChatMessages
          contextType="order"
          contextId={orderId!}
          participantIds={participantIds}
        />
      </div>
    </div>
  );
};

export default OrderChat;
