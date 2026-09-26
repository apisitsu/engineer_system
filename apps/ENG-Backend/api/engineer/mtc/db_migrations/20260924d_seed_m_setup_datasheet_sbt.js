'use strict';

/**
 * Seed the SBT-xx turning machine codes into `rodpc.m_setup_datasheet`.
 *
 * WHY: same reason as 20260809_seed_m_setup_datasheet_grinding_codes.js. The public SDS PDF
 * link resolves a floor machine_code via `sds_machine_code` → `m_setup_datasheet` → the raw
 * value, and `GET /api/public/sds/machines` lists `m_setup_datasheet` codes ONLY. The SBT
 * codes were in neither factory table, so they resolved only through the local override rows
 * added by 20260924b_/20260924c_ and never appeared in the caller-facing list.
 *
 * Names are taken verbatim from `rodpc.m_machine.m_model`, and every name below resolves to
 * an active `sds_machine_type_code.machine_type_name`.
 *
 * NOT seeded (deliberate):
 *   SBT-14, 15 (M08SY), SBT-18 (M08SJ-II)  — disabled by request
 *   SBT-01, 03..06 (m_model 'FLT-10I')       — typo of FTL-10(I), whose registry row is inactive
 *   SBT-21, 22 (XWT-8)                       — not in the SDS registry
 *
 * INSERT-ONLY and idempotent: a machine_code already present is skipped, nothing existing is
 * updated. `m_setup_datasheet` is the asset team's table; new rows use sheet_name='' and
 * rev='NC', the convention the earlier seed established (the SDS code never reads sheet_name).
 * The `sds_machine_code` rows from 20260924b_/c_ now duplicate these and are harmless — the
 * override wins and holds the same value.
 *
 * `--dry-run` shows what would be inserted. `--revert` deletes only rows this file's CODES
 * match with rev='NC' and sheet_name=''.
 *
 * 2026-09-24
 */

require('dotenv').config();
const { pool: rodpcPool } = require('../../../../instance/instance');

const ROWS = [
  ['SBT-07', 'XD-8'],
  ['SBT-12', 'XD-8'],
  ['SBT-08', 'X-100'],
  ['SBT-09', 'X-100'],
  ['SBT-10', 'XC-100'],
  ['SBT-11', 'XC-100'],
  ['SBT-19', 'XC-100'],
  ['SBT-20', 'XC-100'],
  ['SBT-13', 'J-WAVE'],
  ['SBT-17', 'J-WAVE'],
  ['SBT-16', 'XD-8T'],
];

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

async function run() {
  const client = await rodpcPool.connect();
  const done = [];
  const skipped = [];
  try {
    await client.query('BEGIN');
    for (const [machine_code, machine_name] of ROWS) {
      if (revert) {
        const r = await client.query(
          `DELETE FROM rodpc.m_setup_datasheet
            WHERE TRIM(machine_code) = $1 AND TRIM(machine_name) = $2 AND rev = 'NC' AND sheet_name = ''`,
          [machine_code, machine_name]
        );
        (r.rowCount ? done : skipped).push(machine_code);
        continue;
      }
      const exists = await client.query(
        `SELECT machine_name FROM rodpc.m_setup_datasheet WHERE TRIM(machine_code) = $1`, [machine_code]);
      if (exists.rows.length) { skipped.push(`${machine_code} (already there -> ${exists.rows[0].machine_name})`); continue; }
      if (!dryRun) {
        await client.query(
          `INSERT INTO rodpc.m_setup_datasheet (machine_code, machine_name, sheet_name, rev)
           VALUES ($1, $2, '', 'NC')`, [machine_code, machine_name]);
      }
      done.push(`${machine_code} -> ${machine_name}`);
    }
    await (dryRun ? client.query('ROLLBACK') : client.query('COMMIT'));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  return { done, skipped };
}

if (require.main === module) {
  run()
    .then(({ done, skipped }) => {
      console.log(`${dryRun ? 'WOULD ' : ''}${revert ? 'DELETE' : 'INSERT'} ${done.length} rows:`);
      done.forEach((s) => console.log('  +', s));
      if (skipped.length) { console.log(`skipped ${skipped.length}:`); skipped.forEach((s) => console.log('  -', s)); }
      process.exit(0);
    })
    .catch((err) => { console.error('FAILED (rolled back):', err.message); process.exit(1); });
}

module.exports = { run, ROWS };
