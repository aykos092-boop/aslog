import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

// PDF generation library
import { PDFDocument, rgb, StandardFonts } from "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js"

interface DocumentData {
  id: string
  document_number: string
  document_type: string
  title: string
  content: any
  created_at: string
  created_by?: string
  approved_by?: string
  approved_at?: string
  order_id?: string
  deal_id?: string
  warehouse_id?: string
  items?: any[]
}

interface UserProfile {
  full_name?: string
  email?: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get user from auth
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if user is admin
    const { data: userRoles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')

    if (!userRoles || userRoles.length === 0) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { documentId } = await req.json()
    if (!documentId) {
      return new Response(JSON.stringify({ error: 'Document ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get document with related data
    const { data: document, error: docError } = await supabaseClient
      .from('documents')
      .select(`
        *,
        creator:profiles!created_by(id, email, full_name),
        approver:profiles!approved_by(id, email, full_name),
        document_items(*),
        orders!inner(id, cargo_type, weight, length, width, height, pickup_address, delivery_address, pickup_date),
        deals!inner(id, agreed_price, status, client_id, carrier_id),
        warehouses!inner(id, name, code, address, city, country)
      `)
      .eq('id', documentId)
      .single()

    if (docError || !document) {
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Generate PDF
    const pdfBytes = await generatePDF(document)

    // Create file path
    const year = new Date().getFullYear()
    const filePath = `documents/${year}/${document.document_type}/${document.document_number}.pdf`

    // Upload to storage
    const { error: uploadError } = await supabaseClient.storage
      .from('documents')
      .upload(filePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return new Response(JSON.stringify({ error: 'Failed to upload PDF' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Update document with file info
    const fileHash = await computeHash(pdfBytes)
    await supabaseClient
      .from('documents')
      .update({
        file_path: filePath,
        file_size: pdfBytes.length,
        file_hash: fileHash,
        status: 'final'
      })
      .eq('id', documentId)

    // Get public URL
    const { data: { publicUrl } } = supabaseClient.storage
      .from('documents')
      .getPublicUrl(filePath)

    return new Response(JSON.stringify({
      success: true,
      filePath,
      publicUrl,
      fileSize: pdfBytes.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error generating PDF:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function generatePDF(document: DocumentData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842]) // A4 size
  
  // Embed fonts
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  
  let yPosition = 750
  const lineHeight = 20
  const margin = 50
  
  // Company Header
  page.drawText('Swift Ship Connect', {
    x: margin,
    y: yPosition,
    size: 24,
    font: helveticaBoldFont,
    color: rgb(0.2, 0.4, 0.8)
  })
  
  yPosition -= 30
  page.drawText('Logistics Platform', {
    x: margin,
    y: yPosition,
    size: 12,
    font: helveticaFont,
    color: rgb(0.5, 0.5, 0.5)
  })
  
  yPosition -= 40
  
  // Document Title and Number
  page.drawText(document.title, {
    x: margin,
    y: yPosition,
    size: 18,
    font: helveticaBoldFont,
    color: rgb(0, 0, 0)
  })
  
  yPosition -= 25
  page.drawText(`Document Number: ${document.document_number}`, {
    x: margin,
    y: yPosition,
    size: 14,
    font: helveticaFont,
    color: rgb(0.3, 0.3, 0.3)
  })
  
  yPosition -= 20
  page.drawText(`Type: ${getDocumentTypeLabel(document.document_type)}`, {
    x: margin,
    y: yPosition,
    size: 12,
    font: helveticaFont,
    color: rgb(0.3, 0.3, 0.3)
  })
  
  yPosition -= 30
  
  // Document Info Box
  drawBox(page, margin, yPosition, 495, 120)
  yPosition += 10
  
  page.drawText('Document Information:', {
    x: margin + 10,
    y: yPosition,
    size: 12,
    font: helveticaBoldFont,
    color: rgb(0, 0, 0)
  })
  
  yPosition -= 20
  page.drawText(`Created: ${formatDate(document.created_at)}`, {
    x: margin + 10,
    y: yPosition,
    size: 10,
    font: helveticaFont,
    color: rgb(0.3, 0.3, 0.3)
  })
  
  if (document.approved_at) {
    yPosition -= 15
    page.drawText(`Approved: ${formatDate(document.approved_at)}`, {
      x: margin + 10,
      y: yPosition,
      size: 10,
      font: helveticaFont,
      color: rgb(0.3, 0.3, 0.3)
    })
  }
  
  // Order/Deal Information
  if (document.orders) {
    yPosition -= 20
    page.drawText('Order Details:', {
      x: margin + 10,
      y: yPosition,
      size: 12,
      font: helveticaBoldFont,
      color: rgb(0, 0, 0)
    })
    
    yPosition -= 15
    page.drawText(`Cargo: ${document.orders.cargo_type}`, {
      x: margin + 10,
      y: yPosition,
      size: 10,
      font: helveticaFont,
      color: rgb(0.3, 0.3, 0.3)
    })
    
    yPosition -= 15
    page.drawText(`From: ${document.orders.pickup_address}`, {
      x: margin + 10,
      y: yPosition,
      size: 10,
      font: helveticaFont,
      color: rgb(0.3, 0.3, 0.3)
    })
    
    yPosition -= 15
    page.drawText(`To: ${document.orders.delivery_address}`, {
      x: margin + 10,
      y: yPosition,
      size: 10,
      font: helveticaFont,
      color: rgb(0.3, 0.3, 0.3)
    })
  }
  
  yPosition -= 40
  
  // Document Items (if any)
  if (document.document_items && document.document_items.length > 0) {
    page.drawText('Items:', {
      x: margin,
      y: yPosition,
      size: 14,
      font: helveticaBoldFont,
      color: rgb(0, 0, 0)
    })
    
    yPosition -= 25
    
    // Table headers
    page.drawText('Description', { x: margin + 10, y: yPosition, size: 10, font: helveticaBoldFont })
    page.drawText('Quantity', { x: margin + 200, y: yPosition, size: 10, font: helveticaBoldFont })
    page.drawText('Price', { x: margin + 300, y: yPosition, size: 10, font: helveticaBoldFont })
    page.drawText('Total', { x: margin + 400, y: yPosition, size: 10, font: helveticaBoldFont })
    
    yPosition -= 15
    
    // Table items
    for (const item of document.document_items) {
      if (yPosition < 100) break // Avoid page overflow
      
      page.drawText(item.product_name || '', { x: margin + 10, y: yPosition, size: 9, font: helveticaFont })
      page.drawText(item.quantity?.toString() || '', { x: margin + 200, y: yPosition, size: 9, font: helveticaFont })
      page.drawText(item.unit_price?.toString() || '', { x: margin + 300, y: yPosition, size: 9, font: helveticaFont })
      page.drawText(item.total_price?.toString() || '', { x: margin + 400, y: yPosition, size: 9, font: helveticaFont })
      
      yPosition -= 12
    }
  }
  
  // Signatures
  yPosition = 150
  page.drawText('Signatures:', {
    x: margin,
    y: yPosition,
    size: 12,
    font: helveticaBoldFont,
    color: rgb(0, 0, 0)
  })
  
  yPosition -= 30
  
  // Creator signature
  if (document.creator) {
    page.drawLine({
      start: { x: margin, y: yPosition },
      end: { x: margin + 150, y: yPosition },
      thickness: 1,
      color: rgb(0, 0, 0)
    })
    
    yPosition -= 15
    page.drawText('Created by:', {
      x: margin,
      y: yPosition,
      size: 9,
      font: helveticaFont,
      color: rgb(0.3, 0.3, 0.3)
    })
    
    yPosition -= 12
    page.drawText(document.creator.full_name || document.creator.email || 'Unknown', {
      x: margin,
      y: yPosition,
      size: 10,
      font: helveticaFont,
      color: rgb(0, 0, 0)
    })
  }
  
  // Approver signature
  if (document.approver && document.approved_at) {
    page.drawLine({
      start: { x: margin + 200, y: yPosition + 27 },
      end: { x: margin + 350, y: yPosition + 27 },
      thickness: 1,
      color: rgb(0, 0, 0)
    })
    
    page.drawText('Approved by:', {
      x: margin + 200,
      y: yPosition + 12,
      size: 9,
      font: helveticaFont,
      color: rgb(0.3, 0.3, 0.3)
    })
    
    page.drawText(document.approver.full_name || document.approver.email || 'Unknown', {
      x: margin + 200,
      y: yPosition,
      size: 10,
      font: helveticaFont,
      color: rgb(0, 0, 0)
    })
  }
  
  // Footer
  yPosition = 50
  page.drawText(`Generated on ${formatDate(new Date().toISOString())} by Swift Ship Connect`, {
    x: margin,
    y: yPosition,
    size: 8,
    font: helveticaFont,
    color: rgb(0.5, 0.5, 0.5)
  })
  
  return await pdfDoc.save()
}

function drawBox(page: any, x: number, y: number, width: number, height: number) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1
  })
}

function getDocumentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'order_confirmation': 'Order Confirmation',
    'shipping_manifest': 'Shipping Manifest',
    'receiving_report': 'Receiving Report',
    'inventory_report': 'Inventory Report',
    'warehouse_receipt': 'Warehouse Receipt',
    'delivery_note': 'Delivery Note',
    'invoice': 'Invoice',
    'customs_declaration': 'Customs Declaration'
  }
  return labels[type] || type
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function computeHash(data: Uint8Array): Promise<string> {
  const msgBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(msgBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
