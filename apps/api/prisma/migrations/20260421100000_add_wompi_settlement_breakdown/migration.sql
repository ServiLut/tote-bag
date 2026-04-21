ALTER TABLE "tote-bag"."order_payments"
ADD COLUMN "provider" TEXT,
ADD COLUMN "external_transaction_id" TEXT,
ADD COLUMN "external_status" TEXT,
ADD COLUMN "payment_method_type" TEXT,
ADD COLUMN "gross_amount" DECIMAL(18, 2),
ADD COLUMN "net_received_amount" DECIMAL(18, 2),
ADD COLUMN "commission_amount" DECIMAL(18, 2),
ADD COLUMN "commission_vat_amount" DECIMAL(18, 2),
ADD COLUMN "rete_fuente_amount" DECIMAL(18, 2),
ADD COLUMN "rete_iva_amount" DECIMAL(18, 2),
ADD COLUMN "rete_ica_amount" DECIMAL(18, 2),
ADD COLUMN "packaging_cif_amount" DECIMAL(18, 2),
ADD COLUMN "settlement_source" TEXT,
ADD COLUMN "settlement_metadata" JSONB,
ADD COLUMN "reconciled_at" TIMESTAMP(3);

CREATE INDEX "order_payments_provider_idx"
ON "tote-bag"."order_payments"("provider");

CREATE INDEX "order_payments_external_transaction_id_idx"
ON "tote-bag"."order_payments"("external_transaction_id");
