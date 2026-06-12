'use strict';

/**
 * Fix the one fragile coupling between Tooling Select and SDS:
 *   tooling_machine.machine_name  ⇄  sds_machine_type_code.machine_type_name
 * was a bare string match with NO FK. Renaming one side (e.g. via the SDS admin
 * cascade-rename) silently dropped the T-Select tools from that machine's SDS PDF
 * / coverage report, because tselectToolsForMachine matches on the name string.
 *
 * Mirrors the proven 2026-06-06 SDS-internal FK pattern (FK column + self-maintaining
 * trigger) and ADDS a cascade so an SDS rename keeps tooling_machine in sync:
 *
 *   1. tooling_machine.sds_machine_type_id  INT  → sds_machine_type_code(id)
 *        ON DELETE SET NULL (a deleted master leaves a visible orphan, never a bad ptr)
 *   2. backfill from the verified-clean 1:1 name map (active masters only)
 *   3. trigger tm_set_sds_machine_type_id  (BEFORE INS/UPD on tooling_machine):
 *        self-set the id from machine_name → link auto-maintained, zero app-code change.
 *        No match → id NULL = a loud orphan the parity diagnostic flags.
 *   4. trigger smtc_cascade_rename_to_tm  (AFTER UPDATE OF name/group on
 *        sds_machine_type_code): push the new name/group onto the linked
 *        tooling_machine row, so the SDS-side rename path can never silently
 *        desync the T-Select match. (T-Select internals are machine_id-based, so
 *        updating machine_name here is display/match-only and safe.)
 *
 * Run:      node db_migrations/20260612_tooling_machine_sds_fk.js
 * Rollback: node db_migrations/20260612_tooling_machine_sds_fk.js --rollback
 * Idempotent — safe to re-run.
 */

const { engPool } = require('../instance/eng_db');

const APPLY = `
BEGIN;

ALTER TABLE tooling_machine
  ADD COLUMN IF NOT EXISTS sds_machine_type_id INT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tooling_machine_sds_machine_type_id_fkey'
  ) THEN
    ALTER TABLE tooling_machine
      ADD CONSTRAINT tooling_machine_sds_machine_type_id_fkey
      FOREIGN KEY (sds_machine_type_id)
      REFERENCES sds_machine_type_code(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tooling_machine_sds_type
  ON tooling_machine(sds_machine_type_id);

-- Backfill: active master whose name equals machine_name (the representative) or,
-- failing that, machine_group. Verified 1:1 (no ambiguity) before applying.
UPDATE tooling_machine tm
SET sds_machine_type_id = s.id
FROM sds_machine_type_code s
WHERE COALESCE(s.is_active, true) = true
  AND (s.machine_type_name = tm.machine_name OR s.machine_type_name = tm.machine_group)
  AND tm.sds_machine_type_id IS DISTINCT FROM s.id;

-- (3) self-maintaining link: resolve id from machine_name on every write
CREATE OR REPLACE FUNCTION tm_set_sds_machine_type_id() RETURNS trigger AS $fn$
BEGIN
  SELECT s.id INTO NEW.sds_machine_type_id
  FROM sds_machine_type_code s
  WHERE COALESCE(s.is_active, true) = true
    AND (s.machine_type_name = NEW.machine_name OR s.machine_type_name = NEW.machine_group)
  ORDER BY s.id
  LIMIT 1;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tm_set_sds_machine_type_id ON tooling_machine;
CREATE TRIGGER trg_tm_set_sds_machine_type_id
  BEFORE INSERT OR UPDATE OF machine_name, machine_group ON tooling_machine
  FOR EACH ROW EXECUTE FUNCTION tm_set_sds_machine_type_id();

-- (4) cascade an SDS rename onto the linked tooling_machine so the match strings
-- stay equal automatically (only touches rows linked by the surrogate id).
CREATE OR REPLACE FUNCTION smtc_cascade_rename_to_tm() RETURNS trigger AS $fn$
BEGIN
  IF NEW.machine_type_name IS DISTINCT FROM OLD.machine_type_name THEN
    UPDATE tooling_machine
       SET machine_name = NEW.machine_type_name
     WHERE sds_machine_type_id = NEW.id
       AND machine_name = OLD.machine_type_name;
  END IF;
  IF NEW.machine_group IS DISTINCT FROM OLD.machine_group THEN
    UPDATE tooling_machine
       SET machine_group = NEW.machine_group
     WHERE sds_machine_type_id = NEW.id
       AND machine_group IS NOT DISTINCT FROM OLD.machine_group;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_smtc_cascade_rename_to_tm ON sds_machine_type_code;
CREATE TRIGGER trg_smtc_cascade_rename_to_tm
  AFTER UPDATE OF machine_type_name, machine_group ON sds_machine_type_code
  FOR EACH ROW EXECUTE FUNCTION smtc_cascade_rename_to_tm();

COMMIT;
`;

const ROLLBACK = `
BEGIN;
DROP TRIGGER IF EXISTS trg_smtc_cascade_rename_to_tm ON sds_machine_type_code;
DROP FUNCTION IF EXISTS smtc_cascade_rename_to_tm();
DROP TRIGGER IF EXISTS trg_tm_set_sds_machine_type_id ON tooling_machine;
DROP FUNCTION IF EXISTS tm_set_sds_machine_type_id();
ALTER TABLE tooling_machine DROP CONSTRAINT IF EXISTS tooling_machine_sds_machine_type_id_fkey;
DROP INDEX IF EXISTS idx_tooling_machine_sds_type;
ALTER TABLE tooling_machine DROP COLUMN IF EXISTS sds_machine_type_id;
COMMIT;
`;

(async () => {
  const rollback = process.argv.includes('--rollback');
  try {
    await engPool.query(rollback ? ROLLBACK : APPLY);
    if (!rollback) {
      const r = await engPool.query(`
        SELECT count(*) AS linked, count(*) FILTER (WHERE sds_machine_type_id IS NULL) AS orphan
        FROM tooling_machine WHERE enabled = true`);
      console.log(`✅ applied. enabled machines linked=${r.rows[0].linked - r.rows[0].orphan}, orphan=${r.rows[0].orphan}`);
    } else {
      console.log('✅ rolled back.');
    }
    await engPool.end();
    process.exit(0);
  } catch (e) {
    console.error('❌ migration failed:', e.message);
    process.exit(1);
  }
})();
