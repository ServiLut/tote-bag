import { NextRequest, NextResponse } from 'next/server';
import { validateWompiEventChecksum, WompiWebhookPayload } from '@/lib/wompi';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseEnv } from '@/lib/env';

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as WompiWebhookPayload;
    const eventsSecret = process.env.WOMPI_EVENTS_SECRET;

    if (!eventsSecret) {
      console.error('[Wompi Webhook] Missing WOMPI_EVENTS_SECRET');
      // No devolvemos 500 para no dar pistas de infraestructura, pero logueamos
      return NextResponse.json({ message: 'Internal configuration error' }, { status: 500 });
    }

    // 1. Validar firma
    if (!validateWompiEventChecksum(payload, eventsSecret)) {
      console.warn('[Wompi Webhook] Invalid signature detected');
      return NextResponse.json({ message: 'Invalid signature' }, { status: 401 });
    }

    const { data: { transaction } } = payload;
    const { id: transactionId, status, reference } = transaction;

    const env = getSupabaseEnv();
    if (!env) {
      console.error('[Wompi Webhook] Supabase env missing');
      return NextResponse.json({ message: 'Database error' }, { status: 500 });
    }

    // Usamos service role si existe para bypass RLS en auditoria, o anon si no hay de otra
    const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
      cookies: { getAll: () => [], setAll: () => {} }
    });

    // 2. Idempotencia: Verificar si ya procesamos este evento
    const { data: existingEvent } = await supabase
      .from('wompi_webhook_events')
      .select('id')
      .eq('event_id', transactionId)
      .single();

    if (existingEvent) {
      console.info(`[Wompi Webhook] Event ${transactionId} already processed.`);
      return NextResponse.json({ message: 'Event already processed' }, { status: 200 });
    }

    // 3. Registrar el evento para auditoria e idempotencia
    const { error: insertError } = await supabase.from('wompi_webhook_events').insert({
      event_id: transactionId,
      event_type: payload.event,
      payload: payload,
      status: status,
      reference: reference,
      sent_at: payload.sent_at
    });

    if (insertError) {
      console.error('[Wompi Webhook] Error storing event:', insertError);
      // Si falla el guardado del log, podriamos tener problemas de duplicados luego
    }

    // 4. Actualizar la orden segun el estado
    // Asumimos que la referencia es el ID de la orden o contiene el ID
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: status === 'APPROVED' ? 'PAID' : (status === 'DECLINED' || status === 'ERROR' ? 'PAYMENT_FAILED' : 'PENDING'),
        payment_id: transactionId,
        payment_status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', reference);

    if (updateError) {
      console.error('[Wompi Webhook] Error updating order:', updateError);
      return NextResponse.json({ message: 'Error updating order' }, { status: 500 });
    }

    console.info(`[Wompi Webhook] Transaction ${transactionId} processed as ${status} for order ${reference}`);
    return NextResponse.json({ message: 'Webhook processed successfully' }, { status: 200 });

  } catch (error) {
    console.error('[Wompi Webhook] Unexpected error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
