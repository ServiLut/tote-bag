CREATE SCHEMA IF NOT EXISTS "tote-bag";

DO $$
DECLARE
  legacy_type_name TEXT;
BEGIN
  FOREACH legacy_type_name IN ARRAY ARRAY[
    'OrderStatus',
    'Role',
    'ProductStatus',
    'PrintType',
    'AttributeType',
    'ProductLine',
    'PriceRuleScope'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typname = legacy_type_name
        AND n.nspname = 'public'
    ) AND NOT EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typname = legacy_type_name
        AND n.nspname = 'tote-bag'
    ) THEN
      EXECUTE format(
        'ALTER TYPE public.%I SET SCHEMA %I',
        legacy_type_name,
        'tote-bag'
      );
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  legacy_table_name TEXT;
BEGIN
  FOREACH legacy_table_name IN ARRAY ARRAY[
    'products',
    'product_images',
    'collections',
    'variants',
    'orders',
    'order_status_history',
    'order_items',
    'users',
    'profiles',
    'departments',
    'municipalities',
    'b2b_quotes',
    'audit_logs',
    'addresses',
    'product_attributes',
    'personalization_options',
    'pricing_rules',
    'b2b_quote_items',
    'personalization_rules'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = legacy_table_name
    ) AND NOT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'tote-bag'
        AND table_name = legacy_table_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I SET SCHEMA %I',
        legacy_table_name,
        'tote-bag'
      );
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'S'
      AND c.relname = 'orders_order_number_seq'
      AND n.nspname = 'public'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'S'
      AND c.relname = 'orders_order_number_seq'
      AND n.nspname = 'tote-bag'
  ) THEN
    ALTER SEQUENCE public."orders_order_number_seq" SET SCHEMA "tote-bag";
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'BatchStatus'
      AND n.nspname = 'tote-bag'
  ) THEN
    CREATE TYPE "tote-bag"."BatchStatus" AS ENUM (
      'PENDING',
      'IN_STOCK',
      'DEPLETED',
      'CANCELLED'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'TransactionType'
      AND n.nspname = 'tote-bag'
  ) THEN
    CREATE TYPE "tote-bag"."TransactionType" AS ENUM ('INCOME', 'EXPENSE');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'TransactionCategory'
      AND n.nspname = 'tote-bag'
  ) THEN
    CREATE TYPE "tote-bag"."TransactionCategory" AS ENUM (
      'SALE',
      'PURCHASE',
      'OPEX',
      'PAYROLL'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'TransactionStatus'
      AND n.nspname = 'tote-bag'
  ) THEN
    CREATE TYPE "tote-bag"."TransactionStatus" AS ENUM (
      'PENDING',
      'COMPLETED',
      'CANCELLED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "tote-bag"."suppliers" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nit" TEXT NOT NULL,
  "contact" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_nit_key"
ON "tote-bag"."suppliers"("nit");

ALTER TABLE "tote-bag"."suppliers"
ADD COLUMN IF NOT EXISTS "contact" TEXT,
ADD COLUMN IF NOT EXISTS "email" TEXT,
ADD COLUMN IF NOT EXISTS "phone" TEXT,
ADD COLUMN IF NOT EXISTS "address" TEXT,
ADD COLUMN IF NOT EXISTS "balance" DECIMAL(18,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "tote-bag"."purchase_batches" (
  "id" TEXT NOT NULL,
  "product_id" TEXT,
  "variant_id" TEXT,
  "supplier_id" TEXT NOT NULL,
  "quantity_received" INTEGER NOT NULL,
  "quantity_remaining" INTEGER NOT NULL,
  "unit_cost" DECIMAL(18,2) NOT NULL,
  "total_cost" DECIMAL(18,2) NOT NULL,
  "status" "tote-bag"."BatchStatus" NOT NULL DEFAULT 'IN_STOCK',
  "payment_receipt_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "purchase_batches_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "tote-bag"."purchase_batches"
ADD COLUMN IF NOT EXISTS "product_id" TEXT,
ADD COLUMN IF NOT EXISTS "variant_id" TEXT,
ADD COLUMN IF NOT EXISTS "supplier_id" TEXT,
ADD COLUMN IF NOT EXISTS "quantity_received" INTEGER,
ADD COLUMN IF NOT EXISTS "quantity_remaining" INTEGER,
ADD COLUMN IF NOT EXISTS "unit_cost" DECIMAL(18,2),
ADD COLUMN IF NOT EXISTS "total_cost" DECIMAL(18,2),
ADD COLUMN IF NOT EXISTS "status" "tote-bag"."BatchStatus" DEFAULT 'IN_STOCK',
ADD COLUMN IF NOT EXISTS "payment_receipt_url" TEXT,
ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'purchase_batches_product_id_fkey'
  ) THEN
    ALTER TABLE "tote-bag"."purchase_batches"
    ADD CONSTRAINT "purchase_batches_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "tote-bag"."products"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'purchase_batches_supplier_id_fkey'
  ) THEN
    ALTER TABLE "tote-bag"."purchase_batches"
    ADD CONSTRAINT "purchase_batches_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "tote-bag"."suppliers"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'purchase_batches_variant_id_fkey'
  ) THEN
    ALTER TABLE "tote-bag"."purchase_batches"
    ADD CONSTRAINT "purchase_batches_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "tote-bag"."variants"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "tote-bag"."opex_categories" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "opex_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "opex_categories_name_key"
ON "tote-bag"."opex_categories"("name");

ALTER TABLE "tote-bag"."opex_categories"
ADD COLUMN IF NOT EXISTS "description" TEXT,
ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "tote-bag"."financial_transactions" (
  "id" TEXT NOT NULL,
  "type" "tote-bag"."TransactionType" NOT NULL,
  "category" "tote-bag"."TransactionCategory" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "description" TEXT NOT NULL,
  "status" "tote-bag"."TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
  "user_id" TEXT NOT NULL,
  "purchase_batch_id" TEXT,
  "opex_category_id" TEXT,
  "supplier_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "tote-bag"."financial_transactions"
ADD COLUMN IF NOT EXISTS "status" "tote-bag"."TransactionStatus" DEFAULT 'COMPLETED',
ADD COLUMN IF NOT EXISTS "purchase_batch_id" TEXT,
ADD COLUMN IF NOT EXISTS "opex_category_id" TEXT,
ADD COLUMN IF NOT EXISTS "supplier_id" TEXT,
ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'financial_transactions_user_id_fkey'
  ) THEN
    ALTER TABLE "tote-bag"."financial_transactions"
    ADD CONSTRAINT "financial_transactions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "tote-bag"."users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'financial_transactions_purchase_batch_id_fkey'
  ) THEN
    ALTER TABLE "tote-bag"."financial_transactions"
    ADD CONSTRAINT "financial_transactions_purchase_batch_id_fkey"
    FOREIGN KEY ("purchase_batch_id") REFERENCES "tote-bag"."purchase_batches"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'financial_transactions_opex_category_id_fkey'
  ) THEN
    ALTER TABLE "tote-bag"."financial_transactions"
    ADD CONSTRAINT "financial_transactions_opex_category_id_fkey"
    FOREIGN KEY ("opex_category_id") REFERENCES "tote-bag"."opex_categories"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'financial_transactions_supplier_id_fkey'
  ) THEN
    ALTER TABLE "tote-bag"."financial_transactions"
    ADD CONSTRAINT "financial_transactions_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "tote-bag"."suppliers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
