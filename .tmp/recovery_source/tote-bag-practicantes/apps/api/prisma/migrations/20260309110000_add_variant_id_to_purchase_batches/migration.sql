ALTER TABLE "tote-bag"."purchase_batches"
ADD COLUMN IF NOT EXISTS "variant_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'purchase_batches_variant_id_fkey'
  ) THEN
    ALTER TABLE "tote-bag"."purchase_batches"
    ADD CONSTRAINT "purchase_batches_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "tote-bag"."variants"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
