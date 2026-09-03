'use strict';
/**
 * Seed Machine Tool Config (sds_machine_tool) for KS-400B2 and KS-400B7 from the
 * KS-400B1 baseline — i.e. SPLIT the previously-shared tool whitelist per machine.
 *
 * Background: KS-400B1, KS-400B2 and KS-400B7 share machine_group 'KS-400B1/B2/B7'.
 * Until now only the Excel Parameter + Grinding Wheel config (sds_parameter) was
 * split per machine; the Machine Tool Config (sds_machine_tool, the ordered T01–Tn
 * fixture whitelist per process_code) lived ONLY on the representative KS-400B1 and
 * was reused group-wide by buildValueMap. The engineer now wants each physical
 * grinder to own its tool list so B2 / B7 can differ from B1.
 *
 * This migration copies KS-400B1's sds_machine_tool rows (all process_codes) to
 * B2 and B7 as a BASELINE. Paired code change: buildValueMap now looks up tools by
 * the EXACT machine first and only falls back to the group when a machine has none
 * — so once these rows exist, each machine's PDF uses its own list.
 *
 * NON-DESTRUCTIVE + idempotent: a target machine is seeded only if it currently has
 * zero sds_machine_tool rows. Re-running after the engineer differentiates B2 / B7
 * SKIPS them, so edits are never clobbered.
 *
 * machine_type_id is set explicitly from sds_machine_type_code (also restored by the
 * BEFORE INSERT trigger; setting it is belt-and-braces).
 *
 * Run: node api/engineer/mtc/db_migrations/20260709_seed_ks400b2_b7_machine_tool.js
 */
const { engPool } = require('../../../../instance/eng_db');

const SOURCE = 'KS-400B1';
const TARGETS = ['KS-400B2', 'KS-400B7'];

(async () => {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

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

      const { rows: [{ count }] } = await client.query(
        `SELECT COUNT(*)::int AS count FROM sds_machine_tool WHERE machine_type = $1`,
        [target]
      );
      if (count > 0) {
        console.log(`SKIP sds_machine_tool for ${target} — already has ${count} row(s) (not overwriting).`);
        continue;
      }

      const r = await client.query(
        `INSERT INTO sds_machine_tool (tool_number, process_code, machine_type, tool_drawing_no, machine_type_id)
         SELECT tool_number, process_code, $1, tool_drawing_no, $2
         FROM sds_machine_tool
         WHERE machine_type = $3
         ORDER BY process_code, LPAD(SUBSTRING(tool_number FROM 2), 5, '0')`,
        [target, targetId, SOURCE]
      );
      console.log(`SEEDED ${r.rowCount} sds_machine_tool rows for ${target} (copied from ${SOURCE}).`);
    }

    await client.query('COMMIT');
    console.log('\nDone. Machine Tool Config is now split per machine. Next: edit KS-400B2 / KS-400B7 in SDS Admin -> "Machine Tool Config" so each machine\'s tool list differs from KS-400B1 where needed.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed, rolled back:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await engPool.end();
  }
})();
