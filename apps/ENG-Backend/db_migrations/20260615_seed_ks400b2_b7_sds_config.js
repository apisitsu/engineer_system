'use strict';
/**
 * Seed SDS Excel Parameter Config + Excel Grinding Wheel Config for KS-400B2 and
 * KS-400B7 from the KS-400B1 baseline.
 *
 * Why: KS-400B1, KS-400B2 and KS-400B7 share the machine_group 'KS-400B1/B2/B7'
 * (same tooling / same T-Select calc_context), but they are three SEPARATE
 * physical grinders whose SDS setup sheet differs per machine — i.e. the
 * "Excel Parameter Config" (sds_parameter, cn IS NULL, section A:I) and the
 * "Excel Grinding Wheel Config" (gw_row_* keys, same table) must be configured
 * DIFFERENTLY for each. This is already a supported pattern (TSG-300W and
 * TSG-300ZNC each hold their own sds_parameter rows within one group).
 *
 * Problem: only KS-400B1 had machine-level sds_parameter rows (58, incl. 8 gw_).
 * KS-400B2 / KS-400B7 had ZERO, so buildValueMap (PDF) — which keys sds_parameter
 * by exact machine_type_name — would render an empty Excel Parameter / Grinding
 * Wheel section for them.
 *
 * Scope: ONLY the Excel Parameter Config + Excel Grinding Wheel Config
 * (sds_parameter, cn IS NULL). The Machine Tool Config (sds_machine_tool) is
 * shared at the KS-400B1 representative and is intentionally NOT duplicated here.
 *
 * Fix (data only — buildValueMap / admin already key by exact machine_type_name):
 * copy KS-400B1's machine-level sds_parameter rows to B2 and B7 as a BASELINE.
 * The engineer then edits B2 / B7 in SDS Admin -> "Excel Config" so each physical
 * machine's parameters & grinding wheel differ from KS-400B1.
 *
 * NON-DESTRUCTIVE + idempotent: a target machine is seeded only if it currently
 * has zero machine-level rows. Re-running after the engineer has differentiated
 * B2 / B7 will SKIP them, so their edits are never clobbered.
 *
 * machine_type_id is set explicitly from sds_machine_type_code (also restored by
 * the BEFORE INSERT trigger; setting it is belt-and-braces).
 *
 * Run: node db_migrations/20260615_seed_ks400b2_b7_sds_config.js
 */
const { engPool } = require('../instance/eng_db');

const SOURCE = 'KS-400B1';
const TARGETS = ['KS-400B2', 'KS-400B7'];

(async () => {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    // Resolve machine_type_id for source + targets (must all exist).
    const { rows: mts } = await client.query(
      `SELECT id, machine_type_name FROM sds_machine_type_code
       WHERE machine_type_name = ANY($1)`,
      [[SOURCE, ...TARGETS]]
    );
    const idByName = Object.fromEntries(mts.map(r => [r.machine_type_name, r.id]));
    for (const name of [SOURCE, ...TARGETS]) {
      if (!idByName[name]) throw new Error(`sds_machine_type_code has no row for ${name}`);
    }

    for (const target of TARGETS) {
      const targetId = idByName[target];

      // ── Excel Parameter + Grinding Wheel config (sds_parameter, cn IS NULL) ──
      const { rows: [{ count: paramCount }] } = await client.query(
        `SELECT COUNT(*)::int AS count FROM sds_parameter
         WHERE machine_type_name = $1 AND cn IS NULL`,
        [target]
      );
      if (paramCount > 0) {
        console.log(`SKIP sds_parameter for ${target} — already has ${paramCount} machine-level rows (not overwriting).`);
        continue;
      }
      const r = await client.query(
        `INSERT INTO sds_parameter (cn, machine_type_name, param_key, param_value, machine_type_id, created_by, updated_by)
         SELECT NULL, $1, param_key, param_value, $2, 'seed:20260615', 'seed:20260615'
         FROM sds_parameter
         WHERE machine_type_name = $3 AND cn IS NULL`,
        [target, targetId, SOURCE]
      );
      console.log(`SEEDED ${r.rowCount} sds_parameter rows for ${target} (Excel Parameter + Grinding Wheel config, copied from ${SOURCE}).`);
    }

    await client.query('COMMIT');
    console.log('\nDone. Next: edit KS-400B2 / KS-400B7 in SDS Admin -> "Excel Config" so each machine\'s Excel Parameter & Grinding Wheel config differs from KS-400B1.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed, rolled back:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await engPool.end();
  }
})();
