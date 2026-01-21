import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { 
  Truck, Search, Loader2, MessageSquare,
  CheckCircle, Navigation, Flag, Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  client_profile?: { full_name: string | null };
  carrier_profile?: { full_name: string | null };
}

const statusConfig = {
  pending: { label: "Ожидает", icon: Clock, color: "bg-muted text-muted-foreground" },
  accepted: { label: "Принята", icon: CheckCircle, color: "bg-customer text-white" },
  in_transit: { label: "В пути", icon: Navigation, color: "bg-driver text-white" },
  delivered: { label: "Доставлено", icon: Flag, color: "bg-gold text-white" },
  cancelled: { label: "Отменена", icon: Truck, color: "bg-destructive text-white" },
};

export const DealsTable = () => {
  const navigate = useNavigate();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchDeals = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("deals")
      .select(`
        *,
        order:orders(cargo_type, pickup_address, delivery_address)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching deals:", error);
      setLoading(false);
      return;
    }

    // Fetch profiles for clients and carriers
    const clientIds = [...new Set(data?.map(d => d.client_id) || [])];
    const carrierIds = [...new Set(data?.map(d => d.carrier_id) || [])];
    const allUserIds = [...new Set([...clientIds, ...carrierIds])];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", allUserIds);

    const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    const dealsWithProfiles: Deal[] = (data || []).map(deal => ({
      ...deal,
      client_profile: profilesMap.get(deal.client_id),
      carrier_profile: profilesMap.get(deal.carrier_id),
    }));

    setDeals(dealsWithProfiles);
    setLoading(false);
  };

  useEffect(() => {
    fetchDeals();
  }, []);

  const filteredDeals = deals.filter(deal => {
    const matchesSearch = !searchQuery || 
      deal.order?.cargo_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.client_profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.carrier_profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || deal.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: deals.length,
    pending: deals.filter(d => d.status === "pending").length,
    inTransit: deals.filter(d => d.status === "in_transit").length,
    delivered: deals.filter(d => d.status === "delivered").length,
    totalRevenue: deals
      .filter(d => d.status === "delivered")
      .reduce((sum, d) => sum + Number(d.agreed_price), 0),
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Всего сделок</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-muted-foreground">{stats.pending}</div>
            <p className="text-sm text-muted-foreground">Ожидают</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-driver">{stats.inTransit}</div>
            <p className="text-sm text-muted-foreground">В пути</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gold">{stats.delivered}</div>
            <p className="text-sm text-muted-foreground">Доставлено</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">
              {stats.totalRevenue.toLocaleString()} ₽
            </div>
            <p className="text-sm text-muted-foreground">Выручка</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Сделки
          </CardTitle>
          <CardDescription>
            Все сделки на платформе
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по грузу или участникам..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                <SelectItem value="pending">Ожидает</SelectItem>
                <SelectItem value="accepted">Принята</SelectItem>
                <SelectItem value="in_transit">В пути</SelectItem>
                <SelectItem value="delivered">Доставлено</SelectItem>
                <SelectItem value="cancelled">Отменена</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Груз</TableHead>
                  <TableHead>Клиент</TableHead>
                  <TableHead>Перевозчик</TableHead>
                  <TableHead>Цена</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Сделки не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDeals.map((deal) => {
                    const status = statusConfig[deal.status];
                    const StatusIcon = status.icon;

                    return (
                      <TableRow key={deal.id}>
                        <TableCell className="font-medium">
                          {deal.order?.cargo_type || "—"}
                        </TableCell>
                        <TableCell>{deal.client_profile?.full_name || "—"}</TableCell>
                        <TableCell>{deal.carrier_profile?.full_name || "—"}</TableCell>
                        <TableCell className="font-semibold">
                          {Number(deal.agreed_price).toLocaleString()} ₽
                        </TableCell>
                        <TableCell>
                          <Badge className={status.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(deal.created_at), "d MMM yyyy", { locale: ru })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/deals/${deal.id}/chat`)}
                          >
                            <MessageSquare className="w-4 h-4 mr-1" />
                            Чат
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
