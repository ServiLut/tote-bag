DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'KnowledgeCategory'
      AND n.nspname = 'tote-bag'
  ) THEN
    CREATE TYPE "tote-bag"."KnowledgeCategory" AS ENUM (
      'GENERAL',
      'VENTAS',
      'NOTICIAS',
      'OPERACION',
      'FINANZAS',
      'ESTRATEGIA'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'KnowledgeStatus'
      AND n.nspname = 'tote-bag'
  ) THEN
    CREATE TYPE "tote-bag"."KnowledgeStatus" AS ENUM (
      'BORRADOR',
      'PUBLICADO',
      'ARCHIVADO'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'KnowledgePriority'
      AND n.nspname = 'tote-bag'
  ) THEN
    CREATE TYPE "tote-bag"."KnowledgePriority" AS ENUM (
      'BAJA',
      'MEDIA',
      'ALTA',
      'CRITICA'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "tote-bag"."knowledge_posts" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "summary" TEXT,
  "content" TEXT NOT NULL,
  "category" "tote-bag"."KnowledgeCategory" NOT NULL DEFAULT 'GENERAL',
  "status" "tote-bag"."KnowledgeStatus" NOT NULL DEFAULT 'BORRADOR',
  "priority" "tote-bag"."KnowledgePriority" NOT NULL DEFAULT 'MEDIA',
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "author_id" TEXT,
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "knowledge_posts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_posts_slug_key"
ON "tote-bag"."knowledge_posts"("slug");

CREATE INDEX IF NOT EXISTS "knowledge_posts_category_status_idx"
ON "tote-bag"."knowledge_posts"("category", "status");

CREATE INDEX IF NOT EXISTS "knowledge_posts_priority_updated_at_idx"
ON "tote-bag"."knowledge_posts"("priority", "updated_at");

CREATE INDEX IF NOT EXISTS "knowledge_posts_author_id_idx"
ON "tote-bag"."knowledge_posts"("author_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'knowledge_posts_author_id_fkey'
  ) THEN
    ALTER TABLE "tote-bag"."knowledge_posts"
    ADD CONSTRAINT "knowledge_posts_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "tote-bag"."users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
