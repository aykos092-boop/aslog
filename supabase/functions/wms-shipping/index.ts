import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      req.headers.get('Authorization')!.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check WMS permissions
    const { data: hasPermission } = await supabase
      .rpc('has_wms_role', { 
        _user_id: user.id, 
        _required_role: 'storekeeper' 
      })

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { method } = req

    if (method === 'GET') {
      const url = new URL(req.url)
      const warehouseId = url.searchParams.get('warehouse_id')
      const status = url.searchParams.get('status')

      let query = supabase
        .from('shipping')
        .select(`
          *,
          warehouses(name, code),
          products(sku, name),
          deals(id, agreed_price),
          locations(code, rack, shelf)
        `)

      if (warehouseId) {
        query = query.eq('warehouse_id', warehouseId)
      }
      if (status) {
        query = query.eq('status', status)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (method === 'POST') {
      const body = await req.json()
      const { warehouse_id, deal_id, product_id, quantity_requested, location_id, notes } = body

      // Validate required fields
      if (!warehouse_id || !product_id || !quantity_requested) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: warehouse_id, product_id, quantity_requested' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check inventory availability
      if (location_id) {
        const { data: inventory, error: inventoryError } = await supabase
          .from('inventory')
          .select('stock_available')
          .eq('product_id', product_id)
          .eq('location_id', location_id)
          .single()

        if (inventoryError) {
          return new Response(
            JSON.stringify({ error: 'Inventory not found for this location' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        if (inventory.stock_available < quantity_requested) {
          return new Response(
            JSON.stringify({ 
              error: 'Insufficient stock',
              available: inventory.stock_available,
              requested: quantity_requested
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      // Create shipping record
      const { data, error } = await supabase
        .from('shipping')
        .insert({
          warehouse_id,
          deal_id,
          product_id,
          quantity_requested,
          location_id,
          notes,
          picked_by: user.id
        })
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (method === 'PUT') {
      const body = await req.json()
      const { id, quantity_picked, quantity_shipped, status, location_id, notes } = body

      if (!id) {
        return new Response(
          JSON.stringify({ error: 'Missing shipping ID' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get current shipping record
      const { data: current, error: fetchError } = await supabase
        .from('shipping')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError

      // Update shipping record
      const { data, error } = await supabase
        .from('shipping')
        .update({
          quantity_picked: quantity_picked || current.quantity_picked,
          quantity_shipped: quantity_shipped || current.quantity_shipped,
          status: status || current.status,
          location_id: location_id || current.location_id,
          notes: notes || current.notes,
          picked_by: user.id
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // Handle inventory movements
      if (quantity_picked && quantity_picked > 0 && location_id) {
        // Reserve stock
        await supabase
          .from('inventory')
          .update({
            stock_reserved: supabase.rpc('increment', { x: quantity_picked }),
            stock_available: supabase.rpc('decrement', { x: quantity_picked })
          })
          .eq('product_id', current.product_id)
          .eq('location_id', location_id)

        await supabase
          .from('inventory_movements')
          .insert({
            product_id: current.product_id,
            from_location_id: location_id,
            movement_type: 'outbound',
            quantity: quantity_picked,
            reference_id: current.deal_id,
            reference_type: 'deal',
            user_id: user.id,
            notes: `Picking: ${notes || 'Outbound goods'}`
          })
      }

      if (quantity_shipped && quantity_shipped > 0 && location_id) {
        // Move from reserved to shipped
        await supabase
          .from('inventory')
          .update({
            stock_reserved: supabase.rpc('decrement', { x: quantity_shipped }),
            stock_total: supabase.rpc('decrement', { x: quantity_shipped })
          })
          .eq('product_id', current.product_id)
          .eq('location_id', location_id)

        await supabase
          .from('inventory_movements')
          .insert({
            product_id: current.product_id,
            from_location_id: location_id,
            movement_type: 'outbound',
            quantity: quantity_shipped,
            reference_id: current.deal_id,
            reference_type: 'deal',
            user_id: user.id,
            notes: `Shipping: ${notes || 'Shipped goods'}`
          })
      }

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('WMS Shipping error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
