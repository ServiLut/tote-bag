-- Create the new enum type
CREATE TYPE "tote-bag"."Role_new" AS ENUM ('ADMIN', 'MANAGER', 'CUSTOMER');

-- Update the column type and map values in a single step
ALTER TABLE "tote-bag"."users"
ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "tote-bag"."users"
ALTER COLUMN "role" TYPE "tote-bag"."Role_new"
USING (
  CASE
    WHEN "role"::text IN ('VIEWER', 'ADVISOR') THEN 'MANAGER'::"tote-bag"."Role_new"
    ELSE "role"::text::"tote-bag"."Role_new"
  END
);

-- Swap the types
ALTER TYPE "tote-bag"."Role" RENAME TO "Role_old";
ALTER TYPE "tote-bag"."Role_new" RENAME TO "Role";
DROP TYPE "tote-bag"."Role_old";

-- Set the default value on the new type
ALTER TABLE "tote-bag"."users"
ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';
