import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Search, 
  Filter, 
  Package, 
  AlertTriangle, 
  MapPin,
  Plus,
  Eye,
  Edit
} from "lucide-react";

interface InventoryItem {
  id: string;
  stock_total: number;
  stock_available: number;
  stock_reserved: number;
  batch_number?: string;
  expiry_date?: string;
  products: {
    sku: string;
    name: string;
    category: string;
  };
  locations: {
    code: string;
    rack: string;
    shelf: string;
    zone_id: string;
  };
  zones: {
    name: string;
    warehouse_id: string;
  };
  warehouses: {
    name: string;
    code: string;
  };
}

interface InventoryOverviewProps {
  warehouseId: string | null;
}

const InventoryOverview = ({ warehouseId }: InventoryOverviewProps) => {
  const { t } = useLanguage();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchInventory();
  }, [warehouseId, searchTerm]);

  const fetchInventory = async () => {
    try {
      let query = supabase
        .from('inventory')
        .select(`
          *,
          products(sku, name, category),
          locations(code, rack, shelf, zone_id),
          zones!inner(name, warehouse_id),
          warehouses!inner(name, code)
        `)
        .order('updated_at', { ascending: false });

      if (warehouseId) {
        query = query.eq('zones.warehouse_id', warehouseId);
      }

      if (searchTerm) {
        query = query.or(`products.sku.ilike.%${searchTerm}%,products.name.ilike.%${searchTerm}%,locations.code.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setInventory(data || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (item: InventoryItem) => {
    if (item.stock_available === 0) return { label: "Out of Stock", variant: "destructive" as const };
    if (item.stock_available < 10) return { label: "Low Stock", variant: "warning" as const };
    return { label: "In Stock", variant: "success" as const };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t("wms.inventory.title", "Inventory Overview")}</h2>
          <p className="text-muted-foreground">
            {t("wms.inventory.subtitle", "Current stock levels across all locations")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            {t("wms.inventory.addProduct", "Add Product")}
          </Button>
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            {t("common.filter", "Filter")}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder={t("wms.inventory.searchPlaceholder", "Search by product SKU, name, or location...")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {t("wms.inventory.tableTitle", "Inventory Items")}
          </CardTitle>
          <CardDescription>
            {t("wms.inventory.tableDescription", "Manage stock levels and locations")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("wms.inventory.product", "Product")}</TableHead>
                <TableHead>{t("wms.inventory.location", "Location")}</TableHead>
                <TableHead>{t("wms.inventory.totalStock", "Total")}</TableHead>
                <TableHead>{t("wms.inventory.available", "Available")}</TableHead>
                <TableHead>{t("wms.inventory.reserved", "Reserved")}</TableHead>
                <TableHead>{t("wms.inventory.status", "Status")}</TableHead>
                <TableHead>{t("common.actions", "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {t("wms.inventory.noItems", "No inventory items found")}
                  </TableCell>
                </TableRow>
              ) : (
                inventory.map((item) => {
                  const status = getStockStatus(item);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.products.name}</div>
                          <div className="text-sm text-muted-foreground">SKU: {item.products.sku}</div>
                          {item.batch_number && (
                            <div className="text-xs text-muted-foreground">Batch: {item.batch_number}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{item.locations.code}</div>
                            <div className="text-sm text-muted-foreground">
                              {item.locations.rack}-{item.locations.shelf}
                            </div>
                            <div className="text-xs text-muted-foreground">{item.warehouses.name}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{item.stock_total}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-green-600">{item.stock_available}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-orange-600">{item.stock_reserved}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export { InventoryOverview };
