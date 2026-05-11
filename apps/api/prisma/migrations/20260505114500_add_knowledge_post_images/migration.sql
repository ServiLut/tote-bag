ALTER TABLE "tote-bag"."knowledge_posts"
ADD COLUMN IF NOT EXISTS "image_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
