import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { 
  MessageSquare, 
  Banknote, 
  Check, 
  X, 
  Loader2,
  ArrowRight,
  User
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Negotiation {
  id: string;
  order_id: string;
  response_id: string | null;
  proposed_by: string;
  proposed_price: number;
  message: string | null;
  status: string;
  created_at: string;
  proposer_name?: string;
}

interface PriceNegotiationProps {
  orderId: string;
  responseId?: string;
  clientId: string;
  carrierId: string;
  currentPrice: number;
  clientPrice?: number | null;
  onPriceAgreed?: (price: number) => void;
}

export const PriceNegotiation = ({
  orderId,
  responseId,
  clientId,
  carrierId,
  currentPrice,
  clientPrice,
  onPriceAgreed,
}: PriceNegotiationProps) => {
  const { user } = useFirebaseAuth();
  const { toast } = useToast();
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newPrice, setNewPrice] = useState("");
  const [newMessage, setNewMessage] = useState("");

  const isClient = user?.uid === clientId;
  const isCarrier = user?.uid === carrierId;
  const latestNegotiation = negotiations[0];
  const canPropose = latestNegotiation?.status !== "accepted" && 
    (latestNegotiation?.proposed_by !== user?.uid || negotiations.length === 0);

  useEffect(() => {
    fetchNegotiations();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel(`negotiations-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "price_negotiations",
          filter: `order_id=eq.${orderId}`,
        },
        () => fetchNegotiations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  const fetchNegotiations = async () => {
    const { data, error } = await supabase
      .from("price_negotiations")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });

    if (data) {
      // Get proposer names
      const userIds = [...new Set(data.map(n => n.proposed_by))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]));

      setNegotiations(
        data.map(n => ({
          ...n,
          proposer_name: profileMap.get(n.proposed_by) || "Участник",
        }))
      );
    }
    setLoading(false);
  };

  const proposePrice = async () => {
    if (!user || !newPrice) return;

    setSubmitting(true);

    const { error } = await supabase.from("price_negotiations").insert({
      order_id: orderId,
      response_id: responseId || null,
      proposed_by: user?.uid || "",
      proposed_price: parseFloat(newPrice),
      message: newMessage || null,
      status: "pending",
    });

    setSubmitting(false);

    if (error) {
      toast({
        title: "Xato",
        description: "Taklifni yuborib bo'lmadi",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Taklif yuborildi",
        description: `Siz ${parseFloat(newPrice).toLocaleString("ru-RU")} so'm taklif qildingiz`,
      });
      setNewPrice("");
      setNewMessage("");
    }
  };

  const respondToProposal = async (negotiationId: string, accept: boolean) => {
    setSubmitting(true);

    const negotiation = negotiations.find(n => n.id === negotiationId);
    
    if (accept && negotiation) {
      // Update the negotiation status
      await supabase
        .from("price_negotiations")
        .update({ status: "accepted" })
        .eq("id", negotiationId);

      // If there's a response, update its price
      if (responseId) {
        await supabase
          .from("responses")
          .update({ price: negotiation.proposed_price })
          .eq("id", responseId);
      }

      // IMPORTANT: Also update the deal's agreed_price if this negotiation is for a deal
      // Find any deal associated with this order and update its agreed_price
      const { data: deals } = await supabase
        .from("deals")
        .select("id")
        .eq("order_id", orderId);

      if (deals && deals.length > 0) {
        await supabase
          .from("deals")
          .update({ agreed_price: negotiation.proposed_price })
          .eq("order_id", orderId);
      }

      toast({
        title: "Narx kelishildi!",
        description: `Yakuniy narx: ${negotiation.proposed_price.toLocaleString("ru-RU")} so'm`,
      });

      onPriceAgreed?.(negotiation.proposed_price);
    } else {
      await supabase
        .from("price_negotiations")
        .update({ status: "rejected" })
        .eq("id", negotiationId);

      toast({
        title: "Taklif rad etildi",
        description: "Siz o'z narxingizni taklif qilishingiz mumkin",
      });
    }

    setSubmitting(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Javob kutilmoqda</Badge>;
      case "accepted":
        return <Badge className="bg-green-500">Qabul qilindi</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rad etildi</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="py-4 text-center">
        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Banknote className="w-4 h-4" />
          Narx savdosi
        </CardTitle>
        <CardDescription>
          {clientPrice && (
            <span className="text-sm">
              Mijoz narxi: <strong>{clientPrice.toLocaleString("ru-RU")} so'm</strong>
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Price */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <span className="text-sm text-muted-foreground">Joriy narx</span>
          <span className="text-lg font-bold">{currentPrice.toLocaleString("ru-RU")} so'm</span>
        </div>

        {/* Negotiation History */}
        {negotiations.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {negotiations.map((neg) => (
              <div
                key={neg.id}
                className={`p-3 rounded-lg border ${
                  neg.status === "accepted" 
                    ? "bg-green-50 border-green-200 dark:bg-green-950/30" 
                    : neg.status === "rejected"
                    ? "bg-red-50 border-red-200 dark:bg-red-950/30"
                    : "bg-muted/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <User className="w-3 h-3" />
                      <span className="text-sm font-medium">{neg.proposer_name}</span>
                      <ArrowRight className="w-3 h-3" />
                      <span className="font-bold text-primary">
                        {neg.proposed_price.toLocaleString("ru-RU")} so'm
                      </span>
                      {getStatusBadge(neg.status)}
                    </div>
                    {neg.message && (
                      <p className="text-sm text-muted-foreground mt-1">{neg.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(neg.created_at), "d MMM, HH:mm", { locale: ru })}
                    </p>
                  </div>

                  {/* Actions for pending proposals */}
                  {neg.status === "pending" && neg.proposed_by !== user?.uid && (
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
                        onClick={() => respondToProposal(neg.id, true)}
                        disabled={submitting}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100"
                        onClick={() => respondToProposal(neg.id, false)}
                        disabled={submitting}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Price Agreed Message */}
        {latestNegotiation?.status === "accepted" && (
          <div className="p-4 rounded-lg bg-green-100 dark:bg-green-950/50 text-center">
            <Check className="w-6 h-6 mx-auto text-green-600 mb-2" />
            <p className="font-medium text-green-800 dark:text-green-200">
              Narx kelishildi: {latestNegotiation.proposed_price.toLocaleString("ru-RU")} so'm
            </p>
          </div>
        )}

        {/* New Proposal Form */}
        {canPropose && latestNegotiation?.status !== "accepted" && (
          <div className="space-y-3 pt-2 border-t">
            <p className="text-sm font-medium">
              {isCarrier ? "O'z narxingizni taklif qiling:" : "Narxni taklif qiling:"}
            </p>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Narx (so'm)"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
              />
            </div>
            <Textarea
              placeholder="Izoh (ixtiyoriy)"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="resize-none"
              rows={2}
            />
            <Button
              onClick={proposePrice}
              disabled={submitting || !newPrice}
              className="w-full"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <MessageSquare className="w-4 h-4 mr-2" />
              )}
              Taklif qilish {newPrice && `${parseFloat(newPrice).toLocaleString("ru-RU")} so'm`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
