import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { jsPDF } from "https://cdn.skypack.dev/jspdf@2.5.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { documentType, data, options } = await req.json()

    const pdf = new jsPDF()
    
    switch (documentType) {
      case 'transport_contract':
        generateTransportContract(pdf, data)
        break
      case 'waybill':
        generateWaybill(pdf, data)
        break
      case 'completion_act':
        generateCompletionAct(pdf, data)
        break
      case 'invoice':
        generateInvoice(pdf, data)
        break
      case 'cmr':
        generateCMR(pdf, data)
        break
      default:
        throw new Error('Unknown document type')
    }

    // Add QR code for verification
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    addQRCode(pdf, docId)

    // Get PDF as buffer
    const pdfBytes = pdf.output('arraybuffer')
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })
    
    // Upload to storage
    const fileName = `generated/${docId}.pdf`
    const { error: uploadError } = await supabaseClient.storage
      .from('documents')
      .upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: false
      })

    if (uploadError) {
      throw uploadError
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseClient.storage
      .from('documents')
      .getPublicUrl(fileName)

    // Save document record
    await supabaseClient
      .from('documents')
      .insert({
        user_id: options?.userId || data.user_id,
        order_id: options?.orderId,
        type: documentType,
        file_path: publicUrl,
        file_name: `${documentType}_${docId}.pdf`,
        file_size: pdfBlob.size,
        mime_type: 'application/pdf',
        status: 'uploaded',
        metadata: {
          generated_at: new Date().toISOString(),
          document_id: docId,
          auto_generated: true
        }
      })

    return new Response(
      JSON.stringify({ 
        url: publicUrl,
        documentId: docId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

function generateTransportContract(pdf: jsPDF, data: any) {
  // Add title
  pdf.setFontSize(20)
  pdf.text('ДОГОВОР ПЕРЕВОЗКИ', 105, 20, { align: 'center' })
  
  pdf.setFontSize(12)
  let yPosition = 40
  
  // Contract number and date
  pdf.text(`Договор №: ${data.contractNumber || 'АБ-' + Date.now()}`, 20, yPosition)
  yPosition += 10
  pdf.text(`Дата: ${new Date().toLocaleDateString('ru-RU')}`, 20, yPosition)
  yPosition += 20
  
  // Parties
  pdf.setFontSize(14)
  pdf.text('Стороны договора:', 20, yPosition)
  yPosition += 15
  
  pdf.setFontSize(11)
  pdf.text('Заказчик:', 20, yPosition)
  yPosition += 8
  pdf.text(`${data.client?.name || ''}`, 30, yPosition)
  yPosition += 8
  pdf.text(`ИНН: ${data.client?.inn || ''}`, 30, yPosition)
  yPosition += 8
  pdf.text(`Адрес: ${data.client?.address || ''}`, 30, yPosition)
  yPosition += 15
  
  pdf.text('Перевозчик:', 20, yPosition)
  yPosition += 8
  pdf.text(`${data.carrier?.name || ''}`, 30, yPosition)
  yPosition += 8
  pdf.text(`ИНН: ${data.carrier?.inn || ''}`, 30, yPosition)
  yPosition += 8
  pdf.text(`Адрес: ${data.carrier?.address || ''}`, 30, yPosition)
  yPosition += 20
  
  // Cargo details
  pdf.setFontSize(14)
  pdf.text('Информация о грузе:', 20, yPosition)
  yPosition += 15
  
  pdf.setFontSize(11)
  pdf.text(`Наименование груза: ${data.cargo?.type || ''}`, 20, yPosition)
  yPosition += 8
  pdf.text(`Вес: ${data.cargo?.weight || ''} кг`, 20, yPosition)
  yPosition += 8
  pdf.text(`Габариты: ${data.cargo?.dimensions || ''}`, 20, yPosition)
  yPosition += 15
  
  // Route
  pdf.setFontSize(14)
  pdf.text('Маршрут:', 20, yPosition)
  yPosition += 15
  
  pdf.setFontSize(11)
  pdf.text(`Откуда: ${data.route?.from || ''}`, 20, yPosition)
  yPosition += 8
  pdf.text(`Куда: ${data.route?.to || ''}`, 20, yPosition)
  yPosition += 15
  
  // Price
  pdf.setFontSize(14)
  pdf.text('Стоимость:', 20, yPosition)
  yPosition += 15
  
  pdf.setFontSize(11)
  pdf.text(`Сумма: ${data.price?.amount || ''} ${data.price?.currency || 'UZS'}`, 20, yPosition)
  yPosition += 8
  pdf.text(`Условия оплаты: ${data.price?.terms || ''}`, 20, yPosition)
  
  // Add signature fields
  yPosition = 250
  pdf.text('Заказчик: _______________', 20, yPosition)
  pdf.text('Перевозчик: _______________', 120, yPosition)
}

function generateWaybill(pdf: jsPDF, data: any) {
  pdf.setFontSize(16)
  pdf.text('ТОВАРНО-ТРАНСПОРТНАЯ НАКЛАДНАЯ', 105, 20, { align: 'center' })
  
  pdf.setFontSize(12)
  let yPosition = 40
  
  // Document number
  pdf.text(`ТТН №: ${data.waybillNumber || 'ТТН-' + Date.now()}`, 20, yPosition)
  yPosition += 10
  pdf.text(`Дата: ${new Date().toLocaleDateString('ru-RU')}`, 20, yPosition)
  yPosition += 20
  
  // Sender
  pdf.setFontSize(14)
  pdf.text('Отправитель:', 20, yPosition)
  yPosition += 10
  
  pdf.setFontSize(11)
  pdf.text(`${data.sender?.name || ''}`, 30, yPosition)
  yPosition += 8
  pdf.text(`Адрес: ${data.sender?.address || ''}`, 30, yPosition)
  yPosition += 15
  
  // Receiver
  pdf.setFontSize(14)
  pdf.text('Получатель:', 20, yPosition)
  yPosition += 10
  
  pdf.setFontSize(11)
  pdf.text(`${data.receiver?.name || ''}`, 30, yPosition)
  yPosition += 8
  pdf.text(`Адрес: ${data.receiver?.address || ''}`, 30, yPosition)
  yPosition += 15
  
  // Cargo table
  pdf.setFontSize(14)
  pdf.text('Информация о грузе:', 20, yPosition)
  yPosition += 15
  
  // Simple table
  pdf.setFontSize(11)
  pdf.text('Наименование:', 20, yPosition)
  pdf.text(`${data.cargo?.name || ''}`, 80, yPosition)
  yPosition += 8
  
  pdf.text('Вес (кг):', 20, yPosition)
  pdf.text(`${data.cargo?.weight || ''}`, 80, yPosition)
  yPosition += 8
  
  pdf.text('Объем (м³):', 20, yPosition)
  pdf.text(`${data.cargo?.volume || ''}`, 80, yPosition)
  yPosition += 15
  
  // Vehicle info
  pdf.setFontSize(14)
  pdf.text('Транспортное средство:', 20, yPosition)
  yPosition += 10
  
  pdf.setFontSize(11)
  pdf.text(`Марка: ${data.vehicle?.brand || ''}`, 30, yPosition)
  yPosition += 8
  pdf.text(`Гос. номер: ${data.vehicle?.plateNumber || ''}`, 30, yPosition)
  yPosition += 8
  pdf.text(`Водитель: ${data.driver?.name || ''}`, 30, yPosition)
}

function generateCompletionAct(pdf: jsPDF, data: any) {
  pdf.setFontSize(16)
  pdf.text('АКТ ВЫПОЛНЕННЫХ РАБОТ', 105, 20, { align: 'center' })
  
  pdf.setFontSize(12)
  let yPosition = 40
  
  pdf.text(`АКТ №: ${data.actNumber || 'АКТ-' + Date.now()}`, 20, yPosition)
  yPosition += 10
  pdf.text(`Дата: ${new Date().toLocaleDateString('ru-RU')}`, 20, yPosition)
  yPosition += 20
  
  // Order info
  pdf.setFontSize(14)
  pdf.text('По заказу:', 20, yPosition)
  yPosition += 10
  
  pdf.setFontSize(11)
  pdf.text(`Заказ №: ${data.order?.id || ''}`, 30, yPosition)
  yPosition += 8
  pdf.text(`Дата заказа: ${data.order?.date || ''}`, 30, yPosition)
  yPosition += 15
  
  // Completion details
  pdf.setFontSize(14)
  pdf.text('Выполненные работы:', 20, yPosition)
  yPosition += 15
  
  pdf.setFontSize(11)
  pdf.text(`Перевозка груза из "${data.route?.from || ''}" в "${data.route?.to || ''}"`, 20, yPosition)
  yPosition += 8
  pdf.text(`Дата выполнения: ${data.completionDate || new Date().toLocaleDateString('ru-RU')}`, 20, yPosition)
  yPosition += 15
  
  // Cost
  pdf.setFontSize(14)
  pdf.text('Стоимость услуг:', 20, yPosition)
  yPosition += 10
  
  pdf.setFontSize(11)
  pdf.text(`Сумма: ${data.amount || ''} ${data.currency || 'UZS'}`, 30, yPosition)
  yPosition += 20
  
  // Signatures
  pdf.setFontSize(14)
  pdf.text('Подписи сторон:', 20, yPosition)
  yPosition += 20
  
  pdf.setFontSize(11)
  pdf.text('Заказчик:', 20, yPosition)
  pdf.text('_____________________', 70, yPosition)
  yPosition += 15
  
  pdf.text('Перевозчик:', 20, yPosition)
  pdf.text('_____________________', 70, yPosition)
}

function generateInvoice(pdf: jsPDF, data: any) {
  pdf.setFontSize(16)
  pdf.text('СЧЕТ НА ОПЛАТУ', 105, 20, { align: 'center' })
  
  pdf.setFontSize(12)
  let yPosition = 40
  
  pdf.text(`Счет №: ${data.invoiceNumber || 'СЧ-' + Date.now()}`, 20, yPosition)
  yPosition += 10
  pdf.text(`Дата: ${new Date().toLocaleDateString('ru-RU')}`, 20, yPosition)
  yPosition += 20
  
  // Bill to
  pdf.setFontSize(14)
  pdf.text('Плательщик:', 20, yPosition)
  yPosition += 10
  
  pdf.setFontSize(11)
  pdf.text(`${data.billing?.name || ''}`, 30, yPosition)
  yPosition += 8
  pdf.text(`ИНН: ${data.billing?.inn || ''}`, 30, yPosition)
  yPosition += 8
  pdf.text(`Адрес: ${data.billing?.address || ''}`, 30, yPosition)
  yPosition += 20
  
  // Services table
  pdf.setFontSize(14)
  pdf.text('Услуги:', 20, yPosition)
  yPosition += 15
  
  pdf.setFontSize(11)
  pdf.text('Наименование услуги', 20, yPosition)
  pdf.text('Сумма', 150, yPosition)
  yPosition += 10
  
  pdf.line(20, yPosition, 190, yPosition)
  yPosition += 8
  
  // Service items
  data.services?.forEach((service: any, index: number) => {
    pdf.text(`${service.name || ''}`, 20, yPosition)
    pdf.text(`${service.amount || ''}`, 150, yPosition)
    yPosition += 8
  })
  
  yPosition += 5
  pdf.line(20, yPosition, 190, yPosition)
  yPosition += 10
  
  // Total
  pdf.setFontSize(12)
  pdf.text(`Итого: ${data.total || ''} ${data.currency || 'UZS'}`, 150, yPosition)
  yPosition += 15
  
  // Payment terms
  pdf.setFontSize(11)
  pdf.text(`Срок оплаты: ${data.paymentTerms || 'до ' + new Date(Date.now() + 7*24*60*60*1000).toLocaleDateString('ru-RU')}`, 20, yPosition)
}

function generateCMR(pdf: jsPDF, data: any) {
  pdf.setFontSize(16)
  pdf.text('CMR - МЕЖДУНАРОДНАЯ ТОВАРНО-ТРАНСПОРТНАЯ НАКЛАДНАЯ', 105, 20, { align: 'center' })
  
  pdf.setFontSize(12)
  let yPosition = 40
  
  pdf.text(`CMR №: ${data.cmrNumber || 'CMR-' + Date.now()}`, 20, yPosition)
  yPosition += 10
  pdf.text(`Дата: ${new Date().toLocaleDateString('ru-RU')}`, 20, yPosition)
  yPosition += 20
  
  // Parties
  pdf.setFontSize(14)
  pdf.text('Грузоотправитель:', 20, yPosition)
  yPosition += 10
  
  pdf.setFontSize(11)
  pdf.text(`${data.consignor?.name || ''}`, 30, yPosition)
  yPosition += 8
  pdf.text(`Адрес: ${data.consignor?.address || ''}`, 30, yPosition)
  yPosition += 15
  
  pdf.setFontSize(14)
  pdf.text('Грузополучатель:', 20, yPosition)
  yPosition += 10
  
  pdf.setFontSize(11)
  pdf.text(`${data.consignee?.name || ''}`, 30, yPosition)
  yPosition += 8
  pdf.text(`Адрес: ${data.consignee?.address || ''}`, 30, yPosition)
  yPosition += 15
  
  pdf.setFontSize(14)
  pdf.text('Перевозчик:', 20, yPosition)
  yPosition += 10
  
  pdf.setFontSize(11)
  pdf.text(`${data.carrier?.name || ''}`, 30, yPosition)
  yPosition += 8
  pdf.text(`Адрес: ${data.carrier?.address || ''}`, 30, yPosition)
  yPosition += 20
  
  // Goods
  pdf.setFontSize(14)
  pdf.text('Информация о товаре:', 20, yPosition)
  yPosition += 15
  
  pdf.setFontSize(11)
  pdf.text(`Описание: ${data.goods?.description || ''}`, 20, yPosition)
  yPosition += 8
  pdf.text(`Вес (кг): ${data.goods?.weight || ''}`, 20, yPosition)
  yPosition += 8
  pdf.text(`Объем (м³): ${data.goods?.volume || ''}`, 20, yPosition)
  yPosition += 8
  pdf.text(`Количество мест: ${data.goods?.packages || ''}`, 20, yPosition)
  yPosition += 15
  
  // Route
  pdf.setFontSize(14)
  pdf.text('Маршрут:', 20, yPosition)
  yPosition += 10
  
  pdf.setFontSize(11)
  pdf.text(`Место отправления: ${data.route?.from || ''}`, 30, yPosition)
  yPosition += 8
  pdf.text(`Место назначения: ${data.route?.to || ''}`, 30, yPosition)
}

function addQRCode(pdf: jsPDF, documentId: string) {
  // Simple QR code placeholder - in production, use a QR code library
  const qrText = `Проверить документ: ${window.location.origin}/verify/${documentId}`
  pdf.setFontSize(8)
  pdf.text(qrText, 105, 280, { align: 'center' })
  
  // Draw simple QR code box
  pdf.rect(85, 260, 40, 40)
  pdf.text('QR', 100, 283, { align: 'center' })
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)
