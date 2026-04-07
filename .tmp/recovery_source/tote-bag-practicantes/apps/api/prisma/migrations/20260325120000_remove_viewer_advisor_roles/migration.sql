UPDATE "tote-bag"."users"
SET "role" = 'MANAGER'
WHERE "role" IN ('VIEWER', 'ADVISOR');

CREATE TYPE "tote-bag"."Role_new" AS ENUM ('ADMIN', 'MANAGER', 'CUSTOMER');

ALTER TABLE "tote-bag"."users"
ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "tote-bag"."users"
ALTER COLUMN "role" TYPE "tote-bag"."Role_new"
USING ("role"::text::"tote-bag"."Role_new");

ALTER TYPE "tote-bag"."Role" RENAME TO "Role_old";
ALTER TYPE "tote-bag"."Role_new" RENAME TO "Role";
DROP TYPE "tote-bag"."Role_old";

ALTER TABLE "tote-bag"."users"
ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';
