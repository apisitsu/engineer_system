'use strict';
/**
 * Fix HI-GRIND-1-D floor-machine name resolution for CGM-13 / CGM-14.
 *
 * Same physical machine carried THREE names, breaking type-code + SDS-config linkage:
 *   - rodpc.m_machine (factory base):        'HIGRIND-1-D'   (no hyphen) — CGM-13/CGM-14/SPG-08
 *   - Aras master + sds_machine_type_code:   'HI-GRIND-1-D'  (canonical; code 507 active; holds SDS tool config)
 *   - sds_machine_code override (CGM-14):    'NISSIN_HIGRIND-1-D'  (wrong — no hyphen, NISSIN_ prefix)
 *
 * Because buildMachineResolver.typeCodeOf() derives the type code via
 * codeByName[nameOf(machine_code)], CGM-14 ('NISSIN_HIGRIND-1-D') and CGM-13
 * (falls back to factory 'HIGRIND-1-D') both fail to match the dictionary name
 * 'HI-GRIND-1-D' → resolve to NO type code and miss the HI-GRIND-1-D SDS config.
 * CGM-13/CGM-14 are in SDS coverage scope (only SPG-08 is excluded as retired).
 *
 * Fix: give both floor codes an sds_machine_code override machine_name =
 * 'HI-GRIND-1-D' (canonical). machine_type_code stays NULL so typeCodeOf derives
 * the active code (507) from the dictionary — no hardcoded code to drift.
 *
 * Idempotent (ON CONFLICT (machine_code) DO UPDATE). Flushes coverage/T-Select cache.
 * Run: node db_migrations/20260709_fix_higrind_cgm_machine_name.js
 */
const { engPool } = require('../instance/eng_db');

const CANON = 'HI-GRIND-1-D';
const CODES = ['CGM-13', 'CGM-14'];
const REMARK = 'HIGRIND-1-D floor unit → canonical HI-GRIND-1-D (derives type code 507). ' +
               'Factory m_model lacks hyphen; prior CGM-14 override was NISSIN_HIGRIND-1-D. 2026-07-09';

(async () => {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    // Sanity: the canonical name must exist & be active in the dictionary (else nothing to derive).
    const dict = await client.query(
      `SELECT machine_type_code FROM sds_machine_type_code
        WHERE machine_type_name = $1 AND is_active`, [CANON]);
    if (!dict.rows.length) throw new Error(`No active sds_machine_type_code for "${CANON}"`);
    console.log(`Dictionary active code for ${CANON}: ${dict.rows.map(r => r.machine_type_code).join(', ')}`);

    const before = await client.query(
      `SELECT machine_code, machine_name, machine_type_code FROM sds_machine_code
        WHERE machine_code = ANY($1) ORDER BY 1`, [CODES]);
    console.log('BEFORE:'); console.table(before.rows.length ? before.rows : [{ note: 'none present' }]);

    for (const code of CODES) {
      await client.query(
        `INSERT INTO sds_machine_code (machine_code, machine_name, machine_type_code, remark)
         VALUES ($1, $2, NULL, $3)
         ON CONFLICT (machine_code) DO UPDATE
           SET machine_name = EXCLUDED.machine_name,
               remark       = EXCLUDED.remark,
               updated_at   = now()`,
        [code, CANON, REMARK]);
    }

    await client.query('COMMIT');

    for (const t of ['sds_coverage_cache', 'tselect_cn_cache', 'sds_cache']) {
      try {
        const { rows } = await engPool.query(`SELECT to_regclass($1) AS t`, [t]);
        if (rows[0].t) { await engPool.query(`DELETE FROM ${t}`); console.log(`flushed ${t}`); }
      } catch (e) { console.log(`(skip flush ${t}: ${e.message})`); }
    }

    const after = await engPool.query(
      `SELECT machine_code, machine_name, machine_type_code FROM sds_machine_code
        WHERE machine_code = ANY($1) ORDER BY 1`, [CODES]);
    console.log('\nAFTER:'); console.table(after.rows);
    console.log('\nDone. CGM-13 / CGM-14 now resolve to HI-GRIND-1-D → derive code 507 + its SDS config.');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration failed, rolled back:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await engPool.end();
  }
})();
