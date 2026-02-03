import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { 
  ArrowLeft, Package, MapPin, Calendar, Weight, Ruler, 
  User, Star, Clock, CheckCircle, Loader2, MessageSquare, Banknote 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PriceNegotiation } from "@/components/negotiations/PriceNegotiation";

interface Order {
  id: string;
  cargo_type: string;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  pickup_address: string;
  delivery_address: string;
  pickup_date: string;
  description: string | null;
  status: string;
  client_price: number | null;
}

interface Response {
  id: string;
  carrier_id: string;
  price: number;
  delivery_time: string | null;
  comment: string | null;
  is_accepted: boolean;
  created_at: string;
  carrier_profile?: {
    full_name: string | null;
    avatar_url: string | null;
    carrier_type: string | null;
    vehicle_type: string | null;
    is_verified: boolean;
  };
  carrier_rating?: number | null;
}

const OrderResponses = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useFirebaseAuth();
  const { toast } = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState<Response | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [expandedNegotiation, setExpandedNegotiation] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!orderId || !user) return;

      setLoading(true);

      // Fetch order
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .eq("client_id", user?.uid || "")
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

      setOrder(orderData);

      // Fetch responses
      const { data: responsesData, error: responsesError } = await supabase
        .from("responses")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });

      if (responsesError) {
        console.error("Error fetching responses:", responsesError);
        setLoading(false);
        return;
      }

      // Fetch carrier profiles and ratings
      const carrierIds = responsesData?.map(r => r.carrier_id) || [];
      
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, carrier_type, vehicle_type, is_verified")
        .in("user_id", carrierIds);

      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);

      // Fetch ratings for each carrier
      const ratingsPromises = carrierIds.map(async (carrierId) => {
        const { data } = await supabase
          .from("ratings")
          .select("score")
          .eq("rated_id", carrierId);
        
        const avg = data && data.length > 0
          ? data.reduce((acc, r) => acc + r.score, 0) / data.length
          : null;
        
        return [carrierId, avg] as [string, number | null];
      });

      const ratingsResults = await Promise.all(ratingsPromises);
      const ratingsMap = new Map(ratingsResults);

      // Combine data
      const responsesWithDetails = (responsesData || []).map(response => ({
        ...response,
        carrier_profile: profilesMap.get(response.carrier_id),
        carrier_rating: ratingsMap.get(response.carrier_id),
      }));

      setResponses(responsesWithDetails);
      setLoading(false);
    };

    fetchData();
  }, [orderId, user]);

  const handleAcceptResponse = (response: Response) => {
    setSelectedResponse(response);
    setConfirmDialogOpen(true);
  };

  const confirmAcceptResponse = async () => {
    if (!selectedResponse || !order || !user) return;

    setAccepting(true);

    // Create deal
    const { data: dealData, error: dealError } = await supabase
      .from("deals")
      .insert({
        order_id: order.id,
        client_id: user?.uid || "",
        carrier_id: selectedResponse.carrier_id,
        agreed_price: selectedResponse.price,
        status: "pending",
      })
      .select()
      .single();

    if (dealError) {
      toast({
        title: "Ошибка",
        description: "Не удалось создать сделку",
        variant: "destructive",
      });
      console.error("Deal creation error:", dealError);
      setAccepting(false);
      return;
    }

    // Update response as accepted
    await supabase
      .from("responses")
      .update({ is_accepted: true })
      .eq("id", selectedResponse.id);

    // Update order status
    await supabase
      .from("orders")
      .update({ status: "in_progress" })
      .eq("id", order.id);

    // Create system message in deal chat
    await supabase
      .from("messages")
      .insert({
        deal_id: dealData.id,
        sender_id: user?.uid || "",
        content: "Сделка создана. Перевозчик назначен.",
        is_system: true,
      });

    setAccepting(false);
    setConfirmDialogOpen(false);

    toast({
      title: "Сделка создана!",
      description: "Перевозчик получит уведомление",
    });

    navigate("/dashboard");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад к заявкам
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Order Summary */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  {order.cargo_type}
                </CardTitle>
                <CardDescription className="mt-2">
                  Заявка от {format(new Date(order.pickup_date), "d MMMM yyyy", { locale: ru })}
                </CardDescription>
              </div>
              <Badge 
                className={order.status === "open" ? "bg-driver text-white" : "bg-customer text-white"}
              >
                {order.status === "open" ? "Открыта" : "В работе"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-driver" />
                <span className="text-muted-foreground">Откуда:</span>
                <span className="font-medium">{order.pickup_address}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-customer" />
                <span className="text-muted-foreground">Куда:</span>
                <span className="font-medium">{order.delivery_address}</span>
              </div>
              {order.weight && (
                <div className="flex items-center gap-2">
                  <Weight className="w-4 h-4" />
                  <span className="text-muted-foreground">Вес:</span>
                  <span className="font-medium">{order.weight} кг</span>
                </div>
              )}
              {(order.length || order.width || order.height) && (
                <div className="flex items-center gap-2">
                  <Ruler className="w-4 h-4" />
                  <span className="text-muted-foreground">Габариты:</span>
                  <span className="font-medium">
                    {[order.length, order.width, order.height].filter(Boolean).join(" × ")} м
                  </span>
                </div>
              )}
            </div>
            {order.description && (
              <p className="mt-4 text-sm text-muted-foreground">{order.description}</p>
            )}
          </CardContent>
        </Card>

        {/* Responses */}
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Отклики перевозчиков ({responses.length})
        </h2>

        {responses.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Пока нет откликов</p>
              <p className="text-sm text-muted-foreground">
                Перевозчики скоро увидят вашу заявку
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {responses.map((response) => (
              <Card 
                key={response.id} 
                className={`transition-all ${
                  response.is_accepted 
                    ? "border-driver bg-driver-light/30" 
                    : "hover:shadow-md"
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    {/* Carrier Info */}
                    <div className="flex items-start gap-4 flex-1">
                      <Avatar className="w-12 h-12">
                        <AvatarFallback className="gradient-driver text-white">
                          {response.carrier_profile?.full_name?.charAt(0) || "П"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link 
                            to={`/profile/${response.carrier_id}`}
                            className="font-semibold hover:text-driver underline-offset-2 hover:underline transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {response.carrier_profile?.full_name || "Перевозчик"}
                          </Link>
                          {response.carrier_profile?.is_verified && (
                            <Badge variant="outline" className="text-driver border-driver">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Проверен
                            </Badge>
                          )}
                          {response.is_accepted && (
                            <Badge className="bg-driver text-white">
                              Принят
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          {response.carrier_profile?.vehicle_type && (
                            <span>{response.carrier_profile.vehicle_type}</span>
                          )}
                          {response.carrier_rating && (
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 text-gold fill-gold" />
                              {response.carrier_rating.toFixed(1)}
                            </div>
                          )}
                        </div>

                        {response.comment && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {response.comment}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Price & Actions */}
                    <div className="flex flex-col items-end gap-3">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-driver">
                          {response.price.toLocaleString()} ₽
                        </div>
                        {order.client_price && response.price !== order.client_price && (
                          <div className="text-xs text-muted-foreground">
                            Вы предлагали: {order.client_price.toLocaleString()} ₽
                          </div>
                        )}
                        {response.delivery_time && (
                          <div className="text-sm text-muted-foreground">
                            Срок: {response.delivery_time}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {order.status === "open" && !response.is_accepted && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setExpandedNegotiation(
                                expandedNegotiation === response.id ? null : response.id
                              )}
                            >
                              <Banknote className="w-4 h-4 mr-1" />
                              Торг
                            </Button>
                            <Button
                              variant="driver"
                              size="sm"
                              onClick={() => handleAcceptResponse(response)}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Принять
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Negotiation Panel */}
                  {expandedNegotiation === response.id && order.status === "open" && (
                    <div className="mt-4 pt-4 border-t">
                      <PriceNegotiation
                        orderId={order.id}
                        responseId={response.id}
                        clientId={user?.id || ""}
                        carrierId={response.carrier_id}
                        currentPrice={response.price}
                        clientPrice={order.client_price}
                        onPriceAgreed={(newPrice) => {
                          // Update the response price in state
                          setResponses(prev => prev.map(r => 
                            r.id === response.id ? { ...r, price: newPrice } : r
                          ));
                        }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтвердите выбор перевозчика</AlertDialogTitle>
            <AlertDialogDescription>
              Вы выбираете перевозчика{" "}
              <strong>{selectedResponse?.carrier_profile?.full_name || "Перевозчик"}</strong>{" "}
              за <strong>{selectedResponse?.price.toLocaleString()} ₽</strong>.
              <br /><br />
              После подтверждения будет создана сделка, и вы сможете общаться в чате.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={accepting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAcceptResponse}
              disabled={accepting}
              className="gradient-driver text-white"
            >
              {accepting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Создание сделки...
                </>
              ) : (
                "Подтвердить"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OrderResponses;
