-- =============================================
-- WMS (Warehouse Management System) Migration
-- =============================================

-- WMS Role extensions
ALTER TYPE public.app_role ADD VALUE 'warehouse_manager';
ALTER TYPE public.app_role ADD VALUE 'storekeeper';

-- WMS Enums
CREATE TYPE public.warehouse_status AS ENUM ('active', 'inactive', 'maintenance');
CREATE TYPE public.zone_status AS ENUM ('active', 'inactive', 'full');
CREATE TYPE public.location_status AS ENUM ('available', 'occupied', 'reserved', 'blocked');
CREATE TYPE public.movement_type AS ENUM ('inbound', 'outbound', 'transfer', 'adjustment');
CREATE TYPE public.barcode_type AS ENUM ('product', 'location', 'pallet', 'package');

-- =============================================
-- WMS: WAREHOUSES TABLE
-- =============================================
CREATE TABLE public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  address TEXT NOT NULL,
  city TEXT,
  country TEXT,
  status warehouse_status DEFAULT 'active' NOT NULL,
  total_area DECIMAL(10, 2),
  manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

-- =============================================
-- WMS: ZONES TABLE
-- =============================================
CREATE TABLE public.zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  zone_type TEXT NOT NULL, -- 'receiving', 'storage', 'picking', 'shipping', 'returns'
  status zone_status DEFAULT 'active' NOT NULL,
  capacity INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (warehouse_id, code)
);

ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

-- =============================================
-- WMS: LOCATIONS TABLE
-- =============================================
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID REFERENCES public.zones(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL,
  rack TEXT,
  shelf TEXT,
  cell TEXT,
  status location_status DEFAULT 'available' NOT NULL,
  max_weight DECIMAL(10, 2),
  max_volume DECIMAL(10, 2),
  current_weight DECIMAL(10, 2) DEFAULT 0,
  current_volume DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (zone_id, code)
);

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- =============================================
-- WMS: PRODUCTS TABLE (extends existing orders)
-- =============================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  weight DECIMAL(10, 2),
  length DECIMAL(10, 2),
  width DECIMAL(10, 2),
  height DECIMAL(10, 2),
  barcode TEXT UNIQUE,
  qr_code TEXT UNIQUE,
  min_stock_level INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- =============================================
-- WMS: INVENTORY TABLE
-- =============================================
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE NOT NULL,
  stock_total INTEGER DEFAULT 0,
  stock_available INTEGER DEFAULT 0,
  stock_reserved INTEGER DEFAULT 0,
  batch_number TEXT,
  expiry_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (product_id, location_id, batch_number)
);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- =============================================
-- WMS: INVENTORY MOVEMENTS TABLE
-- =============================================
CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  from_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  to_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  movement_type movement_type NOT NULL,
  quantity INTEGER NOT NULL,
  reference_id UUID, -- Can link to orders, deals, or other entities
  reference_type TEXT, -- 'order', 'deal', 'adjustment', 'transfer'
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- =============================================
-- WMS: BARCODES TABLE
-- =============================================
CREATE TABLE public.barcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  type barcode_type NOT NULL,
  reference_id UUID NOT NULL, -- References product, location, or pallet
  reference_type TEXT NOT NULL, -- 'product', 'location', 'pallet'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.barcodes ENABLE ROW LEVEL SECURITY;

