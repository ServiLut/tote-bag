-- Enforce inventory movement append-only semantics at the database layer.

CREATE OR REPLACE FUNCTION "tote-bag"."prevent_inventory_movement_mutation"()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'inventory_movements is immutable; register a counter-movement instead';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "inventory_movements_prevent_update" ON "tote-bag"."inventory_movements";
CREATE TRIGGER "inventory_movements_prevent_update"
BEFORE UPDATE ON "tote-bag"."inventory_movements"
FOR EACH ROW
EXECUTE FUNCTION "tote-bag"."prevent_inventory_movement_mutation"();

DROP TRIGGER IF EXISTS "inventory_movements_prevent_delete" ON "tote-bag"."inventory_movements";
CREATE TRIGGER "inventory_movements_prevent_delete"
BEFORE DELETE ON "tote-bag"."inventory_movements"
FOR EACH ROW
EXECUTE FUNCTION "tote-bag"."prevent_inventory_movement_mutation"();
