'use strict';

/**
 * ROTARY DRESSER — load the shelf so the pn-keyed map stops being inert.
 * ------------------------------------------------------------------------------
 * `tooling_partno_map` already carries ROTARY DRESSER, keyed by `parts_no`, seeded
 * from the machines' own tooling lists:
 *
 *     KS-400B5   43 rows   38 drawings   20241223_TOOLING LIST_KS-400B5.xlsx
 *     KS-400B6   26 rows    8 drawings   20240912_TOOLING LIST_KS-400B6.xlsx
 *
 * **All 69 rows produce nothing.** Verified live: ROTARY DRESSER comes back
 * `(no match)` on every C/N, including ones whose `pn` is in the map (`3ABR4-T`,
 * `3ABR3-02-T`). The reason is one line in searchService — both `_applyPartnoOverrides`
 * and `_applyLookupOnlyToolings` resolve the pinned drawing against the machine's
 * inventory table before emitting it:
 *
 *     SELECT * FROM "<inventory_table>" WHERE tooling_no = $1 LIMIT 1
 *     if (!inv.length) continue;
 *
 * and `tooling_ks400b5` holds **zero** ROTARY DRESSER rows (`4906-xx` only). A map
 * row without a shelf row behind it is silently skipped. This migration loads the
 * shelf; it changes no map row and no formula.
 *
 * pn IS THE RIGHT KEY, AND THE WORKBOOK SAYS SO
 *
 * The `ROTARY DRESSER` sheet is keyed by part model, not by dimensions:
 *
 *     No.     | Model 1        | Model 2        | Model 3 | Number of | M/C
 *     DD0189  | 3ABYT4-T       | 3ARYF4-602-T   |         | 1         | B5
 *     DD0193  | 3ABYT5-T       |                |         | 1         | B5
 *
 * So the existing map is faithful to its source in both mechanism and key. Nothing
 * about the selection needs changing — only the missing shelf.
 *
 * THE SHELF IS LOADED IN `DDnnnn` FORM, BECAUSE THE MAP IS
 *
 * `DD####` and `4800-42-####` are the SAME drawing in two notations — that is the
 * project's existing design, implemented in `api/engineer/mtc/utils/rotaryDwg.js`
 * (`toDD` / `toDwg`) and applied by `20260619_partno_map_to_dd_form.js`, which
 * deliberately converted the map to DD because DD is what the engineering tooling
 * list and the SDS sheet print. `sdsV2HeadlessController` round-trips inventory
 * `tooling_no` through `toDwg` when matching the factory plan, so a DD shelf is what
 * that code already expects.
 *
 * `_applyLookupOnlyToolings` compares `map.tool_dwg_no` to `inventory.tooling_no`
 * with a plain `=`, so the two must be written the same way. The map is DD;
 * therefore the shelf is DD. The two KS-400B6 rows this replaces were in the
 * `4800-42-` form with no formula and no map row that could ever equal them — dead
 * either way, and now superseded by the 8 the map actually names.
 *
 * A WRONG TURN WORTH RECORDING, so nobody repeats it
 *
 * Joining map → spec → plan by part number appeared to disprove the DD ⇄ 4800-42
 * equivalence on 7 rows (`3WHT4-T` map DD0233 vs plan 4800-42-0293, and six more).
 * **That test was wrong, not the equivalence.** It compared a KS-400B5 map row
 * against whatever dresser the plan named for that part on ANY machine, and the same
 * part legitimately takes a different dresser per machine — `3WHT4-T` is DD0233 on
 * KS-400B5 and DD0293 on KS-400B6, both present in the map. Always carry the machine
 * through a map-vs-plan comparison.
 *
 * The shelf is built FROM THE MAP'S OWN `tool_dwg_no` values, so the two cannot
 * drift apart whichever notation is in force. `dim_*` are left NULL: this family is
 * selected by part number, so no formula or search rule reads them.
 *
 * Idempotent; `--revert` removes the shelf rows (the map is untouched either way).
 */

const { engPool } = require('../../../../instance/eng_db');

const TOOLING = 'ROTARY DRESSER';
const TARGETS = [
  { machine: 'KS-400B5', inventory: 'tooling_ks400b5' },
  { machine: 'KS-400B6', inventory: 'tooling_ks400b6' },
];

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  for (const { machine, inventory } of TARGETS) {
    console.log(`\n── ${machine} · ${inventory} ──`);

    const { rows: dwgs } = await engPool.query(
      `SELECT DISTINCT tool_dwg_no FROM tooling_partno_map
        WHERE machine_name = $1 AND tooling_name = $2 AND tool_dwg_no IS NOT NULL
        ORDER BY 1`, [machine, TOOLING]);

    if (!dwgs.length) { console.log(`  no map rows for ${machine} · ${TOOLING} — skipping`); continue; }

    if (revert) {
      const del = await engPool.query(
        `DELETE FROM ${inventory} WHERE tooling_name = $1`, [TOOLING]);
      console.log(`  reverted: removed ${del.rowCount} shelf rows (map left intact)`);
      continue;
    }

    console.log(`  map names ${dwgs.length} drawings: ${dwgs.slice(0, 4).map(r => r.tool_dwg_no).join(' ')} …`);
    if (dryRun) continue;

    const client = await engPool.connect();
    try {
      await client.query('BEGIN');
      const del = await client.query(
        `DELETE FROM ${inventory} WHERE tooling_name = $1`, [TOOLING]);

      const list = dwgs.map(r => r.tool_dwg_no);
      const values = list.flatMap(d => [TOOLING, d]);
      const ph = list.map((_, ri) => `($${ri * 2 + 1}, $${ri * 2 + 2})`).join(',');
      const ins = await client.query(
        `INSERT INTO ${inventory} (tooling_name, tooling_no) VALUES ${ph}`, values);

      await client.query('COMMIT');
      console.log(`  shelf: removed ${del.rowCount}, loaded ${ins.rowCount}`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  if (!revert && !dryRun) {
    console.log(`\nundo with:  node api/engineer/mtc/db_migrations/20260821f_rotary_dresser_shelf.js --revert`);
  }
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
