'use strict';

/**
 * `sds_machine_tool.dwg_suffix` — let one DWG family cover two DIFFERENT physical
 * fixtures, and split J-WAVE's GUIDE PIN / GUIDE PIN HOLDER onto it.
 * ------------------------------------------------------------------------------
 * J-WAVE family 4879-03 is TWO fixtures, told apart by the 4th DWG segment:
 *   -01  ガイドピンホルダー / GUIDE PIN HOLDER
 *   -02 (occasionally -03, a duplicate JP/EN `lpb.eng_tooling` name for the same
 *        part on one serial) ガイドピン / GUIDE PIN
 * The plan always assigns both together (49 / 47 / 4 planned rows for -01/-02/-03,
 * always in matched pairs per serial — see the shelf, `tooling_jwave`, which only
 * ever stocks -01/-02, 37 rows each).
 *
 * Before this, one T-slot ("4879-03") whitelisted the whole family, so
 * `makeConfigSlotResolver` sent BOTH the holder and the pin to the same slot and
 * `placeTool` dropped whichever lost the race — the sheet printed one or the
 * other, never both (reported: J-WAVE/2071 T3 shows only one of GUIDE PIN /
 * GUIDE PIN HOLDER). Verified live before this migration on A41-03057 / A41-03043
 * (printed HOLDER, dropped PIN) and A43-00876 (printed PIN, dropped HOLDER).
 *
 * `dwg_suffix` (nullable, comma-separated 4th-segment values) is the fix: a row
 * that sets it only claims a candidate whose own suffix is in the list; a row
 * that leaves it NULL still claims the whole family, unchanged. See
 * `dwgSuffixOf`/`suffixMatches`/`makeConfigSlotResolver` in
 * `sdsV2HeadlessController.js` — with no `dwg_suffix` anywhere (every other
 * machine, and every other row here), the resolver is byte-identical to before.
 *
 * WHAT THIS DOES, for J-WAVE process codes 2021 and 2071 (the only combos with a
 * 4879-03 row today):
 *   1. Adds the `dwg_suffix` column (idempotent — `ADD COLUMN IF NOT EXISTS`).
 *   2. Sets the existing T3 (4879-03) row's `dwg_suffix = '01'` — it keeps meaning
 *      GUIDE PIN HOLDER.
 *   3. Inserts a NEW row at T6 (the first free slot on both combos) with
 *      `tool_drawing_no = '4879-03'`, `dwg_suffix = '02,03'` — GUIDE PIN.
 *
 * Idempotent: re-running finds T6 already inserted and T3 already suffixed, and
 * changes nothing. `--revert` deletes the T6 rows and clears T3's `dwg_suffix`
 * back to NULL; the COLUMN itself is left in place (NULL is inert for every other
 * row, so there is nothing to gain from dropping it and a later `--revert` of a
 * migration that runs after this one would then fail on a missing column).
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');
const MACHINE = 'J-WAVE';
const FAMILY = '4879-03';
const PROCESS_CODES = ['2021', '2071'];
const NEW_SLOT = 'T6';
const HOLDER_SUFFIX = '01';
const PIN_SUFFIX = '02,03';

async function state(c) {
  const rows = (await c.query(
    `SELECT process_code, tool_number, tool_drawing_no, dwg_suffix FROM sds_machine_tool
      WHERE machine_type = $1 AND process_code = ANY($2) AND tool_drawing_no = $3
      ORDER BY process_code, LPAD(SUBSTRING(tool_number FROM 2), 5, '0')`,
    [MACHINE, PROCESS_CODES, FAMILY]
  )).rows;
  return rows;
}

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const c = await engPool.connect();
  try {
    await c.query(`ALTER TABLE sds_machine_tool ADD COLUMN IF NOT EXISTS dwg_suffix varchar(20)`);
    console.log('-- before --', JSON.stringify(await state(c)));

    if (dryRun) { console.log('\n--dry-run: nothing written'); return; }

    await c.query('BEGIN');
    if (revert) {
      await c.query(
        `DELETE FROM sds_machine_tool
          WHERE machine_type = $1 AND process_code = ANY($2) AND tool_number = $3 AND tool_drawing_no = $4`,
        [MACHINE, PROCESS_CODES, NEW_SLOT, FAMILY]
      );
      await c.query(
        `UPDATE sds_machine_tool SET dwg_suffix = NULL
          WHERE machine_type = $1 AND process_code = ANY($2) AND tool_drawing_no = $3 AND dwg_suffix = $4`,
        [MACHINE, PROCESS_CODES, FAMILY, HOLDER_SUFFIX]
      );
    } else {
      for (const pc of PROCESS_CODES) {
        const t3 = await c.query(
          `SELECT id FROM sds_machine_tool WHERE machine_type = $1 AND process_code = $2 AND tool_drawing_no = $3`,
          [MACHINE, pc, FAMILY]
        );
        if (!t3.rows.length) { console.warn(`no ${FAMILY} row for ${MACHINE}/${pc} — skipping`); continue; }
        await c.query(`UPDATE sds_machine_tool SET dwg_suffix = $1 WHERE id = $2`, [HOLDER_SUFFIX, t3.rows[0].id]);

        const slotTaken = await c.query(
          `SELECT 1 FROM sds_machine_tool WHERE machine_type = $1 AND process_code = $2 AND tool_number = $3`,
          [MACHINE, pc, NEW_SLOT]
        );
        if (slotTaken.rows.length) { console.warn(`${NEW_SLOT} already in use for ${MACHINE}/${pc} — not adding the GUIDE PIN row`); continue; }
        await c.query(
          `INSERT INTO sds_machine_tool (machine_type, process_code, tool_number, tool_drawing_no, dwg_suffix)
           VALUES ($1, $2, $3, $4, $5)`,
          [MACHINE, pc, NEW_SLOT, FAMILY, PIN_SUFFIX]
        );
      }
    }
    await c.query('COMMIT');
    console.log('-- after --', JSON.stringify(await state(c)));
    if (revert) { await recordRevert({ file: __filename }); return; }
    await recordRun({ file: __filename });
    console.log('\nundo with:  node api/engineer/mtc/db_migrations/20260923_sds_machine_tool_dwg_suffix.js --revert');
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
