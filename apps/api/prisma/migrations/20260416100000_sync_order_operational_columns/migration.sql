DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'OrderSource'
      AND n.nspname = 'tote-bag'
  ) THEN
    CREATE TYPE "tote-bag"."OrderSource" AS ENUM ('ECOMMERCE', 'MANUAL');
  END IF;
END $$;

ALTER TYPE "tote-bag"."OrderStatus" ADD VALUE IF NOT EXISTS 'PENDING_DEPOSIT';
ALTER TYPE "tote-bag"."OrderStatus" ADD VALUE IF NOT EXISTS 'IN_PRODUCTION';
ALTER TYPE "tote-bag"."OrderStatus" ADD VALUE IF NOT EXISTS 'PENDING_FINAL_PAYMENT';
ALTER TYPE "tote-bag"."OrderStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_DISPATCH';
ALTER TYPE "tote-bag"."OrderStatus" ADD VALUE IF NOT EXISTS 'RETURNED_TO_STOCK';

ALTER TABLE "tote-bag"."orders"
ADD COLUMN IF NOT EXISTS "source" "tote-bag"."OrderSource" NOT NULL DEFAULT 'ECOMMERCE',
ADD COLUMN IF NOT EXISTS "is_manual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "payment_receipt_url" TEXT,
ADD COLUMN IF NOT EXISTS "amount_paid" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "balance_due" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "net_amount" DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS "tax_total" DECIMAL(10,2);

UPDATE "tote-bag"."orders"
SET
  "source" = COALESCE("source", 'ECOMMERCE'),
  "is_manual" = COALESCE("is_manual", false),
  "amount_paid" = COALESCE("amount_paid", 0),
  "balance_due" = COALESCE(
    "balance_due",
    ROUND(GREATEST("total_amount"::numeric - COALESCE("amount_paid", 0), 0), 2)
  ),
  "net_amount" = COALESCE(
    "net_amount",
    ROUND(("total_amount"::numeric / 1.19), 2)
  ),
  "tax_total" = COALESCE(
    "tax_total",
    ROUND(
      "total_amount"::numeric - ROUND(("total_amount"::numeric / 1.19), 2),
      2
    )
  );

ALTER TABLE "tote-bag"."orders"
ALTER COLUMN "source" SET DEFAULT 'ECOMMERCE',
ALTER COLUMN "source" SET NOT NULL,
ALTER COLUMN "is_manual" SET DEFAULT false,
ALTER COLUMN "is_manual" SET NOT NULL,
ALTER COLUMN "amount_paid" SET DEFAULT 0,
ALTER COLUMN "amount_paid" SET NOT NULL,
ALTER COLUMN "balance_due" SET DEFAULT 0,
ALTER COLUMN "balance_due" SET NOT NULL,
ALTER COLUMN "net_amount" SET NOT NULL,
ALTER COLUMN "tax_total" SET NOT NULL;

ALTER TABLE "tote-bag"."order_status_history"
ADD COLUMN IF NOT EXISTS "old_status" "tote-bag"."OrderStatus",
ADD COLUMN IF NOT EXISTS "new_status" "tote-bag"."OrderStatus",
ADD COLUMN IF NOT EXISTS "user_id" TEXT;
