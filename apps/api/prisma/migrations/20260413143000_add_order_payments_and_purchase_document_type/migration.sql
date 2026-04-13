-- Módulo 1: diferenciar factura de proveedor y remisión.
CREATE TYPE "tote-bag"."PurchaseDocumentType" AS ENUM (
    'INVOICE',
    'DELIVERY_NOTE'
);

ALTER TABLE "tote-bag"."purchase_invoices"
ADD COLUMN "document_type" "tote-bag"."PurchaseDocumentType" NOT NULL DEFAULT 'INVOICE';

-- Módulo 2: saldos de órdenes y pagos parciales.
ALTER TYPE "tote-bag"."OrderStatus" ADD VALUE IF NOT EXISTS 'PENDING_DEPOSIT';
ALTER TYPE "tote-bag"."OrderStatus" ADD VALUE IF NOT EXISTS 'IN_PRODUCTION';
ALTER TYPE "tote-bag"."OrderStatus" ADD VALUE IF NOT EXISTS 'PENDING_FINAL_PAYMENT';
ALTER TYPE "tote-bag"."OrderStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_DISPATCH';

ALTER TABLE "tote-bag"."orders"
ADD COLUMN "amount_paid" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN "balance_due" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- Backfill compatible: sin información histórica de abonos de órdenes,
-- amount_paid queda en 0 y balance_due conserva el bruto pendiente.
UPDATE "tote-bag"."orders"
SET
  "amount_paid" = 0,
  "balance_due" = ROUND(GREATEST("total_amount"::numeric - "amount_paid", 0), 2);

CREATE TABLE "tote-bag"."order_payments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "proof_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_payments_order_id_payment_date_idx"
ON "tote-bag"."order_payments"("order_id", "payment_date");

ALTER TABLE "tote-bag"."order_payments"
ADD CONSTRAINT "order_payments_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "tote-bag"."orders"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
