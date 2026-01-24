import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Package, MapPin, Calendar, Weight, Ruler, Send, Loader2, Eye, Search, Filter, X, CalendarIcon, ArrowUpDown, Image as ImageIcon, Banknote, Navigation } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Order {
  id: string;
  client_id: string;
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
  created_at: string;
  photo_urls: string[] | null;
  client_price: number | null;
  client_profile?: {
    full_name: string | null;
  };
  has_responded?: boolean;
}

export const AvailableOrdersList = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  
  // Response form state
  const [price, setPrice] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [cargoTypeFilter, setCargoTypeFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<string>("date_desc");

  const fetchOrders = async () => {
    if (!user) return;

    setLoading(true);
    
    // Fetch open orders
    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false });

    if (ordersError) {
      console.error("Error fetching orders:", ordersError);
      setLoading(false);
      return;
    }

    // Check which orders the carrier has already responded to
    const { data: responsesData } = await supabase
      .from("responses")
      .select("order_id")
      .eq("carrier_id", user.id);

    const respondedOrderIds = new Set(responsesData?.map(r => r.order_id) || []);

    // Fetch client profiles
    const clientIds = [...new Set(ordersData?.map(o => o.client_id) || [])];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", clientIds);

    const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);

    // Combine data
    const ordersWithDetails = (ordersData || []).map(order => ({
      ...order,
      client_profile: profilesMap.get(order.client_id),
      has_responded: respondedOrderIds.has(order.id),
    }));

    setOrders(ordersWithDetails);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  // Get unique cargo types for filter
  const cargoTypes = useMemo(() => {
    const types = [...new Set(orders.map(o => o.cargo_type))];
    return types.sort();
  }, [orders]);

  // Filter orders based on search and filters
  const filteredOrders = useMemo(() => {
    let result = orders.filter(order => {
      // Search query filter (route + cargo type)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesRoute = 
          order.pickup_address.toLowerCase().includes(query) ||
          order.delivery_address.toLowerCase().includes(query);
        const matchesCargo = order.cargo_type.toLowerCase().includes(query);
        if (!matchesRoute && !matchesCargo) return false;
      }

      // Cargo type filter
      if (cargoTypeFilter && cargoTypeFilter !== "all") {
        if (order.cargo_type !== cargoTypeFilter) return false;
      }

      // Date range filter
      const orderDate = new Date(order.pickup_date);
      if (dateFrom && orderDate < dateFrom) return false;
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (orderDate > endOfDay) return false;
      }

      return true;
    });

    // Sort orders
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "date_asc":
          return new Date(a.pickup_date).getTime() - new Date(b.pickup_date).getTime();
        case "date_desc":
          return new Date(b.pickup_date).getTime() - new Date(a.pickup_date).getTime();
        case "created_asc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "created_desc":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "weight_asc":
          return (a.weight || 0) - (b.weight || 0);
        case "weight_desc":
          return (b.weight || 0) - (a.weight || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [orders, searchQuery, cargoTypeFilter, dateFrom, dateTo, sortBy]);

  const clearFilters = () => {
    setSearchQuery("");
    setCargoTypeFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
    setSortBy("date_desc");
  };

  const hasActiveFilters = searchQuery || cargoTypeFilter !== "all" || dateFrom || dateTo || sortBy !== "date_desc";

  const handleOpenResponse = (order: Order) => {
    setSelectedOrder(order);
    setPrice("");
    setDeliveryTime("");
    setComment("");
    setResponseDialogOpen(true);
  };

  const handleOpenDetails = (order: Order) => {
    setSelectedOrder(order);
    setDetailsDialogOpen(true);
  };

  const handleSubmitResponse = async () => {
    if (!user || !selectedOrder || !price) return;

    setSubmitting(true);

    const { error } = await supabase.from("responses").insert({
      order_id: selectedOrder.id,
      carrier_id: user.id,
      price: parseFloat(price),
      delivery_time: deliveryTime || null,
      comment: comment || null,
    });

    setSubmitting(false);

    if (error) {
      if (error.code === "23505") {
        toast({
          title: "Вы уже откликнулись",
          description: "Вы уже отправили предложение на эту заявку",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Ошибка",
          description: "Не удалось отправить предложение",
          variant: "destructive",
        });
        console.error("Response error:", error);
      }
    } else {
      toast({
        title: "Предложение отправлено!",
        description: "Клиент получит ваше предложение",
      });
      setResponseDialogOpen(false);
      fetchOrders();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Загрузка заявок...</p>
        </CardContent>
      </Card>
    );
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Пока нет доступных заявок</p>
          <p className="text-sm text-muted-foreground">
            Новые заявки от клиентов появятся здесь
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Доступные заявки
              </CardTitle>
              <CardDescription>
                {filteredOrders.length} из {orders.length} заявок
                {hasActiveFilters && " (с учётом фильтров)"}
              </CardDescription>
            </div>
            <Button
              variant={showFilters ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Фильтры
              {hasActiveFilters && (
                <Badge className="ml-2 bg-driver text-white">!</Badge>
              )}
            </Button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 p-4 rounded-lg border bg-muted/30 space-y-4">
              {/* Search */}
              <div className="space-y-2">
                <Label>Поиск по маршруту или грузу</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Москва, мебель, электроника..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-4 gap-4">
                {/* Cargo Type Filter */}
                <div className="space-y-2">
                  <Label>Тип груза</Label>
                  <Select value={cargoTypeFilter} onValueChange={setCargoTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Все типы" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все типы</SelectItem>
                      {cargoTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort By */}
                <div className="space-y-2">
                  <Label>Сортировка</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <ArrowUpDown className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date_desc">Дата погрузки ↓</SelectItem>
                      <SelectItem value="date_asc">Дата погрузки ↑</SelectItem>
                      <SelectItem value="created_desc">Новые сначала</SelectItem>
                      <SelectItem value="created_asc">Старые сначала</SelectItem>
                      <SelectItem value="weight_desc">Вес ↓</SelectItem>
                      <SelectItem value="weight_asc">Вес ↑</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date From */}
                <div className="space-y-2">
                  <Label>Дата от</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "d MMM yyyy", { locale: ru }) : "Выбрать"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Date To */}
                <div className="space-y-2">
                  <Label>Дата до</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "d MMM yyyy", { locale: ru }) : "Выбрать"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-2" />
                  Сбросить фильтры
                </Button>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>Заявок по вашему запросу не найдено</p>
              {hasActiveFilters && (
                <Button variant="link" onClick={clearFilters} className="mt-2">
                  Сбросить фильтры
                </Button>
              )}
            </div>
          ) : (
            filteredOrders.map((order) => (
            <div
              key={order.id}
              className="p-4 rounded-xl border bg-card hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                {/* Main Info */}
                <div className="flex-1 space-y-3">
                  {/* Header */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-semibold text-lg">{order.cargo_type}</h3>
                    {order.client_price && (
                      <Badge className="bg-primary text-primary-foreground">
                        <Banknote className="w-3 h-3 mr-1" />
                        {order.client_price.toLocaleString("ru-RU")} ₽
                      </Badge>
                    )}
                    {order.has_responded && (
                      <Badge variant="outline" className="bg-driver-light text-driver border-driver">
                        Вы откликнулись
                      </Badge>
                    )}
                  </div>

                  {/* Client */}
                  {order.client_profile?.full_name && (
                    <p className="text-sm text-muted-foreground">
                      Клиент: {order.client_profile.full_name}
                    </p>
                  )}

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
                      {format(new Date(order.pickup_date), "d MMMM yyyy", { locale: ru })}
                    </div>
                    {order.weight && (
                      <div className="flex items-center gap-1">
                        <Weight className="w-4 h-4" />
                        {order.weight} кг
                      </div>
                    )}
                    {(order.length || order.width || order.height) && (
                      <div className="flex items-center gap-1">
                        <Ruler className="w-4 h-4" />
                        {[order.length, order.width, order.height].filter(Boolean).join(" × ")} м
                      </div>
                    )}
                    {order.photo_urls && order.photo_urls.length > 0 && (
                      <div className="flex items-center gap-1">
                        <ImageIcon className="w-4 h-4" />
                        {order.photo_urls.length} фото
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(`/navigator/${order.id}`)}
                    title="Посмотреть маршрут"
                  >
                    <Navigation className="w-4 h-4 mr-1" />
                    Маршрут
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleOpenDetails(order)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Подробнее
                  </Button>
                  {!order.has_responded && (
                    <Button 
                      variant="driver" 
                      size="sm"
                      onClick={() => handleOpenResponse(order)}
                    >
                      <Send className="w-4 h-4 mr-1" />
                      Откликнуться
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
          )}
        </CardContent>
      </Card>

      {/* Response Dialog */}
      <Dialog open={responseDialogOpen} onOpenChange={setResponseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Откликнуться на заявку</DialogTitle>
            <DialogDescription>
              Укажите вашу цену и условия перевозки
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4">
              {/* Order Summary */}
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <p className="font-medium">{selectedOrder.cargo_type}</p>
                {selectedOrder.client_price && (
                  <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-primary" />
                    <span className="font-bold text-primary">
                      Цена клиента: {selectedOrder.client_price.toLocaleString("ru-RU")} ₽
                    </span>
                  </div>
                )}
                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-driver" />
                    {selectedOrder.pickup_address}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-customer" />
                    {selectedOrder.delivery_address}
                  </div>
                </div>
              </div>

              {/* Response Form - Carrier proposes counter offer */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="price">
                    {selectedOrder.client_price 
                      ? "Ваше встречное предложение (₽)" 
                      : "Предложите цену (₽)"} *
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    placeholder={selectedOrder.client_price 
                      ? `Клиент предлагает ${selectedOrder.client_price.toLocaleString("ru-RU")} ₽`
                      : "Введите вашу цену"
                    }
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                  {selectedOrder.client_price && (
                    <p className="text-xs text-muted-foreground">
                      Вы можете предложить свою цену. Клиент сможет принять, отклонить или предложить встречную цену
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delivery-time">Срок доставки</Label>
                  <Input
                    id="delivery-time"
                    placeholder="Например: 2-3 дня"
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comment">Комментарий</Label>
                  <Textarea
                    id="comment"
                    placeholder="Почему вы предлагаете такую цену, условия перевозки..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setResponseDialogOpen(false)}
                    className="flex-1"
                  >
                    Отмена
                  </Button>
                  <Button
                    variant="driver"
                    onClick={handleSubmitResponse}
                    disabled={!price || submitting}
                    className="flex-1"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Отправка...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Отправить
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Детали заявки</DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Тип груза</p>
                  <p className="font-medium">{selectedOrder.cargo_type}</p>
                </div>

                {selectedOrder.client_profile?.full_name && (
                  <div>
                    <p className="text-sm text-muted-foreground">Клиент</p>
                    <p className="font-medium">{selectedOrder.client_profile.full_name}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Адрес погрузки</p>
                    <p className="font-medium">{selectedOrder.pickup_address}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Адрес выгрузки</p>
                    <p className="font-medium">{selectedOrder.delivery_address}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Дата погрузки</p>
                  <p className="font-medium">
                    {format(new Date(selectedOrder.pickup_date), "d MMMM yyyy", { locale: ru })}
                  </p>
                </div>

                {(selectedOrder.weight || selectedOrder.length) && (
                  <div className="grid grid-cols-2 gap-4">
                    {selectedOrder.weight && (
                      <div>
                        <p className="text-sm text-muted-foreground">Вес</p>
                        <p className="font-medium">{selectedOrder.weight} кг</p>
                      </div>
                    )}
                    {(selectedOrder.length || selectedOrder.width || selectedOrder.height) && (
                      <div>
                        <p className="text-sm text-muted-foreground">Габариты</p>
                        <p className="font-medium">
                          {[selectedOrder.length, selectedOrder.width, selectedOrder.height]
                            .filter(Boolean)
                            .join(" × ")} м
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {selectedOrder.description && (
                  <div>
                    <p className="text-sm text-muted-foreground">Описание</p>
                    <p className="font-medium">{selectedOrder.description}</p>
                  </div>
                )}

                {/* Cargo Photos */}
                {selectedOrder.photo_urls && selectedOrder.photo_urls.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Фото груза</p>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedOrder.photo_urls.map((url, idx) => (
                        <a 
                          key={idx} 
                          href={url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="aspect-square rounded-lg overflow-hidden border hover:opacity-80 transition-opacity"
                        >
                          <img 
                            src={url} 
                            alt={`Фото ${idx + 1}`} 
                            className="w-full h-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setDetailsDialogOpen(false)}
                  className="flex-1"
                >
                  Закрыть
                </Button>
                {!selectedOrder.has_responded && (
                  <Button
                    variant="driver"
                    onClick={() => {
                      setDetailsDialogOpen(false);
                      handleOpenResponse(selectedOrder);
                    }}
                    className="flex-1"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Откликнуться
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
