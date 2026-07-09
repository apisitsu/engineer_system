'use strict';
/**
 * Fix GS-64PFII machine_type_code: 762 -> 040 (align with Aras master Org_MachineModel_RD).
 *
 * Background: EngineerSystem had GS-64PFII on machine_type_code '762', an EMPTY slot in the
 * Aras master (Org_MachineModel_RD) — Aras' real GS-64PFII is code '040'. machine_type_code
 * is NOT a functional join key here (FKs use sds_machine_type_code.id + machine_type_name;
 * factory matching uses floor code + name; m_setup_datasheet has no type-code column), so the
 * only rows that must move together are the dictionary row and its 2 sds_machine_code overrides.
 *
 * Changes (both filtered by name so nothing else on 762 is touched — there is nothing else):
 *   - sds_machine_type_code: machine_type_code 762 -> 040 for GS-64PFII (id 298)
 *   - sds_machine_code:      machine_type_code 762 -> 040 for SGM-02 / SGM-03 (GS-64PFII overrides)
 *
 * Safety: aborts if '040' is already assigned to a DIFFERENT machine in the dictionary.
 * Idempotent: re-run finds no 762 rows and changes nothing. Best-effort cache flush after
 * (direct DB edit bypasses the flushSds middleware).
 *
 * Run: node db_migrations/20260709_fix_gs64pfii_type_code_040.js
 */
const { engPool } = require('../instance/eng_db');

const OLD = '762', NEW = '040', NAME = 'GS-64PFII';

(async () => {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    // Guard: NEW code must not already belong to a different machine.
    const clash = await client.query(
      `SELECT id, machine_type_name FROM sds_machine_type_code
       WHERE machine_type_code = $1 AND machine_type_name <> $2`,
      [NEW, NAME]
    );
    if (clash.rows.length) {
      throw new Error(`Abort: code ${NEW} already used by ${clash.rows.map(r => r.machine_type_name).join(', ')}`);
    }

    const before = await client.query(
      `SELECT 'dict' src, id::text ref, machine_type_code code, machine_type_name name
         FROM sds_machine_type_code WHERE machine_type_name = $1
       UNION ALL
       SELECT 'mcode', machine_code, machine_type_code, machine_name
         FROM sds_machine_code WHERE machine_name = $1
       ORDER BY 1,2`, [NAME]);
    console.log('BEFORE:'); console.table(before.rows);

    const d = await client.query(
      `UPDATE sds_machine_type_code SET machine_type_code = $1
        WHERE machine_type_code = $2 AND machine_type_name = $3`,
      [NEW, OLD, NAME]);
    const m = await client.query(
      `UPDATE sds_machine_code SET machine_type_code = $1
        WHERE machine_type_code = $2 AND machine_name = $3`,
      [NEW, OLD, NAME]);
    console.log(`\nUpdated: sds_machine_type_code=${d.rowCount} row(s), sds_machine_code=${m.rowCount} row(s).`);

    await client.query('COMMIT');

    // Best-effort cache flush (tables may not exist — guard with to_regclass).
    for (const t of ['sds_coverage_cache', 'tselect_cn_cache', 'sds_cache']) {
      try {
        const { rows } = await engPool.query(`SELECT to_regclass($1) AS t`, [t]);
        if (rows[0].t) { await engPool.query(`DELETE FROM ${t}`); console.log(`flushed ${t}`); }
      } catch (e) { console.log(`(skip flush ${t}: ${e.message})`); }
    }

    const after = await engPool.query(
      `SELECT 'dict' src, id::text ref, machine_type_code code, machine_type_name name
         FROM sds_machine_type_code WHERE machine_type_name = $1
       UNION ALL
       SELECT 'mcode', machine_code, machine_type_code, machine_name
         FROM sds_machine_code WHERE machine_name = $1
       ORDER BY 1,2`, [NAME]);
    console.log('\nAFTER:'); console.table(after.rows);
    console.log('\nDone.');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration failed, rolled back:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await engPool.end();
  }
})();
