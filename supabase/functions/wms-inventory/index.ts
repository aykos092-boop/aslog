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
      const locationId = url.searchParams.get('location_id')
      const productId = url.searchParams.get('product_id')
      const warehouseId = url.searchParams.get('warehouse_id')

      let query = supabase
        .from('inventory')
        .select(`
          *,
          products(sku, name, category),
          locations(code, rack, shelf, zone_id),
          zones!inner(name, warehouse_id),
          warehouses!inner(name, code)
        `)

      if (locationId) {
        query = query.eq('location_id', locationId)
      }
      if (productId) {
        query = query.eq('product_id', productId)
      }
      if (warehouseId) {
        query = query.eq('zones.warehouse_id', warehouseId)
      }

      const { data, error } = await query.order('updated_at', { ascending: false })

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (method === 'POST') {
      const body = await req.json()
      const { product_id, location_id, stock_total, stock_available, batch_number, expiry_date } = body

      // Validate required fields
      if (!product_id || !location_id) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: product_id, location_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase
        .from('inventory')
        .insert({
          product_id,
          location_id,
          stock_total: stock_total || 0,
          stock_available: stock_available || stock_total || 0,
          batch_number,
          expiry_date
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
      const { id, stock_total, stock_available, stock_reserved, batch_number, expiry_date } = body

      if (!id) {
        return new Response(
          JSON.stringify({ error: 'Missing inventory ID' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase
        .from('inventory')
        .update({
          stock_total,
          stock_available,
          stock_reserved,
          batch_number,
          expiry_date
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

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
    console.error('WMS Inventory error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
