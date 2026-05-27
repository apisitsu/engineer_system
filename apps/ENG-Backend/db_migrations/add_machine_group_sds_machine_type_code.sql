-- Migration: Add machine_group to sds_machine_type_code
-- Mirrors the machine_group concept from tooling_machine.
-- Grouped machines share the same template/parameter structure;
-- search deduplication returns one representative per group.

ALTER TABLE sds_machine_type_code ADD COLUMN IF NOT EXISTS machine_group VARCHAR(100);

UPDATE sds_machine_type_code
   SET machine_group = 'KS-400B1/B2/B7'
 WHERE machine_type_name IN ('KS-400B1', 'KS-400B2', 'KS-400B7');
