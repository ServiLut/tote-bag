-- CreateEnum
CREATE TYPE "tote-bag"."WebhookProcessingStatus" AS ENUM ('RECEIVED', 'VALIDATED', 'APPLIED', 'FAILED');

-- AlterTable
ALTER TABLE "tote-bag"."webhook_events"
ADD COLUMN "status" "tote-bag"."WebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "signature_checksum" TEXT,
ADD COLUMN "transaction_id" TEXT,
ADD COLUMN "reference_id" TEXT,
ADD COLUMN "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "validated_at" TIMESTAMP(3),
ADD COLUMN "applied_at" TIMESTAMP(3),
ADD COLUMN "failed_at" TIMESTAMP(3);

-- Backfill
UPDATE "tote-bag"."webhook_events"
SET
    "status" = CASE
        WHEN "processed" = true AND ("error" IS NULL OR length(trim("error")) = 0) THEN 'APPLIED'::"tote-bag"."WebhookProcessingStatus"
        WHEN "error" IS NOT NULL AND length(trim("error")) > 0 THEN 'FAILED'::"tote-bag"."WebhookProcessingStatus"
        ELSE 'RECEIVED'::"tote-bag"."WebhookProcessingStatus"
    END,
    "received_at" = COALESCE("created_at", CURRENT_TIMESTAMP),
    "validated_at" = CASE
        WHEN "processed" = true OR ("error" IS NOT NULL AND length(trim("error")) > 0)
            THEN COALESCE("processed_at", "created_at", CURRENT_TIMESTAMP)
        ELSE NULL
    END,
    "applied_at" = CASE
        WHEN "processed" = true AND ("error" IS NULL OR length(trim("error")) = 0)
            THEN COALESCE("processed_at", "created_at", CURRENT_TIMESTAMP)
        ELSE NULL
    END,
    "failed_at" = CASE
        WHEN "error" IS NOT NULL AND length(trim("error")) > 0
            THEN COALESCE("processed_at", "created_at", CURRENT_TIMESTAMP)
        ELSE NULL
    END,
    "attempts" = CASE
        WHEN "processed" = true OR ("error" IS NOT NULL AND length(trim("error")) > 0) THEN 1
        ELSE 0
    END;
