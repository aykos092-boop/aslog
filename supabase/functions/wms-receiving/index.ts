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
        .from('receiving')
        .select(`
          *,
          warehouses(name, code),
          products(sku, name),
          orders(id, cargo_type),
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
      const { warehouse_id, order_id, product_id, quantity_expected, location_id, notes } = body

      // Validate required fields
      if (!warehouse_id || !product_id || !quantity_expected) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: warehouse_id, product_id, quantity_expected' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Create receiving record
      const { data, error } = await supabase
        .from('receiving')
        .insert({
          warehouse_id,
          order_id,
          product_id,
          quantity_expected,
          location_id,
          notes,
          received_by: user.id
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
      const { id, quantity_received, status, location_id, notes } = body

      if (!id) {
        return new Response(
          JSON.stringify({ error: 'Missing receiving ID' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get current receiving record
      const { data: current, error: fetchError } = await supabase
        .from('receiving')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError

      // Update receiving record
      const { data, error } = await supabase
        .from('receiving')
        .update({
          quantity_received: quantity_received || current.quantity_received,
          status: status || current.status,
          location_id: location_id || current.location_id,
          notes: notes || current.notes,
          received_by: user.id
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // If receiving is completed, create inventory movement
      if (quantity_received && quantity_received > 0 && location_id) {
        await supabase
          .from('inventory_movements')
          .insert({
            product_id: current.product_id,
            to_location_id: location_id,
            movement_type: 'inbound',
            quantity: quantity_received,
            reference_id: current.order_id,
            reference_type: 'order',
            user_id: user.id,
            notes: `Receiving: ${notes || 'Inbound goods'}`
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
    console.error('WMS Receiving error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
