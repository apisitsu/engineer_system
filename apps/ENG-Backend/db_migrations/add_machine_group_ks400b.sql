-- Add machine_group column to tooling_machine for grouping identical machines in UI
ALTER TABLE tooling_machine ADD COLUMN IF NOT EXISTS machine_group VARCHAR(100);

UPDATE tooling_machine
   SET machine_group = 'KS-400B1/B2/B7'
 WHERE machine_name IN ('KS-400B1', 'KS-400B2', 'KS-400B7');
