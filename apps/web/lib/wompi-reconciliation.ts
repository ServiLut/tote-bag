import { createServerClient } from '@supabase/ssr';
import { getSupabaseEnv } from '@/lib/env';

const WOMPI_API_BASE_URL = process.env.NEXT_PUBLIC_WOMPI_ENV === 'prod' 
  ? 'https://production.wompi.co/v1' 
  : 'https://sandbox.wompi.co/v1';

export interface WompiTransactionResponse {
  id: string;
  status: string;
  amount_in_cents: number;
  reference: string;
  customer_email: string;
  payment_method_type: string;
  [key: string]: unknown;
}

/**
 * Fetches transaction details from Wompi API for reconciliation.
 */
export async function fetchWompiTransaction(transactionId: string): Promise<WompiTransactionResponse> {
  const publicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY;
  
  if (!publicKey) {
    throw new Error('NEXT_PUBLIC_WOMPI_PUBLIC_KEY is missing');
  }

  const res = await fetch(`${WOMPI_API_BASE_URL}/transactions/${transactionId}`, {
    headers: {
      Authorization: `Bearer ${publicKey}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Wompi API error: ${res.status} - ${errorText}`);
  }

  const payload = await res.json();
  return payload.data;
}

/**
 * Reconciles a single order by checking its payment status in Wompi.
 */
export async function reconcileOrderWithWompi(orderId: string, transactionId: string) {
  const env = getSupabaseEnv();
  if (!env) throw new Error('Supabase environment not configured');

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: { getAll: () => [], setAll: () => {} }
  });

  try {
    const transaction = await fetchWompiTransaction(transactionId);
    const status = transaction.status;

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: status === 'APPROVED' ? 'PAID' : (status === 'DECLINED' || status === 'ERROR' ? 'PAYMENT_FAILED' : 'PENDING'),
        payment_id: transactionId,
        payment_status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (updateError) throw updateError;

    return { orderId, transactionId, status, success: true };
  } catch (error) {
    console.error(`[Reconciliation] Error for order ${orderId}:`, error);
    return { orderId, transactionId, success: false, error };
  }
}

/**
 * Batch reconciliation for pending orders.
 * (Placeholder logic: in a real app, this would query orders with 'PENDING' status)
 */
export async function runBatchReconciliation() {
  const env = getSupabaseEnv();
  if (!env) return;

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: { getAll: () => [], setAll: () => {} }
  });

  // Fetch orders that are pending and have a payment_id
  const { data: pendingOrders } = await supabase
    .from('orders')
    .select('id, payment_id')
    .eq('status', 'PENDING')
    .not('payment_id', 'is', null);

  if (!pendingOrders || pendingOrders.length === 0) return [];

  const results = await Promise.all(
    pendingOrders.map(order => reconcileOrderWithWompi(order.id, order.payment_id))
  );

  return results;
}
