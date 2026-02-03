import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Package, 
  ArrowDown, 
  ArrowUp, 
  Warehouse, 
  MapPin, 
  BarChart3,
  Plus,
  Eye,
  Settings
} from "lucide-react";
import { InventoryOverview } from "./InventoryOverview";
import { ReceivingManager } from "./ReceivingManager";
import { ShippingManager } from "./ShippingManager";
import { WarehouseSelector } from "./WarehouseSelector";

interface WMSStats {
  totalProducts: number;
  totalLocations: number;
  lowStockItems: number;
  pendingReceiving: number;
  pendingShipping: number;
}

const WMSDashboard = () => {
  const { t } = useLanguage();
  const { user, role } = useFirebaseAuth();
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null);
  const [stats, setStats] = useState<WMSStats>({
    totalProducts: 0,
    totalLocations: 0,
    lowStockItems: 0,
    pendingReceiving: 0,
    pendingShipping: 0
  });
  const [loading, setLoading] = useState(true);

  // Check if user is client
  const isClient = role as string === 'client';

  useEffect(() => {
    fetchWMSStats();
  }, [selectedWarehouse]);

  const fetchWMSStats = async () => {
    try {
      const warehouseFilter = selectedWarehouse ? `&warehouse_id=${selectedWarehouse}` : '';

      const [
        productsRes,
        locationsRes,
        lowStockRes,
        receivingRes,
        shippingRes
      ] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('locations').select('id', { count: 'exact', head: true })
          .eq('status', 'available'),
        supabase.from('inventory').select('id', { count: 'exact', head: true })
          .lt('stock_available', 10),
        supabase.from('receiving').select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase.from('shipping').select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
      ]);

      setStats({
        totalProducts: productsRes.count || 0,
        totalLocations: locationsRes.count || 0,
        lowStockItems: lowStockRes.count || 0,
        pendingReceiving: receivingRes.count || 0,
        pendingShipping: shippingRes.count || 0
      });
    } catch (error) {
      console.error('Error fetching WMS stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("wms.title", "Warehouse Management")}</h1>
          <p className="text-muted-foreground">
            {t("wms.subtitle", "Manage inventory, receiving, and shipping operations")}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <WarehouseSelector 
            selectedWarehouse={selectedWarehouse}
            onWarehouseChange={setSelectedWarehouse}
          />
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            {t("common.settings", "Settings")}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("wms.stats.totalProducts", "Total Products")}
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("wms.stats.availableLocations", "Available Locations")}
            </CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLocations}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("wms.stats.lowStock", "Low Stock Items")}
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.lowStockItems}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("wms.stats.pendingReceiving", "Pending Receiving")}
            </CardTitle>
            <ArrowDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.pendingReceiving}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("wms.stats.pendingShipping", "Pending Shipping")}
            </CardTitle>
            <ArrowUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.pendingShipping}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="inventory">
            <Package className="w-4 h-4 mr-2" />
            {t("wms.tabs.inventory", "Inventory")}
          </TabsTrigger>
          <TabsTrigger value="receiving">
            <ArrowDown className="w-4 h-4 mr-2" />
            {t("wms.tabs.receiving", "Receiving")}
          </TabsTrigger>
          <TabsTrigger value="shipping">
            <ArrowUp className="w-4 h-4 mr-2" />
            {t("wms.tabs.shipping", "Shipping")}
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="w-4 h-4 mr-2" />
            {t("wms.tabs.analytics", "Analytics")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          <InventoryOverview warehouseId={selectedWarehouse} />
        </TabsContent>

        <TabsContent value="receiving" className="space-y-4">
          <ReceivingManager warehouseId={selectedWarehouse} />
        </TabsContent>

        <TabsContent value="shipping" className="space-y-4">
          <ShippingManager warehouseId={selectedWarehouse} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("wms.analytics.title", "Warehouse Analytics")}</CardTitle>
              <CardDescription>
                {t("wms.analytics.subtitle", "Detailed insights into warehouse operations")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t("wms.analytics.comingSoon", "Analytics dashboard coming soon")}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WMSDashboard;
