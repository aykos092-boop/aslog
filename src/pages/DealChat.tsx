import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { ru, uz } from "date-fns/locale";
import { enUS } from "date-fns/locale";
import { 
  ArrowLeft, Package, MapPin, MessageSquare, Loader2, 
  Truck, CheckCircle, Navigation, Flag, Star, XCircle, Banknote, Maximize2,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { LiveMap } from "@/components/tracking/LiveMap";
import { GpsTracker } from "@/components/tracking/GpsTracker";
import { ClientTrackingPanel } from "@/components/tracking/ClientTrackingPanel";
import { RatingForm } from "@/components/ratings/RatingForm";
import { RatingDisplay } from "@/components/ratings/RatingDisplay";
import { FavoriteCarrierButton } from "@/components/favorites/FavoriteCarrierButton";
import { PriceNegotiation } from "@/components/negotiations/PriceNegotiation";

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
    client_price?: number | null;
    pickup_lat?: number | null;
    pickup_lng?: number | null;
    delivery_lat?: number | null;
    delivery_lng?: number | null;
  };
}

interface Rating {
  id: string;
  score: number;
  comment: string | null;
  created_at: string;
  rater_id: string;
  rated_id: string;
}

const DealChat = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const { user, role } = useFirebaseAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();

  const dateLocale = language === "ru" ? ru : language === "uz" ? uz : enUS;

  const statusConfig = {
    pending: { label: t("deals.status.pending"), icon: Truck, color: "bg-muted" },
    accepted: { label: t("deals.status.accepted"), icon: CheckCircle, color: "bg-customer" },
    in_transit: { label: t("deals.status.in_transit"), icon: Navigation, color: "bg-driver" },
    delivered: { label: t("deals.status.delivered"), icon: Flag, color: "bg-gold" },
    cancelled: { label: t("deals.status.cancelled"), icon: Truck, color: "bg-destructive" },
  };

  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [otherParticipantName, setOtherParticipantName] = useState<string>("");
  const [myRating, setMyRating] = useState<Rating | null>(null);
  const [otherRating, setOtherRating] = useState<Rating | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const fetchDeal = async () => {
    if (!dealId || !user) return;

    const { data: dealData, error: dealError } = await supabase
      .from("deals")
      .select(`
        *,
        order:orders(cargo_type, pickup_address, delivery_address, pickup_date, client_price, pickup_lat, pickup_lng, delivery_lat, delivery_lng)
      `)
      .eq("id", dealId)
      .single();

    if (dealError || !dealData) {
      toast({
        title: t("dealChat.error"),
        description: t("dealChat.dealNotFound"),
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    // Verify user is participant
    const isClientUser = dealData.client_id === user?.uid;
    const isCarrierUser = dealData.carrier_id === user?.uid;

    if (!isClientUser && !isCarrierUser) {
      toast({
        title: t("dealChat.accessDenied"),
        description: t("dealChat.notParticipant"),
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    setDeal(dealData);

    // Get other participant's name
    const otherUserId = isClientUser ? dealData.carrier_id : dealData.client_id;
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", otherUserId)
      .single();

    setOtherParticipantName(profileData?.full_name || t("dealChat.participant"));
    setLoading(false);
  };

  const fetchRatings = async () => {
    if (!dealId || !user) return;

    const { data: ratings } = await supabase
      .from("ratings")
      .select("*")
      .eq("deal_id", dealId);

    if (ratings) {
      const mine = ratings.find(r => r.rater_id === user?.uid);
      const theirs = ratings.find(r => r.rated_id === user?.uid);
      setMyRating(mine || null);
      setOtherRating(theirs || null);
    }
  };

  useEffect(() => {
    fetchDeal();
    fetchRatings();
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
        title: t("dealChat.error"),
        description: t("dealChat.updateFailed"),
        variant: "destructive",
      });
      setUpdatingStatus(false);
      return;
    }

    // Add system message
    await supabase.from("messages").insert({
      deal_id: deal.id,
      sender_id: user?.uid || "",
      content: message,
      is_system: true,
    });

    setUpdatingStatus(false);

    toast({
      title: t("dealChat.statusUpdated"),
      description: message,
    });
  };

  const handleCancelDeal = async () => {
    if (!deal || !user || !cancelReason.trim()) return;

    setCancelling(true);

    // Update deal status to cancelled
    const { error: dealError } = await supabase
      .from("deals")
      .update({ status: "cancelled" })
      .eq("id", deal.id);

    if (dealError) {
      toast({
        title: t("dealChat.error"),
        description: t("dealChat.cancelFailed"),
        variant: "destructive",
      });
      setCancelling(false);
      return;
    }

    // Reopen the order so other carriers can respond
    await supabase
      .from("orders")
      .update({ status: "open" })
      .eq("id", deal.order_id);

    // Add system message with cancellation reason
    const cancellerRole = isCarrier ? t("dealChat.carrier") : t("dealChat.client");
    await supabase.from("messages").insert({
      deal_id: deal.id,
      sender_id: user?.uid || "",
      content: `${cancellerRole} ${t("dealChat.dealCancelled").toLowerCase()}. ${t("dealChat.cancelReason")}: ${cancelReason.trim()}`,
      is_system: true,
    });

    setCancelling(false);
    setCancelDialogOpen(false);
    setCancelReason("");

    toast({
      title: t("dealChat.dealCancelled"),
      description: t("dealChat.orderAvailable"),
    });

    navigate("/dashboard");
  };

  const canCancel = deal && ["pending", "accepted"].includes(deal.status);

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
  const isCarrier = deal.carrier_id === user?.uid;

  const isClient = deal.client_id === user?.uid;
  const showGpsTracking = deal.status === "in_transit";
  const showRating = deal.status === "delivered";
  const otherUserId = isCarrier ? deal.client_id : deal.carrier_id;

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
                  {t("dealChat.title")}
                </h1>
                <div className="flex items-center gap-1">
                  <Link 
                    to={`/profile/${otherUserId}`}
                    className="text-sm text-muted-foreground hover:text-primary underline-offset-2 hover:underline transition-colors"
                  >
                    {otherParticipantName}
                  </Link>
                  {/* Favorite button for clients viewing carrier */}
                  {isClient && (
                    <FavoriteCarrierButton carrierId={deal.carrier_id} />
                  )}
                </div>
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
              <div className="flex flex-col gap-2 w-full sm:w-auto">
                {deal.status === "pending" && (
                  <div className="flex items-center gap-2 p-3 bg-driver/10 border border-driver/20 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-driver" />
                    <span className="text-sm font-medium text-driver">
                        Клиент ожидает вашего подтверждения
                    </span>
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  {deal.status === "pending" && (
                    <Button
                      size="sm"
                      className="bg-driver hover:bg-driver/90 text-white font-semibold px-4 py-2"
                      onClick={() => updateDealStatus("accepted", t("dealChat.carrierAccepted"))}
                      disabled={updatingStatus}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      ✅ Принять заказ
                    </Button>
                  )}
                  {deal.status === "accepted" && (
                    <Button
                      size="sm"
                      className="bg-driver hover:bg-driver/90 text-white font-semibold px-4 py-2"
                      onClick={() => updateDealStatus("in_transit", t("dealChat.cargoInTransit"))}
                      disabled={updatingStatus}
                    >
                      <Navigation className="w-4 h-4 mr-2" />
                      🚚 Начать доставку
                    </Button>
                  )}
                  {deal.status === "in_transit" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/navigator/deal/${dealId}`)}
                      >
                        <Maximize2 className="w-4 h-4 mr-1" />
                        🗺️ Навигация
                      </Button>
                      <Button
                        size="sm"
                        className="bg-driver hover:bg-driver/90 text-white font-semibold px-4 py-2"
                        onClick={() => updateDealStatus("delivered", t("dealChat.cargoDelivered"))}
                        disabled={updatingStatus}
                      >
                        <Flag className="w-4 h-4 mr-2" />
                        ✅ Доставлено
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Cancel Button - available for both parties before in_transit */}
            {canCancel && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setCancelDialogOpen(true)}
                disabled={updatingStatus}
              >
                <XCircle className="w-4 h-4 mr-1" />
                {t("dealChat.cancelDeal")}
              </Button>
            )}
          </div>

          {/* Route */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
            <MapPin className="w-3 h-3" />
            {deal.order?.pickup_address} → {deal.order?.delivery_address}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Side Panel: GPS/Map, Rating, or Negotiation */}
        <div className={`shrink-0 border-b lg:border-b-0 lg:border-r bg-muted/20 overflow-hidden flex flex-col ${
          showGpsTracking && isCarrier ? "lg:w-[420px] h-[500px] lg:h-auto" : "lg:w-80"
        }`}>
          {/* Price Negotiation - show for pending/accepted deals */}
          {["pending", "accepted"].includes(deal.status) && (
            <div className="p-4 shrink-0">
              <PriceNegotiation
                orderId={deal.order_id}
                clientId={deal.client_id}
                carrierId={deal.carrier_id}
                currentPrice={deal.agreed_price}
                clientPrice={deal.order?.client_price}
                onPriceAgreed={(newPrice) => {
                  setDeal(prev => prev ? { ...prev, agreed_price: newPrice } : null);
                  toast({
                    title: t("dealChat.priceUpdated"),
                    description: `${t("dealChat.newAgreedPrice")}: ${newPrice.toLocaleString()} ₽`,
                  });
                }}
              />
            </div>
          )}

          {/* GPS Tracking - Driver sees Navigator link, Client sees ClientTrackingPanel */}
          {showGpsTracking && (
            isCarrier ? (
              <div className="flex-1 min-h-0 p-4">
                <div className="bg-card border rounded-lg p-6 text-center space-y-4">
                  <Navigation className="w-12 h-12 mx-auto text-primary" />
                  <h3 className="text-lg font-semibold">{t("navigation.title")}</h3>
                  <p className="text-muted-foreground text-sm">
                    {deal.order?.pickup_address} → {deal.order?.delivery_address}
                  </p>
                  <Button 
                    size="lg" 
                    className="w-full"
                    onClick={() => navigate(`/navigator/deal/${dealId}`)}
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    {t("navigation.openNavigator")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4 overflow-y-auto max-h-[500px] lg:max-h-none">
                <ClientTrackingPanel dealId={dealId!} />
              </div>
            )
          )}

          {/* Rating Section */}
          {showRating && (
            <div className="p-4 space-y-4 overflow-y-auto">
              {myRating ? (
                <RatingDisplay 
                  rating={myRating} 
                  title={t("dealChat.yourReview")} 
                />
              ) : (
                <RatingForm
                  dealId={dealId!}
                  ratedUserId={otherUserId}
                  ratedUserName={otherParticipantName}
                  onRatingSubmitted={fetchRatings}
                />
              )}

              {otherRating && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="w-4 h-4 text-gold fill-gold" />
                      <span className="font-medium text-sm">{t("dealChat.reviewFrom")} {otherParticipantName}</span>
                    </div>
                    <div className="flex gap-0.5 mb-2">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= otherRating.score ? "fill-gold text-gold" : "text-muted-foreground"
                          }`}
                        />
                      ))}
                    </div>
                    {otherRating.comment && (
                      <p className="text-sm text-muted-foreground italic">"{otherRating.comment}"</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Chat */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <ChatMessages
            contextType="deal"
            contextId={dealId!}
            participantIds={[deal.client_id, deal.carrier_id]}
          />
        </div>
      </div>

      {/* Cancel Deal Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-destructive" />
              {t("dealChat.cancelQuestion")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("dealChat.cancelDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-2 py-2">
            <Label htmlFor="cancel-reason">{t("dealChat.cancelReason")} *</Label>
            <Textarea
              id="cancel-reason"
              placeholder={t("dealChat.cancelReasonPlaceholder")}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>{t("common.back")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelDeal}
              disabled={cancelling || !cancelReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("dealChat.cancelling")}
                </>
              ) : (
                t("dealChat.cancelDeal")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DealChat;
