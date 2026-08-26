/**
 * Migration: per-process-code SDS parameter overrides.
 *
 * Until now sds_parameter was keyed by (cn, machine_type_name, param_key) only — so a CN
 * that a machine grinds under BOTH process 1021 (FACE GRIND) and 1022 (FACE GRIND #2) could
 * not carry different condition-grid values per process: every process PDF pulled the same
 * override set.
 *
 * This adds a nullable `process_code` dimension used ONLY by CN overrides (machine-default
 * rows stay process-agnostic — they always keep process_code NULL):
 *
 *   process_code IS NULL  → applies to ALL process codes (the current behaviour — every
 *                           existing row keeps working unchanged).
 *   process_code = '1022' → CN override that applies to that specific process only.
 *
 * Read precedence (see sdsV2HeadlessController.buildValueMap):
 *   CN + process  >  CN (any process)  >  machine default
 *
 * The unique index `uq_sds_parameter` is rebuilt to include COALESCE(process_code,'__all__')
 * so the ON CONFLICT upsert targets one row per (cn, machine, param, process). Existing rows
 * all fold to '__all__', so the uniqueness set is unchanged (no duplicate risk on rebuild).
 */
const { engPool } = require('../../../../instance/eng_db');

async function migrate() {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE sds_parameter
        ADD COLUMN IF NOT EXISTS process_code VARCHAR
    `);

    // Rebuild the uniqueness key to include the process dimension. NULL folds to '__all__'
    // (matching the NULL→'__machine_config__' fold already used for cn), so the ON CONFLICT
    // expression stays a single deterministic slot per (cn, machine, param, process).
    await client.query(`DROP INDEX IF EXISTS uq_sds_parameter`);
    await client.query(`
      CREATE UNIQUE INDEX uq_sds_parameter ON sds_parameter (
        COALESCE(cn, '__machine_config__'::character varying),
        machine_type_name,
        param_key,
        COALESCE(process_code, '__all__'::character varying)
      )
    `);

    await client.query('COMMIT');
    console.log('[migration] sds_parameter.process_code added; uq_sds_parameter rebuilt with process dimension');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

migrate().catch(e => { console.error(e); process.exit(1); });
