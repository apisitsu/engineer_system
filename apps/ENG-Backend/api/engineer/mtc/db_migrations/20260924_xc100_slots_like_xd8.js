'use strict';

/**
 * XC-100 — SDS Machine Tool Config: use XD-8's jig families.
 * ------------------------------------------------------------------------------
 * XC-100 (registry code 016) carried an exact copy of X-100's whitelist —
 * 9901-09, 4857-01/02/03/04/06/08 — at process 2031 and 2071. It is requested to
 * follow XD-8 instead, whose whitelist is 4858-01, -08, -12, -15, -17, -22 (identical at
 * XD-8's 2021 and 2071).
 *
 * Only the FAMILY per slot changes. XC-100 keeps its own process codes (2031, 2071), so
 * no combo is added or removed. XD-8 has six slots and XC-100 had seven, so T7 is
 * removed. This touches `sds_machine_tool` only — Tooling Select has no XC-100 machine,
 * shelf or formulas, and none is created here.
 *
 * Note: family 4016 (the registry's own code for XC-100) has no tool in the factory
 * plan, so nothing planned is displaced by the old 4857 list going away.
 *
 * Idempotent; `--revert` restores the X-100-shaped list exactly.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');
const MACHINE = 'XC-100';
const PROCESS_CODES = ['2031', '2071'];

const XD8 = ['4858-01', '4858-08', '4858-12', '4858-15', '4858-17', '4858-22'];
const OLD = ['9901-09', '4857-01', '4857-02', '4857-03', '4857-04', '4857-06', '4857-08'];

async function state(c) {
  const rows = (await c.query(
    `SELECT process_code, tool_number, tool_drawing_no FROM sds_machine_tool
      WHERE machine_type = $1 AND process_code = ANY($2)
      ORDER BY process_code, LPAD(SUBSTRING(tool_number FROM 2), 5, '0')`,
    [MACHINE, PROCESS_CODES]
  )).rows;
  const by = {};
  for (const r of rows) (by[r.process_code] = by[r.process_code] || []).push(`${r.tool_number}=${r.tool_drawing_no}`);
  return by;
}

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const c = await engPool.connect();
  try {
    console.log('-- before --', JSON.stringify(await state(c)));
    if (dryRun) { console.log('\n--dry-run: nothing written'); return; }

    const target = revert ? OLD : XD8;
    await c.query('BEGIN');
    for (const pc of PROCESS_CODES) {
      await c.query(`DELETE FROM sds_machine_tool WHERE machine_type = $1 AND process_code = $2`, [MACHINE, pc]);
      for (let i = 0; i < target.length; i++) {
        await c.query(
          `INSERT INTO sds_machine_tool (machine_type, process_code, tool_number, tool_drawing_no)
           VALUES ($1, $2, $3, $4)`,
          [MACHINE, pc, `T${i + 1}`, target[i]]
        );
      }
    }
    await c.query('COMMIT');
    try { await engPool.query('DELETE FROM tselect_cn_cache'); console.log('tselect_cn_cache cleared'); } catch (e) { console.warn('cache not cleared:', e.message); }
    console.log('-- after --', JSON.stringify(await state(c)));
    if (revert) { await recordRevert({ file: __filename }); return; }
    await recordRun({ file: __filename });
    console.log('\nundo with:  node api/engineer/mtc/db_migrations/20260924_xc100_slots_like_xd8.js --revert');
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

main()
  .then(() => engPool.end())
  .catch(async (e) => { console.error(e); await engPool.end().catch(() => {}); process.exit(1); });
