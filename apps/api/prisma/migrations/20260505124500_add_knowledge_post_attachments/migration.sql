ALTER TABLE "tote-bag"."knowledge_posts"
ADD COLUMN IF NOT EXISTS "attachments" JSONB;
