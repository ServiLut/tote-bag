-- AlterTable
ALTER TABLE "tote-bag"."order_status_history"
ADD COLUMN "old_status" "tote-bag"."OrderStatus",
ADD COLUMN "new_status" "tote-bag"."OrderStatus",
ADD COLUMN "user_id" TEXT;

-- Backfill current history rows so legacy records retain an explicit target status.
UPDATE "tote-bag"."order_status_history"
SET "new_status" = "status"
WHERE "new_status" IS NULL;

-- CreateTable
CREATE TABLE "tote-bag"."order_idempotency_keys" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT,
    "order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_idempotency_keys_idempotency_key_key" ON "tote-bag"."order_idempotency_keys"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "order_idempotency_keys_order_id_key" ON "tote-bag"."order_idempotency_keys"("order_id");

-- AddForeignKey
ALTER TABLE "tote-bag"."order_idempotency_keys"
ADD CONSTRAINT "order_idempotency_keys_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "tote-bag"."orders"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
