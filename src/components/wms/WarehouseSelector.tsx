import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Warehouse } from "lucide-react";

interface Warehouse {
  id: string;
  name: string;
  code: string;
  status: string;
}

interface WarehouseSelectorProps {
  selectedWarehouse: string | null;
  onWarehouseChange: (warehouseId: string | null) => void;
}

const WarehouseSelector = ({ selectedWarehouse, onWarehouseChange }: WarehouseSelectorProps) => {
  const { t } = useLanguage();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('id, name, code, status')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setWarehouses(data || []);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Warehouse className="w-4 h-4 text-muted-foreground" />
      <Select
        value={selectedWarehouse || "all"}
        onValueChange={(value) => onWarehouseChange(value === "all" ? null : value)}
      >
        <SelectTrigger className="w-64">
          <SelectValue placeholder={t("wms.selectWarehouse", "Select Warehouse")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            {t("wms.allWarehouses", "All Warehouses")}
          </SelectItem>
          {warehouses.map((warehouse) => (
            <SelectItem key={warehouse.id} value={warehouse.id}>
              {warehouse.name} ({warehouse.code})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export { WarehouseSelector };
