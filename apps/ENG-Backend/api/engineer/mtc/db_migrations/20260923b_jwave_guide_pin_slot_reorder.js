'use strict';

/**
 * J-WAVE — move GUIDE PIN (T6) up next to GUIDE PIN HOLDER (T3→T4) on the SDS sheet.
 * ------------------------------------------------------------------------------
 * `20260923_sds_machine_tool_dwg_suffix.js` split the shared 4879-03 family across
 * two slots so both fixtures print (T3 = HOLDER, T6 = PIN — T6 because it was the
 * first free slot at the time). That put GUIDE PIN two rows below its HOLDER, next
 * to INVERSION JAW instead — reported as visually disconnected from the fixture it
 * belongs with.
 *
 * This is a pure slot REORDER, not a config change: right-rotates T4/T5/T6 so GUIDE
 * PIN (was T6) becomes T4, and WRIST END ASSY / INVERSION JAW (were T4/T5) shift down
 * to T5/T6. Since `sds_machine_tool` rows are keyed by (tool_number, process_code,
 * machine_type) and only the FAMILY/SUFFIX PAYLOAD moves, this is three UPDATEs by id
 * — no risk of colliding with the UNIQUE constraint (the tool_number identity of each
 * row never changes, only what it points at).
 *
 * Before → after, for both J-WAVE process codes (2021, 2071):
 *   T3  4879-03 (01)        →  unchanged (GUIDE PIN HOLDER)
 *   T4  4879-06             →  4879-03 (02,03)   [GUIDE PIN]
 *   T5  4879-02             →  4879-06           [WRIST END ASSY]
 *   T6  4879-03 (02,03)     →  4879-02           [INVERSION JAW]
 *
 * Idempotent (checks T4's current tool_drawing_no before acting) and reversible with
 * `--revert` (rotates back).
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');
const MACHINE = 'J-WAVE';
const PROCESS_CODES = ['2021', '2071'];

// forward: T4 <- T6, T5 <- T4(old), T6 <- T5(old)
const FORWARD = {
  T4: { tool_drawing_no: '4879-03', dwg_suffix: '02,03' },
  T5: { tool_drawing_no: '4879-06', dwg_suffix: null },
  T6: { tool_drawing_no: '4879-02', dwg_suffix: null },
};
// reverse rotates the other way: T4 <- T5(fwd) i.e. back to 4879-06, T5 <- T6(fwd)
// i.e. back to 4879-02, T6 <- T4(fwd) i.e. back to 4879-03/02,03 — restores the state
// 20260923_sds_machine_tool_dwg_suffix.js left behind.
const REVERSE = {
  T4: { tool_drawing_no: '4879-06', dwg_suffix: null },
  T5: { tool_drawing_no: '4879-02', dwg_suffix: null },
  T6: { tool_drawing_no: '4879-03', dwg_suffix: '02,03' },
};

async function state(c) {
  return (await c.query(
    `SELECT process_code, tool_number, tool_drawing_no, dwg_suffix FROM sds_machine_tool
      WHERE machine_type = $1 AND process_code = ANY($2) AND tool_number = ANY($3)
      ORDER BY process_code, LPAD(SUBSTRING(tool_number FROM 2), 5, '0')`,
    [MACHINE, PROCESS_CODES, ['T4', 'T5', 'T6']]
  )).rows;
}

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const c = await engPool.connect();
  try {
    console.log('-- before --', JSON.stringify(await state(c)));
    if (dryRun) { console.log('\n--dry-run: nothing written'); return; }

    const plan = revert ? REVERSE : FORWARD;
    await c.query('BEGIN');
    for (const pc of PROCESS_CODES) {
      for (const [tn, { tool_drawing_no, dwg_suffix }] of Object.entries(plan)) {
        await c.query(
          `UPDATE sds_machine_tool SET tool_drawing_no = $1, dwg_suffix = $2
            WHERE machine_type = $3 AND process_code = $4 AND tool_number = $5`,
          [tool_drawing_no, dwg_suffix, MACHINE, pc, tn]
        );
      }
    }
    await c.query('COMMIT');
    // Config changed — the persisted per-CN T-Select cache must not keep serving a
    // tool list built against the old slot order (same reason as flushTselectOnWrite).
    try { await engPool.query('DELETE FROM tselect_cn_cache'); console.log('tselect_cn_cache cleared'); } catch (e) { console.warn('cache not cleared:', e.message); }
    console.log('-- after --', JSON.stringify(await state(c)));
    if (revert) { await recordRevert({ file: __filename }); return; }
    await recordRun({ file: __filename });
    console.log('\nundo with:  node api/engineer/mtc/db_migrations/20260923b_jwave_guide_pin_slot_reorder.js --revert');
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
