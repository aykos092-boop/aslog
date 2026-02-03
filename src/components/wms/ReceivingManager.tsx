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
  ArrowDown, 
  CheckCircle,
  Clock,
  Package,
  MapPin,
  Eye,
  Edit
} from "lucide-react";

interface ReceivingItem {
  id: string;
  quantity_expected: number;
  quantity_received: number;
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
  orders?: {
    id: string;
    cargo_type: string;
  };
  locations?: {
    code: string;
    rack: string;
    shelf: string;
  };
}

interface ReceivingManagerProps {
  warehouseId: string | null;
}

const ReceivingManager = ({ warehouseId }: ReceivingManagerProps) => {
  const { t } = useLanguage();
  const [receivingItems, setReceivingItems] = useState<ReceivingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ReceivingItem | null>(null);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);

  const [newReceiving, setNewReceiving] = useState({
    warehouse_id: "",
    product_id: "",
    quantity_expected: "",
    location_id: "",
    notes: ""
  });

  const [updateData, setUpdateData] = useState({
    quantity_received: "",
    status: "",
    location_id: "",
    notes: ""
  });

  useEffect(() => {
    fetchReceivingItems();
    fetchWarehouses();
    fetchProducts();
  }, [warehouseId, searchTerm]);

  const fetchReceivingItems = async () => {
    try {
      let query = supabase
        .from('receiving')
        .select(`
          *,
          warehouses(name, code),
          products(sku, name),
          orders(id, cargo_type),
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
      setReceivingItems(data || []);
    } catch (error) {
      console.error('Error fetching receiving items:', error);
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

  const handleCreateReceiving = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('wms-receiving', {
        body: {
          warehouse_id: newReceiving.warehouse_id,
          product_id: newReceiving.product_id,
          quantity_expected: parseInt(newReceiving.quantity_expected),
          location_id: newReceiving.location_id || null,
          notes: newReceiving.notes || null
        }
      });

      if (error) throw error;

      setShowCreateDialog(false);
      setNewReceiving({
        warehouse_id: "",
        product_id: "",
        quantity_expected: "",
        location_id: "",
        notes: ""
      });
      fetchReceivingItems();
    } catch (error) {
      console.error('Error creating receiving:', error);
    }
  };

  const handleUpdateReceiving = async () => {
    if (!selectedItem) return;

    try {
      const { data, error } = await supabase.functions.invoke('wms-receiving', {
        method: 'PUT',
        body: {
          id: selectedItem.id,
          quantity_received: updateData.quantity_received ? parseInt(updateData.quantity_received) : undefined,
          status: updateData.status || undefined,
          location_id: updateData.location_id || undefined,
          notes: updateData.notes || undefined
        }
      });

      if (error) throw error;

      setShowUpdateDialog(false);
      setSelectedItem(null);
      setUpdateData({
        quantity_received: "",
        status: "",
        location_id: "",
        notes: ""
      });
      fetchReceivingItems();
    } catch (error) {
      console.error('Error updating receiving:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">{t("wms.receiving.status.pending", "Pending")}</Badge>;
      case 'partial':
        return <Badge variant="warning">{t("wms.receiving.status.partial", "Partial")}</Badge>;
      case 'completed':
        return <Badge variant="success">{t("wms.receiving.status.completed", "Completed")}</Badge>;
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
          <h2 className="text-2xl font-bold">{t("wms.receiving.title", "Receiving Management")}</h2>
          <p className="text-muted-foreground">
            {t("wms.receiving.subtitle", "Manage inbound shipments and inventory receiving")}
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              {t("wms.receiving.create", "Create Receiving")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("wms.receiving.createTitle", "Create New Receiving")}</DialogTitle>
              <DialogDescription>
                {t("wms.receiving.createDescription", "Add a new receiving record for inbound goods")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="warehouse">{t("wms.receiving.warehouse", "Warehouse")}</Label>
                <Select 
                  value={newReceiving.warehouse_id} 
                  onValueChange={(value) => {
                    setNewReceiving({ ...newReceiving, warehouse_id: value });
                    fetchLocations(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("wms.receiving.selectWarehouse", "Select warehouse")} />
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
                <Label htmlFor="product">{t("wms.receiving.product", "Product")}</Label>
                <Select 
                  value={newReceiving.product_id} 
                  onValueChange={(value) => setNewReceiving({ ...newReceiving, product_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("wms.receiving.selectProduct", "Select product")} />
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
                <Label htmlFor="quantity">{t("wms.receiving.expectedQuantity", "Expected Quantity")}</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={newReceiving.quantity_expected}
                  onChange={(e) => setNewReceiving({ ...newReceiving, quantity_expected: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="location">{t("wms.receiving.location", "Location (Optional)")}</Label>
                <Select 
                  value={newReceiving.location_id} 
                  onValueChange={(value) => setNewReceiving({ ...newReceiving, location_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("wms.receiving.selectLocation", "Select location")} />
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
                <Label htmlFor="notes">{t("wms.receiving.notes", "Notes")}</Label>
                <Textarea
                  id="notes"
                  value={newReceiving.notes}
                  onChange={(e) => setNewReceiving({ ...newReceiving, notes: e.target.value })}
                  placeholder={t("wms.receiving.notesPlaceholder", "Add any notes about this receiving...")}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  {t("common.cancel", "Cancel")}
                </Button>
                <Button onClick={handleCreateReceiving}>
                  {t("wms.receiving.create", "Create Receiving")}
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
          placeholder={t("wms.receiving.searchPlaceholder", "Search by product SKU or name...")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Receiving Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowDown className="w-5 h-5" />
            {t("wms.receiving.tableTitle", "Receiving Items")}
          </CardTitle>
          <CardDescription>
            {t("wms.receiving.tableDescription", "Track and manage inbound shipments")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("wms.receiving.product", "Product")}</TableHead>
                <TableHead>{t("wms.receiving.expected", "Expected")}</TableHead>
                <TableHead>{t("wms.receiving.received", "Received")}</TableHead>
                <TableHead>{t("wms.receiving.location", "Location")}</TableHead>
                <TableHead>{t("wms.receiving.status", "Status")}</TableHead>
                <TableHead>{t("common.actions", "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receivingItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {t("wms.receiving.noItems", "No receiving items found")}
                  </TableCell>
                </TableRow>
              ) : (
                receivingItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.products.name}</div>
                        <div className="text-sm text-muted-foreground">SKU: {item.products.sku}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{item.quantity_expected}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-green-600">{item.quantity_received}</span>
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
                              quantity_received: item.quantity_received.toString(),
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
            <DialogTitle>{t("wms.receiving.updateTitle", "Update Receiving")}</DialogTitle>
            <DialogDescription>
              {t("wms.receiving.updateDescription", "Update receiving details and quantities")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="received">{t("wms.receiving.receivedQuantity", "Received Quantity")}</Label>
              <Input
                id="received"
                type="number"
                value={updateData.quantity_received}
                onChange={(e) => setUpdateData({ ...updateData, quantity_received: e.target.value })}
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="status">{t("wms.receiving.status", "Status")}</Label>
              <Select 
                value={updateData.status} 
                onValueChange={(value) => setUpdateData({ ...updateData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("wms.receiving.selectStatus", "Select status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">{t("wms.receiving.status.pending", "Pending")}</SelectItem>
                  <SelectItem value="partial">{t("wms.receiving.status.partial", "Partial")}</SelectItem>
                  <SelectItem value="completed">{t("wms.receiving.status.completed", "Completed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="updateNotes">{t("wms.receiving.notes", "Notes")}</Label>
              <Textarea
                id="updateNotes"
                value={updateData.notes}
                onChange={(e) => setUpdateData({ ...updateData, notes: e.target.value })}
                placeholder={t("wms.receiving.notesPlaceholder", "Add any notes about this receiving...")}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowUpdateDialog(false)}>
                {t("common.cancel", "Cancel")}
              </Button>
              <Button onClick={handleUpdateReceiving}>
                {t("wms.receiving.update", "Update Receiving")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export { ReceivingManager };
