import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Plus, 
  ArrowUp, 
  CheckCircle,
  Clock,
  Package,
  MapPin,
  Eye,
  Edit,
  Truck
} from "lucide-react";

interface ShippingItem {
  id: string;
  quantity_requested: number;
  quantity_picked: number;
  quantity_shipped: number;
  status: string;
  notes?: string;
  warehouses: {
    name: string;
    code: string;
  };
  products: {
    sku: string;
    name: string;
  };
  deals?: {
    id: string;
    agreed_price: number;
  };
  locations?: {
    code: string;
    rack: string;
    shelf: string;
  };
}

interface ShippingManagerProps {
  warehouseId: string | null;
}

const ShippingManager = ({ warehouseId }: ShippingManagerProps) => {
  const { t } = useLanguage();
  const [shippingItems, setShippingItems] = useState<ShippingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ShippingItem | null>(null);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);

  const [newShipping, setNewShipping] = useState({
    warehouse_id: "",
    deal_id: "",
    product_id: "",
    quantity_requested: "",
    location_id: "",
    notes: ""
  });

  const [updateData, setUpdateData] = useState({
    quantity_picked: "",
    quantity_shipped: "",
    status: "",
    location_id: "",
    notes: ""
  });

  useEffect(() => {
    fetchShippingItems();
    fetchWarehouses();
    fetchProducts();
    fetchDeals();
  }, [warehouseId, searchTerm]);

  const fetchShippingItems = async () => {
    try {
      let query = supabase
        .from('shipping')
        .select(`
          *,
          warehouses(name, code),
          products(sku, name),
          deals(id, agreed_price),
          locations(code, rack, shelf)
        `)
        .order('created_at', { ascending: false });

      if (warehouseId) {
        query = query.eq('warehouse_id', warehouseId);
      }

      if (searchTerm) {
        query = query.or(`products.sku.ilike.%${searchTerm}%,products.name.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setShippingItems(data || []);
    } catch (error) {
      console.error('Error fetching shipping items:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('id, name, code')
        .eq('status', 'active');

      if (error) throw error;
      setWarehouses(data || []);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, sku, name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchDeals = async () => {
    try {
      const { data, error } = await supabase
        .from('deals')
        .select('id, agreed_price')
        .in('status', ['accepted', 'in_transit']);

      if (error) throw error;
      setDeals(data || []);
    } catch (error) {
      console.error('Error fetching deals:', error);
    }
  };

  const fetchLocations = async (warehouseId: string) => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select(`
          id, code, rack, shelf,
          zones!inner(name, warehouse_id)
        `)
        .eq('zones.warehouse_id', warehouseId)
        .eq('status', 'available');

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const handleCreateShipping = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('wms-shipping', {
        body: {
          warehouse_id: newShipping.warehouse_id,
          deal_id: newShipping.deal_id || null,
          product_id: newShipping.product_id,
          quantity_requested: parseInt(newShipping.quantity_requested),
          location_id: newShipping.location_id || null,
          notes: newShipping.notes || null
        }
      });

      if (error) throw error;

      setShowCreateDialog(false);
      setNewShipping({
        warehouse_id: "",
        deal_id: "",
        product_id: "",
        quantity_requested: "",
        location_id: "",
        notes: ""
      });
      fetchShippingItems();
    } catch (error) {
      console.error('Error creating shipping:', error);
    }
  };

  const handleUpdateShipping = async () => {
    if (!selectedItem) return;

    try {
      const { data, error } = await supabase.functions.invoke('wms-shipping', {
        method: 'PUT',
        body: {
          id: selectedItem.id,
          quantity_picked: updateData.quantity_picked ? parseInt(updateData.quantity_picked) : undefined,
          quantity_shipped: updateData.quantity_shipped ? parseInt(updateData.quantity_shipped) : undefined,
          status: updateData.status || undefined,
          location_id: updateData.location_id || undefined,
          notes: updateData.notes || undefined
        }
      });

      if (error) throw error;

      setShowUpdateDialog(false);
      setSelectedItem(null);
      setUpdateData({
        quantity_picked: "",
        quantity_shipped: "",
        status: "",
        location_id: "",
        notes: ""
      });
      fetchShippingItems();
    } catch (error) {
      console.error('Error updating shipping:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">{t("wms.shipping.status.pending", "Pending")}</Badge>;
      case 'picking':
        return <Badge variant="warning">{t("wms.shipping.status.picking", "Picking")}</Badge>;
      case 'picked':
        return <Badge variant="default">{t("wms.shipping.status.picked", "Picked")}</Badge>;
      case 'shipped':
        return <Badge variant="success">{t("wms.shipping.status.shipped", "Shipped")}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t("wms.shipping.title", "Shipping Management")}</h2>
          <p className="text-muted-foreground">
            {t("wms.shipping.subtitle", "Manage outbound shipments and order fulfillment")}
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              {t("wms.shipping.create", "Create Shipping")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("wms.shipping.createTitle", "Create New Shipping")}</DialogTitle>
              <DialogDescription>
                {t("wms.shipping.createDescription", "Add a new shipping record for outbound goods")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="warehouse">{t("wms.shipping.warehouse", "Warehouse")}</Label>
                <Select 
                  value={newShipping.warehouse_id} 
                  onValueChange={(value) => {
                    setNewShipping({ ...newShipping, warehouse_id: value });
                    fetchLocations(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("wms.shipping.selectWarehouse", "Select warehouse")} />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="deal">{t("wms.shipping.deal", "Deal (Optional)")}</Label>
                <Select 
                  value={newShipping.deal_id} 
                  onValueChange={(value) => setNewShipping({ ...newShipping, deal_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("wms.shipping.selectDeal", "Select deal")} />
                  </SelectTrigger>
                  <SelectContent>
                    {deals.map((deal) => (
                      <SelectItem key={deal.id} value={deal.id}>
                        Deal {deal.id} - ${deal.agreed_price}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="product">{t("wms.shipping.product", "Product")}</Label>
                <Select 
                  value={newShipping.product_id} 
                  onValueChange={(value) => setNewShipping({ ...newShipping, product_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("wms.shipping.selectProduct", "Select product")} />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="quantity">{t("wms.shipping.requestedQuantity", "Requested Quantity")}</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={newShipping.quantity_requested}
                  onChange={(e) => setNewShipping({ ...newShipping, quantity_requested: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="location">{t("wms.shipping.location", "Location (Optional)")}</Label>
                <Select 
                  value={newShipping.location_id} 
                  onValueChange={(value) => setNewShipping({ ...newShipping, location_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("wms.shipping.selectLocation", "Select location")} />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.code} ({location.rack}-{location.shelf})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notes">{t("wms.shipping.notes", "Notes")}</Label>
                <Textarea
                  id="notes"
                  value={newShipping.notes}
                  onChange={(e) => setNewShipping({ ...newShipping, notes: e.target.value })}
                  placeholder={t("wms.shipping.notesPlaceholder", "Add any notes about this shipping...")}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  {t("common.cancel", "Cancel")}
                </Button>
                <Button onClick={handleCreateShipping}>
                  {t("wms.shipping.create", "Create Shipping")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder={t("wms.shipping.searchPlaceholder", "Search by product SKU or name...")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Shipping Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUp className="w-5 h-5" />
            {t("wms.shipping.tableTitle", "Shipping Items")}
          </CardTitle>
          <CardDescription>
            {t("wms.shipping.tableDescription", "Track and manage outbound shipments")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("wms.shipping.product", "Product")}</TableHead>
                <TableHead>{t("wms.shipping.requested", "Requested")}</TableHead>
                <TableHead>{t("wms.shipping.picked", "Picked")}</TableHead>
                <TableHead>{t("wms.shipping.shipped", "Shipped")}</TableHead>
                <TableHead>{t("wms.shipping.location", "Location")}</TableHead>
                <TableHead>{t("wms.shipping.status", "Status")}</TableHead>
                <TableHead>{t("common.actions", "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shippingItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {t("wms.shipping.noItems", "No shipping items found")}
                  </TableCell>
                </TableRow>
              ) : (
                shippingItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.products.name}</div>
                        <div className="text-sm text-muted-foreground">SKU: {item.products.sku}</div>
                        {item.deals && (
                          <div className="text-xs text-muted-foreground">Deal: {item.deals.id}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{item.quantity_requested}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-blue-600">{item.quantity_picked}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-green-600">{item.quantity_shipped}</span>
                    </TableCell>
                    <TableCell>
                      {item.locations ? (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span>{item.locations.code}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(item.status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setSelectedItem(item);
                            setUpdateData({
                              quantity_picked: item.quantity_picked.toString(),
                              quantity_shipped: item.quantity_shipped.toString(),
                              status: item.status,
                              location_id: item.locations?.id || "",
                              notes: item.notes || ""
                            });
                            setShowUpdateDialog(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Update Dialog */}
      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("wms.shipping.updateTitle", "Update Shipping")}</DialogTitle>
            <DialogDescription>
              {t("wms.shipping.updateDescription", "Update shipping details and quantities")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="picked">{t("wms.shipping.pickedQuantity", "Picked Quantity")}</Label>
              <Input
                id="picked"
                type="number"
                value={updateData.quantity_picked}
                onChange={(e) => setUpdateData({ ...updateData, quantity_picked: e.target.value })}
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="shipped">{t("wms.shipping.shippedQuantity", "Shipped Quantity")}</Label>
              <Input
                id="shipped"
                type="number"
                value={updateData.quantity_shipped}
                onChange={(e) => setUpdateData({ ...updateData, quantity_shipped: e.target.value })}
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="status">{t("wms.shipping.status", "Status")}</Label>
              <Select 
                value={updateData.status} 
                onValueChange={(value) => setUpdateData({ ...updateData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("wms.shipping.selectStatus", "Select status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">{t("wms.shipping.status.pending", "Pending")}</SelectItem>
                  <SelectItem value="picking">{t("wms.shipping.status.picking", "Picking")}</SelectItem>
                  <SelectItem value="picked">{t("wms.shipping.status.picked", "Picked")}</SelectItem>
                  <SelectItem value="shipped">{t("wms.shipping.status.shipped", "Shipped")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="updateNotes">{t("wms.shipping.notes", "Notes")}</Label>
              <Textarea
                id="updateNotes"
                value={updateData.notes}
                onChange={(e) => setUpdateData({ ...updateData, notes: e.target.value })}
                placeholder={t("wms.shipping.notesPlaceholder", "Add any notes about this shipping...")}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowUpdateDialog(false)}>
                {t("common.cancel", "Cancel")}
              </Button>
              <Button onClick={handleUpdateShipping}>
                {t("wms.shipping.update", "Update Shipping")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export { ShippingManager };
