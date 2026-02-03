import { NextRequest, NextResponse } from 'next/server';
import { ClickService, ClickWebhookData } from '@/integrations/payments/click.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const params = new URLSearchParams(body);
    
    // Парсим данные от Click
    const webhookData: ClickWebhookData = {
      click_trans_id: parseInt(params.get('click_trans_id') || '0'),
      service_id: parseInt(params.get('service_id') || '0'),
      click_paydoc_id: parseInt(params.get('click_paydoc_id') || '0'),
      merchant_trans_id: params.get('merchant_trans_id') || '',
      amount: parseInt(params.get('amount') || '0'),
      action: parseInt(params.get('action') || '0'),
      error: parseInt(params.get('error') || '0'),
      error_note: params.get('error_note') || '',
      sign_time: parseInt(params.get('sign_time') || '0'),
      sign_string: params.get('sign_string') || ''
    };

    console.log('Click webhook received:', webhookData);

    // Обрабатываем вебхук
    const result = await ClickService.handleWebhook(webhookData);

    // Формируем ответ для Click
    const response = new URLSearchParams();
    response.append('click_trans_id', webhookData.click_trans_id.toString());
    response.append('merchant_trans_id', webhookData.merchant_trans_id);
    response.append('merchant_prepare_id', webhookData.merchant_trans_id);
    response.append('error', result.status.toString());
    response.append('error_note', result.message);

    return new NextResponse(response.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  } catch (error) {
    console.error('Click webhook error:', error);
    
    // Ответ об ошибке
    const response = new URLSearchParams();
    response.append('error', '-1');
    response.append('error_note', 'Internal server error');

    return new NextResponse(response.toString(), {
      status: 500,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }
}
