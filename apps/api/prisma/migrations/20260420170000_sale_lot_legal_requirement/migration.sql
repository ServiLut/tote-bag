-- Sale legal requirement derived from the real purchase batch document origin.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'SaleLegalRequirement'
      AND n.nspname = 'tote-bag'
  ) THEN
    CREATE TYPE "tote-bag"."SaleLegalRequirement" AS ENUM (
      'PENDING_STOCK_ASSIGNMENT',
      'ELECTRONIC_INVOICE_REQUIRED',
      'INTERNAL_DOCUMENT_ALLOWED'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'SaleLegalStatus'
      AND n.nspname = 'tote-bag'
  ) THEN
    CREATE TYPE "tote-bag"."SaleLegalStatus" AS ENUM (
      'PENDING',
      'COMPLETED',
      'NOT_REQUIRED'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'SaleLegalDocumentType'
      AND n.nspname = 'tote-bag'
  ) THEN
    CREATE TYPE "tote-bag"."SaleLegalDocumentType" AS ENUM (
      'ELECTRONIC_INVOICE',
      'INTERNAL_DELIVERY_NOTE'
    );
  END IF;
END $$;

ALTER TABLE "tote-bag"."orders"
ADD COLUMN IF NOT EXISTS "sale_legal_requirement" "tote-bag"."SaleLegalRequirement" NOT NULL DEFAULT 'PENDING_STOCK_ASSIGNMENT',
ADD COLUMN IF NOT EXISTS "sale_legal_status" "tote-bag"."SaleLegalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS "sale_legal_document_type" "tote-bag"."SaleLegalDocumentType",
ADD COLUMN IF NOT EXISTS "sale_legal_document_reference" TEXT,
ADD COLUMN IF NOT EXISTS "sale_legal_trace" JSONB,
ADD COLUMN IF NOT EXISTS "sale_legal_resolved_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "sale_legal_completed_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "orders_sale_legal_requirement_idx"
ON "tote-bag"."orders"("sale_legal_requirement");

CREATE INDEX IF NOT EXISTS "orders_sale_legal_status_idx"
ON "tote-bag"."orders"("sale_legal_status");
