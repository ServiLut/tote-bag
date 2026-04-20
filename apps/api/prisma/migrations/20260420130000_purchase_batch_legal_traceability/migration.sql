ALTER TABLE "tote-bag"."purchase_batches"
ADD COLUMN IF NOT EXISTS "document_type" "tote-bag"."PurchaseDocumentType" NOT NULL DEFAULT 'INVOICE',
ADD COLUMN IF NOT EXISTS "support_url" TEXT;

UPDATE "tote-bag"."purchase_batches"
SET "support_url" = COALESCE("support_url", "payment_receipt_url")
WHERE "support_url" IS NULL
  AND "payment_receipt_url" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "purchase_batches_document_type_idx"
ON "tote-bag"."purchase_batches"("document_type");

CREATE INDEX IF NOT EXISTS "purchase_batches_support_url_idx"
ON "tote-bag"."purchase_batches"("support_url");
