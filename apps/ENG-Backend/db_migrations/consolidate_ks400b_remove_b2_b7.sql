-- Migration: Consolidate KS-400B group — remove KS-400B2 and KS-400B7 rows
-- Rationale: KS-400B1/B2/B7 share identical formulas, limits, and inventory table
--            (tooling_ks400b, no machine filter). Search deduplication already uses
--            only the first representative (KS-400B1) when machine_group is set.
--            KS-400B2 and KS-400B7 rows are unused — consolidate to KS-400B1 only.
-- KS-400B1 retains machine_group = 'KS-400B1/B2/B7' for display.

BEGIN;

DELETE FROM tooling_search_rule
 WHERE machine_id IN (
   SELECT id FROM tooling_machine WHERE machine_name IN ('KS-400B2', 'KS-400B7')
 );

DELETE FROM tooling_formula
 WHERE machine_id IN (
   SELECT id FROM tooling_machine WHERE machine_name IN ('KS-400B2', 'KS-400B7')
 );

DELETE FROM tooling_machine_limit
 WHERE machine_id IN (
   SELECT id FROM tooling_machine WHERE machine_name IN ('KS-400B2', 'KS-400B7')
 );

DELETE FROM tooling_machine
 WHERE machine_name IN ('KS-400B2', 'KS-400B7');

COMMIT;
