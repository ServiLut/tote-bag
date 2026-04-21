DO $$
BEGIN
    CREATE TYPE "tote-bag"."WebhookProcessingStatus" AS ENUM ('RECEIVED', 'VALIDATED', 'APPLIED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "tote-bag"."webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processed_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "webhook_events_event_id_key"
ON "tote-bag"."webhook_events"("event_id");

CREATE UNIQUE INDEX IF NOT EXISTS "webhook_events_provider_event_id_key"
ON "tote-bag"."webhook_events"("provider", "event_id");

-- AlterTable
ALTER TABLE "tote-bag"."webhook_events"
ADD COLUMN IF NOT EXISTS "status" "tote-bag"."WebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "signature_checksum" TEXT,
ADD COLUMN IF NOT EXISTS "transaction_id" TEXT,
ADD COLUMN IF NOT EXISTS "reference_id" TEXT,
ADD COLUMN IF NOT EXISTS "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "validated_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "applied_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "failed_at" TIMESTAMP(3);

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
