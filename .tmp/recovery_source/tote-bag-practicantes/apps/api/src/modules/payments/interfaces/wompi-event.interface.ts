export interface WompiTransaction {
  id: string;
  created_at: string;
  amount_in_cents: number;
  reference: string;
  currency: string;
  payment_method_type: string;
  status: 'APPROVED' | 'VOIDED' | 'DECLINED' | 'ERROR' | 'PENDING';
  status_message: string | null;
  billing_data?: unknown;
  shipping_address?: unknown;
  redirect_url: string | null;
  payment_source_id: number | null;
  payment_link_id: string | null;
  customer_data?: unknown;
  bill_id: string | null;
  taxes?: unknown[];
}

export interface WompiEventData {
  transaction: WompiTransaction;
}

export interface WompiEvent {
  event: string;
  data: WompiEventData;
  environment: string;
  signature: {
    checksum: string;
    properties: string[];
  };
  timestamp: number;
  sent_at: string;
}
