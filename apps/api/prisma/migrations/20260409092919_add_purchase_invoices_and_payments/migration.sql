-- CreateEnum
CREATE TYPE "tote-bag"."PurchaseInvoiceStatus" AS ENUM (
    'PENDING',
    'PARTIAL',
    'PAID'
);

-- CreateTable
CREATE TABLE "tote-bag"."purchase_invoices" (
    "id" TEXT NOT NULL,
    "total_amount" DECIMAL(18,2) NOT NULL,
    "paid_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "balance_due" DECIMAL(18,2) NOT NULL,
    "status" "tote-bag"."PurchaseInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "issue_date" TIMESTAMP(3) NOT NULL,
    "supplier_id" TEXT,
    "purchase_batch_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tote-bag"."purchase_payments" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "proof_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_invoices_supplier_id_status_issue_date_idx"
ON "tote-bag"."purchase_invoices"("supplier_id", "status", "issue_date");

-- CreateIndex
CREATE INDEX "purchase_invoices_purchase_batch_id_idx"
ON "tote-bag"."purchase_invoices"("purchase_batch_id");

-- CreateIndex
CREATE INDEX "purchase_payments_invoice_id_payment_date_idx"
ON "tote-bag"."purchase_payments"("invoice_id", "payment_date");

-- AddForeignKey
ALTER TABLE "tote-bag"."purchase_invoices"
ADD CONSTRAINT "purchase_invoices_supplier_id_fkey"
FOREIGN KEY ("supplier_id") REFERENCES "tote-bag"."suppliers"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tote-bag"."purchase_invoices"
ADD CONSTRAINT "purchase_invoices_purchase_batch_id_fkey"
FOREIGN KEY ("purchase_batch_id") REFERENCES "tote-bag"."purchase_batches"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tote-bag"."purchase_payments"
ADD CONSTRAINT "purchase_payments_invoice_id_fkey"
FOREIGN KEY ("invoice_id") REFERENCES "tote-bag"."purchase_invoices"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