-- =============================================
-- WMS: RECEIVING TABLE
-- =============================================
CREATE TABLE public.receiving (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  quantity_expected INTEGER NOT NULL,
  quantity_received INTEGER DEFAULT 0,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' NOT NULL, -- 'pending', 'partial', 'completed'
  received_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.receiving ENABLE ROW LEVEL SECURITY;

-- =============================================
-- WMS: SHIPPING TABLE
-- =============================================
CREATE TABLE public.shipping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  quantity_requested INTEGER NOT NULL,
  quantity_picked INTEGER DEFAULT 0,
  quantity_shipped INTEGER DEFAULT 0,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' NOT NULL, -- 'pending', 'picking', 'picked', 'shipped'
  picked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.shipping ENABLE ROW LEVEL SECURITY;

-- =============================================
-- WMS: SECURITY FUNCTIONS
-- =============================================

-- Function to check WMS permissions
CREATE OR REPLACE FUNCTION public.has_wms_role(_user_id UUID, _required_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id::text = _user_id::text
      AND ur.role::text IN ('admin', 'warehouse_manager', 'storekeeper')
      AND (
        _required_role = 'any' OR
        (_required_role = 'admin' AND ur.role::text = 'admin') OR
        (_required_role = 'manager' AND ur.role::text IN ('admin', 'warehouse_manager')) OR
        (_required_role = 'storekeeper' AND ur.role::text IN ('admin', 'warehouse_manager', 'storekeeper'))
      )
  )
$$;

-- Function to get warehouse by location
CREATE OR REPLACE FUNCTION public.get_warehouse_by_location(_location_id UUID)
RETURNS TABLE (
  warehouse_id UUID,
  warehouse_name TEXT,
  zone_id UUID,
  zone_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    w.id as warehouse_id,
    w.name as warehouse_name,
    z.id as zone_id,
    z.name as zone_name
  FROM public.locations l
  JOIN public.zones z ON l.zone_id = z.id
  JOIN public.warehouses w ON z.warehouse_id = w.id
  WHERE l.id = _location_id
$$;

-- Function to update inventory after movement
CREATE OR REPLACE FUNCTION public.update_inventory_after_movement(
  _product_id UUID,
  _from_location_id UUID,
  _to_location_id UUID,
  _quantity INTEGER,
  _movement_type movement_type
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Handle outbound movement (decrease from source)
  IF _from_location_id IS NOT NULL AND _movement_type IN ('outbound', 'transfer') THEN
    UPDATE public.inventory 
    SET 
      stock_total = stock_total - _quantity,
      stock_available = stock_available - _quantity,
      updated_at = now()
    WHERE product_id = _product_id AND location_id = _from_location_id;
  END IF;

  -- Handle inbound movement (increase to destination)
  IF _to_location_id IS NOT NULL AND _movement_type IN ('inbound', 'transfer') THEN
    INSERT INTO public.inventory (product_id, location_id, stock_total, stock_available, updated_at)
    VALUES (_product_id, _to_location_id, _quantity, _quantity, now())
    ON CONFLICT (product_id, location_id, batch_number) 
    DO UPDATE SET
      stock_total = inventory.stock_total + _quantity,
      stock_available = inventory.stock_available + _quantity,
      updated_at = now();
  END IF;
END;
$$;

-- =============================================
-- WMS: TRIGGERS
-- =============================================

-- Trigger to update inventory after movement
CREATE OR REPLACE FUNCTION public.handle_inventory_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.update_inventory_after_movement(
    NEW.product_id,
    NEW.from_location_id,
    NEW.to_location_id,
    NEW.quantity,
    NEW.movement_type
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_handle_inventory_movement
  AFTER INSERT ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.handle_inventory_movement();

-- =============================================
-- WMS: RLS POLICIES
-- =============================================

-- Warehouses policies
CREATE POLICY "Warehouses view for WMS users" ON public.warehouses
  FOR SELECT USING (public.has_wms_role(auth.uid(), 'storekeeper'));

CREATE POLICY "Warehouses insert for managers" ON public.warehouses
  FOR INSERT WITH CHECK (public.has_wms_role(auth.uid(), 'manager'));

CREATE POLICY "Warehouses update for managers" ON public.warehouses
  FOR UPDATE USING (public.has_wms_role(auth.uid(), 'manager'));

-- Zones policies
CREATE POLICY "Zones view for WMS users" ON public.zones
  FOR SELECT USING (public.has_wms_role(auth.uid(), 'storekeeper'));

CREATE POLICY "Zones insert for managers" ON public.zones
  FOR INSERT WITH CHECK (public.has_wms_role(auth.uid(), 'manager'));

CREATE POLICY "Zones update for managers" ON public.zones
  FOR UPDATE USING (public.has_wms_role(auth.uid(), 'manager'));

-- Locations policies
CREATE POLICY "Locations view for WMS users" ON public.locations
  FOR SELECT USING (public.has_wms_role(auth.uid(), 'storekeeper'));

CREATE POLICY "Locations insert for managers" ON public.locations
  FOR INSERT WITH CHECK (public.has_wms_role(auth.uid(), 'manager'));

CREATE POLICY "Locations update for managers" ON public.locations
  FOR UPDATE USING (public.has_wms_role(auth.uid(), 'manager'));

-- Products policies
CREATE POLICY "Products view for authenticated users" ON public.products
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Products insert for managers" ON public.products
  FOR INSERT WITH CHECK (public.has_wms_role(auth.uid(), 'manager'));

CREATE POLICY "Products update for managers" ON public.products
  FOR UPDATE USING (public.has_wms_role(auth.uid(), 'manager'));

-- Inventory policies
CREATE POLICY "Inventory view for WMS users" ON public.inventory
  FOR SELECT USING (public.has_wms_role(auth.uid(), 'storekeeper'));

CREATE POLICY "Inventory insert for storekeepers" ON public.inventory
  FOR INSERT WITH CHECK (public.has_wms_role(auth.uid(), 'storekeeper'));

CREATE POLICY "Inventory update for storekeepers" ON public.inventory
  FOR UPDATE USING (public.has_wms_role(auth.uid(), 'storekeeper'));

-- Inventory movements policies
CREATE POLICY "Inventory movements view for WMS users" ON public.inventory_movements
  FOR SELECT USING (public.has_wms_role(auth.uid(), 'storekeeper'));

CREATE POLICY "Inventory movements insert for storekeepers" ON public.inventory_movements
  FOR INSERT WITH CHECK (public.has_wms_role(auth.uid(), 'storekeeper'));

-- Receiving policies
CREATE POLICY "Receiving view for WMS users" ON public.receiving
  FOR SELECT USING (public.has_wms_role(auth.uid(), 'storekeeper'));

CREATE POLICY "Receiving insert for storekeepers" ON public.receiving
  FOR INSERT WITH CHECK (public.has_wms_role(auth.uid(), 'storekeeper'));

CREATE POLICY "Receiving update for storekeepers" ON public.receiving
  FOR UPDATE USING (public.has_wms_role(auth.uid(), 'storekeeper'));

-- Shipping policies
CREATE POLICY "Shipping view for WMS users" ON public.shipping
  FOR SELECT USING (public.has_wms_role(auth.uid(), 'storekeeper'));

CREATE POLICY "Shipping insert for storekeepers" ON public.shipping
  FOR INSERT WITH CHECK (public.has_wms_role(auth.uid(), 'storekeeper'));

CREATE POLICY "Shipping update for storekeepers" ON public.shipping
  FOR UPDATE USING (public.has_wms_role(auth.uid(), 'storekeeper'));

-- Barcodes policies
CREATE POLICY "Barcodes view for WMS users" ON public.barcodes
  FOR SELECT USING (public.has_wms_role(auth.uid(), 'storekeeper'));

CREATE POLICY "Barcodes insert for managers" ON public.barcodes
  FOR INSERT WITH CHECK (public.has_wms_role(auth.uid(), 'manager'));

CREATE POLICY "Barcodes update for managers" ON public.barcodes
  FOR UPDATE USING (public.has_wms_role(auth.uid(), 'manager'));

-- =============================================
-- WMS: INDEXES
-- =============================================

CREATE INDEX idx_warehouses_status ON public.warehouses(status);
CREATE INDEX idx_zones_warehouse_id ON public.zones(warehouse_id);
CREATE INDEX idx_locations_zone_id ON public.locations(zone_id);
CREATE INDEX idx_locations_status ON public.locations(status);
CREATE INDEX idx_products_sku ON public.products(sku);
CREATE INDEX idx_inventory_product_location ON public.inventory(product_id, location_id);
CREATE INDEX idx_inventory_movements_product ON public.inventory_movements(product_id);
CREATE INDEX idx_inventory_movements_created_at ON public.inventory_movements(created_at);
CREATE INDEX idx_receiving_warehouse_id ON public.receiving(warehouse_id);
CREATE INDEX idx_receiving_order_id ON public.receiving(order_id);
CREATE INDEX idx_shipping_warehouse_id ON public.shipping(warehouse_id);
CREATE INDEX idx_shipping_deal_id ON public.shipping(deal_id);
CREATE INDEX idx_barcodes_code ON public.barcodes(code);
CREATE INDEX idx_barcodes_reference ON public.barcodes(reference_id, reference_type);
