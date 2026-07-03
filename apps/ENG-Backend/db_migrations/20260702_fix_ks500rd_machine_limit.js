/**
 * Fix KS-500RD (machine id 14) eligibility limits.
 *
 * The live `tooling_machine_limit` held the loose seed value `OD 24–62` with NO
 * ID limit. The authoritative work envelope — stated on the source workbook
 * `IDE製作中_20180828_TOOLING LIST_KS-500RD(SPHERICAL GRIND).xlsx` DIMENSION
 * sheet A2–A4 (対応ワークサイズ) and documented in
 * `.claude/rules/formula-reference.md` — is:
 *     I.D  φ14 – 38.125
 *     O.D  φ26 – 59.531
 *
 * (The WORK sheet has stray OD→64 / ID→3 rows = unrelated legacy KS-400B data
 * per the md note, NOT the envelope.)
 *
 * This replaces the KS-500RD limit rows with OD 26–59.531 + ID 14–38.125.
 * Idempotent (delete + reinsert by machine_id).
 *
 * Run: node db_migrations/20260702_fix_ks500rd_machine_limit.js
 */
'use strict';

const { engPool } = require('../instance/eng_db');

const MACHINE_NAME = 'KS-500RD';
const LIMITS = [
  { input_var: 'ID', min_value: 14,  max_value: 38.125, min_inclusive: true, max_inclusive: true },
  { input_var: 'OD', min_value: 26,  max_value: 59.531, min_inclusive: true, max_inclusive: true },
];

async function run() {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    const m = await client.query(
      `SELECT id FROM tooling_machine WHERE machine_name = $1`, [MACHINE_NAME]);
    if (!m.rows.length) throw new Error(`machine ${MACHINE_NAME} not found`);
    const machineId = m.rows[0].id;

    const before = await client.query(
      `SELECT input_var, min_value, max_value FROM tooling_machine_limit
        WHERE machine_id = $1 ORDER BY sort_order`, [machineId]);
    console.log(`KS-500RD id=${machineId} — before:`,
      before.rows.map(r => `${r.input_var}[${r.min_value ?? '-'}..${r.max_value ?? '-'}]`).join(' ') || '(none)');

    await client.query(`DELETE FROM tooling_machine_limit WHERE machine_id = $1`, [machineId]);
    let so = 0;
    for (const l of LIMITS) {
      await client.query(
        `INSERT INTO tooling_machine_limit
           (machine_id, input_var, min_value, max_value, min_inclusive, max_inclusive, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [machineId, l.input_var, l.min_value, l.max_value, l.min_inclusive, l.max_inclusive, so++]
      );
    }

    const after = await client.query(
      `SELECT input_var, min_value, max_value FROM tooling_machine_limit
        WHERE machine_id = $1 ORDER BY sort_order`, [machineId]);
    console.log(`KS-500RD id=${machineId} — after: `,
      after.rows.map(r => `${r.input_var}[${r.min_value ?? '-'}..${r.max_value ?? '-'}]`).join(' '));

    await client.query('COMMIT');
    console.log(`✅ KS-500RD limits fixed: ${LIMITS.length} rows (ID 14–38.125, OD 26–59.531)`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ fix failed:', e.message);
    throw e;
  } finally {
    client.release();
  }
}

run().then(() => process.exit(0)).catch(() => process.exit(1));
