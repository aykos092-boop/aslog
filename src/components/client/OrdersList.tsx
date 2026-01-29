import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, differenceInHours } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { Package, MapPin, Calendar, Weight, Ruler, MessageSquare, Eye, Loader2, X, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  photo_urls: string[] | null;
  status: "open" | "in_progress" | "completed" | "cancelled";
  created_at: string;
  responses_count?: number;
}

interface OrdersListProps {
  refreshTrigger?: number;
}

export const OrdersList = ({ refreshTrigger }: OrdersListProps) => {
  const { user } = useFirebaseAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const dateLocale = language === "ru" ? ru : language === "uz" ? ru : enUS;

  const statusConfig = {
    open: { label: t("orders.status.open"), variant: "default" as const, className: "bg-driver text-white" },
    in_progress: { label: t("orders.status.in_progress"), variant: "default" as const, className: "bg-customer text-white" },
    completed: { label: t("orders.status.completed"), variant: "default" as const, className: "bg-gold text-white" },
    cancelled: { label: t("orders.status.cancelled"), variant: "secondary" as const, className: "" },
  };

  const fetchOrders = async () => {
    if (!user) return;

    setLoading(true);
    
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("client_id", user.uid)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching orders:", error);
    } else {
      // Get response counts for each order
      const ordersWithCounts = await Promise.all(
        (data || []).map(async (order) => {
          const { count } = await supabase
            .from("responses")
            .select("*", { count: "exact", head: true })
            .eq("order_id", order.id);
          
          return { ...order, responses_count: count || 0 };
        })
      );
      setOrders(ordersWithCounts);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [user, refreshTrigger]);

  const canEditOrCancel = (order: Order) => {
    if (order.status !== "open") return false;
    const hoursSinceCreation = differenceInHours(new Date(), new Date(order.created_at));
    return hoursSinceCreation < 24;
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    
    setCancelling(true);
    
    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", selectedOrder.id);

    setCancelling(false);
    setCancelDialogOpen(false);

    if (error) {
      toast({
        title: t("common.error"),
        description: t("ordersList.cancelFailed"),
        variant: "destructive",
      });
    } else {
      toast({
        title: t("ordersList.orderCancelled"),
        description: t("ordersList.orderCancelledDesc"),
      });
      fetchOrders();
    }
  };

  const openCancelDialog = (order: Order) => {
    setSelectedOrder(order);
    setCancelDialogOpen(true);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">{t("ordersList.loadingOrders")}</p>
        </CardContent>
      </Card>
    );
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">{t("ordersList.noOrdersYet")}</p>
          <p className="text-sm text-muted-foreground">{t("ordersList.createFirstOrder")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("ordersList.myOrders")}</CardTitle>
          <CardDescription>
            {t("ordersList.totalOrders")}: {orders.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {orders.map((order) => {
            const status = statusConfig[order.status];
            const editable = canEditOrCancel(order);
            
            return (
              <div
                key={order.id}
                className="p-4 rounded-xl border bg-card hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  {/* Main Info */}
                  <div className="flex-1 space-y-3">
                    {/* Header */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-semibold text-lg">{order.cargo_type}</h3>
                      <Badge className={status.className}>
                        {status.label}
                      </Badge>
                      {order.responses_count && order.responses_count > 0 && (
                        <Badge variant="outline" className="gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {order.responses_count} {t("ordersList.responses")}
                        </Badge>
                      )}
                      {order.photo_urls && order.photo_urls.length > 0 && (
                        <Badge variant="outline" className="gap-1">
                          <ImageIcon className="w-3 h-3" />
                          {order.photo_urls.length} {t("ordersList.photos")}
                        </Badge>
                      )}
                      {editable && (
                        <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                          {t("ordersList.canEdit")}
                        </Badge>
                      )}
                    </div>

                    {/* Route */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4 text-driver shrink-0" />
                        <span className="truncate">{order.pickup_address}</span>
                      </div>
                      <span className="hidden sm:block text-muted-foreground">→</span>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4 text-customer shrink-0" />
                        <span className="truncate">{order.delivery_address}</span>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(order.pickup_date), "d MMMM yyyy", { locale: dateLocale })}
                      </div>
                      {order.weight && (
                        <div className="flex items-center gap-1">
                          <Weight className="w-4 h-4" />
                          {order.weight} {t("common.kg")}
                        </div>
                      )}
                      {(order.length || order.width || order.height) && (
                        <div className="flex items-center gap-1">
                          <Ruler className="w-4 h-4" />
                          {[order.length, order.width, order.height].filter(Boolean).join(" × ")} м
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    {order.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {order.description}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate(`/navigator/order/${order.id}`)}
                      title="Посмотреть маршрут"
                    >
                      <MapPin className="w-4 h-4 mr-1" />
                      {t("ordersList.viewRoute")}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate(`/orders/${order.id}/responses`)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      {t("ordersList.details")}
                    </Button>
                    {order.status === "open" && order.responses_count && order.responses_count > 0 && (
                      <Button 
                        variant="customer" 
                        size="sm"
                        onClick={() => navigate(`/orders/${order.id}/responses`)}
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        {t("ordersList.responses")} ({order.responses_count})
                      </Button>
                    )}
                    {editable && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => openCancelDialog(order)}
                      >
                        <X className="w-4 h-4 mr-1" />
                        {t("ordersList.cancelOrder")}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("ordersList.cancelOrderTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("ordersList.cancelOrderDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("ordersList.dontCancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelOrder}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {t("ordersList.yesCancel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};