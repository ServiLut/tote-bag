-- B2B manual quote support and temporary stock reservations.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'B2BQuoteItemType'
      AND n.nspname = 'tote-bag'
  ) THEN
    CREATE TYPE "tote-bag"."B2BQuoteItemType" AS ENUM (
      'STANDARD_STOCK',
      'MANUAL_EXTERNAL_PRODUCTION'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'B2BReservationStatus'
      AND n.nspname = 'tote-bag'
  ) THEN
    CREATE TYPE "tote-bag"."B2BReservationStatus" AS ENUM (
      'NONE',
      'ACTIVE',
      'RELEASED',
      'EXPIRED'
    );
  END IF;
END $$;

ALTER TABLE "tote-bag"."b2b_quotes"
ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "reservation_status" "tote-bag"."B2BReservationStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN IF NOT EXISTS "reservation_hours" INTEGER,
ADD COLUMN IF NOT EXISTS "reservation_released_at" TIMESTAMP(3);

ALTER TABLE "tote-bag"."b2b_quote_items"
ADD COLUMN IF NOT EXISTS "variant_id" TEXT,
ADD COLUMN IF NOT EXISTS "item_type" "tote-bag"."B2BQuoteItemType" NOT NULL DEFAULT 'STANDARD_STOCK',
ADD COLUMN IF NOT EXISTS "manual_size" TEXT,
ADD COLUMN IF NOT EXISTS "manual_specs" JSONB,
ADD COLUMN IF NOT EXISTS "external_unit_cost" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "agreed_unit_price" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "reservation_expires_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "reservation_released_at" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'b2b_quote_items_variant_id_fkey'
  ) THEN
    ALTER TABLE "tote-bag"."b2b_quote_items"
    ADD CONSTRAINT "b2b_quote_items_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "tote-bag"."variants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "b2b_quotes_reservation_status_idx"
ON "tote-bag"."b2b_quotes"("reservation_status");

CREATE INDEX IF NOT EXISTS "b2b_quotes_expires_at_idx"
ON "tote-bag"."b2b_quotes"("expires_at");

CREATE INDEX IF NOT EXISTS "b2b_quote_items_variant_id_idx"
ON "tote-bag"."b2b_quote_items"("variant_id");

CREATE INDEX IF NOT EXISTS "b2b_quote_items_item_type_idx"
ON "tote-bag"."b2b_quote_items"("item_type");

CREATE INDEX IF NOT EXISTS "b2b_quote_items_reservation_expires_at_idx"
ON "tote-bag"."b2b_quote_items"("reservation_expires_at");
