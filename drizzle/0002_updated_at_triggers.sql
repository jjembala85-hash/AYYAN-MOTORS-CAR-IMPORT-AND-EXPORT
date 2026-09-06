-- Keep `updated_at` honest.
--
-- Every table below defaults the column to now() on INSERT, but a default does
-- nothing on UPDATE — until now the timestamps were frozen at import time. That
-- was harmless while the catalogue was read-only. The admin panel writes, so
-- without this a listing edited today still reports the seed date, and "sort by
-- recently updated" in the panel would be meaningless.
--
-- Hand-written rather than generated: drizzle-kit models tables, not triggers.

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  -- `IS DISTINCT FROM` so a no-op UPDATE (the form submitted unchanged) does not
  -- bump the timestamp, and so an explicit updated_at in the statement wins —
  -- which is what a data backfill needs.
  IF NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER makes_set_updated_at BEFORE UPDATE ON makes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

CREATE TRIGGER models_set_updated_at BEFORE UPDATE ON models
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

CREATE TRIGGER vehicles_set_updated_at BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

CREATE TRIGGER vehicle_engines_set_updated_at BEFORE UPDATE ON vehicle_engines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

CREATE TRIGGER admin_users_set_updated_at BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
