'use strict';

/**
 * XD-8T — make its SDS config identical to XD-8, keeping the name XD-8T.
 * ------------------------------------------------------------------------------
 * XD-8T already carried a copy of XD-8's grid template (8), Excel mapping (275) and
 * parameters (73, same keys). Only three things differed:
 *
 *   1. Tool slots: XD-8T had extra 4858-11 (2021 T7, 2071 T7) and 4858-04 (2021 T8).
 *      XD-8 has T1..T6 = 4858-01/08/12/15/17/22 at both 2021 and 2071.
 *      -> the extra slots are removed.
 *   2. sds_parameter Tool_Photo_Key_3:          TURN:XD-8T:3      -> TURN:XD-8:3
 *   3. sds_parameter Turning_Layout_Photo_Key:  TURN:XD-8T:layout -> TURN:XD-8:layout
 *      The XD-8T image rows are byte-for-byte the same size as XD-8's (1359528 / 48556 bytes),
 *      i.e. copies, so the sheet shows the same pictures. The XD-8T image rows themselves are
 *      left in place.
 *
 * NOT changed: the machine name (XD-8T), its registry code, or anything for XD-8. This is a
 * one-time copy — later edits to XD-8's config will NOT follow to XD-8T on their own.
 *
 * Idempotent; `--revert` restores the extra slots and the two photo keys.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');
const M = 'XD-8T';

const EXTRA_SLOTS = [['2021', 'T7', '4858-11'], ['2021', 'T8', '4858-04'], ['2071', 'T7', '4858-11']];
const PARAMS = [
  ['Tool_Photo_Key_3', 'TURN:XD-8:3', 'TURN:XD-8T:3'],
  ['Turning_Layout_Photo_Key', 'TURN:XD-8:layout', 'TURN:XD-8T:layout'],
];

async function state(c) {
  const t = (await c.query(`SELECT process_code, tool_number, tool_drawing_no FROM sds_machine_tool WHERE machine_type=$1 ORDER BY process_code, LPAD(SUBSTRING(tool_number FROM 2),5,'0')`, [M])).rows;
  const by = {}; for (const r of t) (by[r.process_code] = by[r.process_code] || []).push(`${r.tool_number}=${r.tool_drawing_no}`);
  const p = (await c.query(`SELECT param_key, param_value FROM sds_parameter WHERE machine_type_name=$1 AND param_key = ANY($2) AND cn IS NULL AND process_code IS NULL ORDER BY 1`, [M, PARAMS.map(x => x[0])])).rows;
  return { slots: by, params: Object.fromEntries(p.map(r => [r.param_key, r.param_value])) };
}

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const c = await engPool.connect();
  try {
    console.log('-- before --', JSON.stringify(await state(c)));
    if (dryRun) { console.log('\n--dry-run: nothing written'); return; }
    await c.query('BEGIN');
    if (revert) {
      for (const [pc, tn, dwg] of EXTRA_SLOTS) {
        await c.query(`INSERT INTO sds_machine_tool (machine_type, process_code, tool_number, tool_drawing_no)
                       SELECT $1,$2,$3,$4 WHERE NOT EXISTS (SELECT 1 FROM sds_machine_tool WHERE machine_type=$1 AND process_code=$2 AND tool_number=$3)`, [M, pc, tn, dwg]);
      }
      for (const [k, , old] of PARAMS) {
        await c.query(`UPDATE sds_parameter SET param_value=$1 WHERE machine_type_name=$2 AND param_key=$3 AND cn IS NULL AND process_code IS NULL`, [old, M, k]);
      }
    } else {
      for (const [pc, tn, dwg] of EXTRA_SLOTS) {
        await c.query(`DELETE FROM sds_machine_tool WHERE machine_type=$1 AND process_code=$2 AND tool_number=$3 AND tool_drawing_no=$4`, [M, pc, tn, dwg]);
      }
      for (const [k, neu] of PARAMS) {
        await c.query(`UPDATE sds_parameter SET param_value=$1 WHERE machine_type_name=$2 AND param_key=$3 AND cn IS NULL AND process_code IS NULL`, [neu, M, k]);
      }
    }
    await c.query('COMMIT');
    try { await engPool.query('DELETE FROM tselect_cn_cache'); } catch (_) {}
    console.log('-- after --', JSON.stringify(await state(c)));
    if (revert) { await recordRevert({ file: __filename }); return; }
    await recordRun({ file: __filename });
    console.log('\nundo with:  node api/engineer/mtc/db_migrations/20260924f_xd8t_config_like_xd8.js --revert');
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
}

main().then(() => engPool.end()).catch(async (e) => { console.error(e); await engPool.end().catch(() => {}); process.exit(1); });
