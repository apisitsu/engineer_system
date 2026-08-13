'use strict';

/**
 * Seed the grinding floor machine codes that were missing from `rodpc.m_setup_datasheet`.
 *
 * WHY: the public SDS PDF link (`GET /api/public/sds/pdf`, sdsPublicController.js) resolves
 * the caller's floor machine_code via `sds_machine_code` (local override) → `m_setup_datasheet`
 * (factory base) → the raw value. 27 grinding machines with live production had NO row in
 * either table, so every request for them returned HTTP 400 "Unknown machine" — including
 * CGM-07 / CGM-08 / CGM-04, the highest-volume OD-grind machines.
 *
 * The correct model name was already sitting in `rodpc.m_machine.m_model` for all of them;
 * this migration copies it across. Verified before writing: every name below resolves to an
 * active `sds_machine_type_code.machine_type_name`.
 *
 * INSERT-ONLY. Existing rows are never updated or deleted — the 5 known-stale rows
 * (VSG-02, VSG-03, SGM-02, SGM-03, SGM-04) are deliberately left alone; they are already
 * corrected by `sds_machine_code`, which the resolver checks first. Fixing those at source
 * (and then retiring the overrides) is a separate decision that needs the asset team.
 *
 * `m_setup_datasheet` is the asset team's table. Columns are (machine_code, machine_name,
 * sheet_name, rev); new rows use sheet_name='' and rev='NC' to match the table's existing
 * convention. `sheet_name` is theirs — the SDS code never reads it.
 *
 * Idempotent: skips any machine_code already present, so it is safe to re-run.
 *
 * Rollback:
 *   DELETE FROM rodpc.m_setup_datasheet
 *    WHERE machine_code IN (...the CODES below...) AND rev = 'NC' AND sheet_name = '';
 *
 * 2026-08-09
 */

require('dotenv').config();
const { pool: rodpcPool } = require('../instance/instance');

// floor machine_code → machine_name, taken verbatim from rodpc.m_machine.m_model.
// The trailing comment is the sds_machine_type_code row it resolves to, and whether that
// machine already has sds_parameter config (no config → the sheet renders blank).
const ROWS = [
  ['CGM-08', 'OC-20BR-200'],  // → OC-20BR-200   config ✓
  ['CGM-07', 'OC-18BR-150'],  // → OC-18BR-150   config ✓
  ['CGM-04', 'OC-16A'],       // → OC-16A        config ✓
  ['CGM-03', 'OC-18BR-150'],  // → OC-18BR-150   config ✓
  ['CGM-05', 'OC-18BR-150'],  // → OC-18BR-150   config ✓
  ['CGM03B', 'OC-18BR-150'],  // → OC-18BR-150   config ✓   (no hyphen — matches production data)
  ['CGM05B', 'OC-18BR-150'],  // → OC-18BR-150   config ✓   (no hyphen — matches production data)
  ['CGM-01', 'OC-18BR-150'],  // → OC-18BR-150   config ✓
  ['CGM-06', 'OC-18BR-150'],  // → OC-18BR-150   config ✓
  ['SGM-05', 'MSG-410'],      // → MSG-410       config ✓
  ['EGM-01', 'KN-312A'],      // → KN-312A       config ✓
  ['EGM-02', 'KN-312A'],      // → KN-312A       config ✓
  ['EGM-03', 'KN-312A'],      // → KN-312A       config ✓
  ['EGM-04', 'KN-312A'],      // → KN-312A       config ✓
  ['HSG-01', 'KVD-300CRII'],  // → KVD-300CRII   config ✓
  ['OGM-01', 'KN-113A'],      // → KN-113A       NO config yet — resolves, renders blank
  ['OGM-03', 'KN-113A'],      // → KN-113A       NO config yet
  ['OGM-04', 'KN-113A'],      // → KN-113A       NO config yet
  ['OGM-05', 'KN-113A'],      // → KN-113A       NO config yet
  ['IGM-01', 'KN-113A'],      // → KN-113A       NO config yet
  ['IGM-02', 'KN-113A'],      // → KN-113A       NO config yet
  ['IGM-03', 'KN-113A'],      // → KN-113A       NO config yet
  ['IGM-04', 'KN-113A'],      // → KN-113A       NO config yet
  ['STN-01', 'PAX2'],         // → PAX2          NO config yet
  ['STN-02', 'PAX2'],         // → PAX2          NO config yet
  ['STN-03', 'PAX2'],         // → PAX2          NO config yet
  ['STN-04', 'PAX2'],         // → PAX2          NO config yet
];

// Deliberately NOT seeded here (each needs a human decision, not a copy):
//   CGM-09  m_model 'MD-450-RDP-RCNC-ANGI' — no matching sds_machine_type_code row
//   CGM-11  m_model 'SIGMA 18-IA'          — catalog has 'Sigma-18-I'; confirm same machine
//   IDG-15  m_model 'KS-R80D'              — not in catalog
//   STN-05  m_model 'TNC-L03-SP'           — not in catalog
//   'S'                                    — malformed machine_code in pc_production

async function run() {
  const client = await rodpcPool.connect();
  const inserted = [];
  const skipped = [];
  try {
    await client.query('BEGIN');
    for (const [machine_code, machine_name] of ROWS) {
      const exists = await client.query(
        `SELECT machine_name FROM rodpc.m_setup_datasheet WHERE TRIM(machine_code) = $1`,
        [machine_code]
      );
      if (exists.rows.length) {
        skipped.push(`${machine_code} (มีอยู่แล้ว → ${exists.rows[0].machine_name})`);
        continue;
      }
      await client.query(
        `INSERT INTO rodpc.m_setup_datasheet (machine_code, machine_name, sheet_name, rev)
         VALUES ($1, $2, '', 'NC')`,
        [machine_code, machine_name]
      );
      inserted.push(`${machine_code} → ${machine_name}`);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  return { inserted, skipped };
}

if (require.main === module) {
  run()
    .then(({ inserted, skipped }) => {
      console.log(`INSERT ${inserted.length} แถว:`);
      inserted.forEach((s) => console.log('  +', s));
      if (skipped.length) {
        console.log(`\nข้าม ${skipped.length} แถว:`);
        skipped.forEach((s) => console.log('  -', s));
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('FAILED (rolled back):', err.message);
      process.exit(1);
    });
}

module.exports = { run, ROWS };
