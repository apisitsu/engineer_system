-- Migration: Add inventory_table_override to tooling_search_rule
-- Allows individual tooling types on a machine to search a different
-- inventory table than the machine's default inventory_table.
-- Use case: KS-400B1/B2/B7 PILOT PIN inventory lives in tooling_ks400b6.

ALTER TABLE tooling_search_rule
  ADD COLUMN IF NOT EXISTS inventory_table_override VARCHAR(100);

-- Point PILOT PIN search rules for KS-400B1/B2/B7 to tooling_ks400b6
UPDATE tooling_search_rule
   SET inventory_table_override = 'tooling_ks400b6'
 WHERE machine_id IN (
   SELECT id FROM tooling_machine
    WHERE machine_name IN ('KS-400B1', 'KS-400B2', 'KS-400B7')
 )
   AND tooling_name = 'PILOT PIN';
