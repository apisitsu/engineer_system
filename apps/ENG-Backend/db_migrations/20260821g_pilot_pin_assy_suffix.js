'use strict';

/**
 * PILOT PIN — restore the `-99` assembly suffix on the 4931-03 shelf.
 * ------------------------------------------------------------------------------
 * `tooling_ks400b6` stores the pilot pin as `4931-03-0001` … `4931-03-0020`.
 * Both authorities write it with an assembly suffix:
 *
 *   • TEMPLATE_B, INNER in BALL r10 — tooling name **`PILOT PIN ASSY`**,
 *     DWG/No. `4931-03-`, Rev column **`-99`**
 *   • lpb.eng_r_pi_tool — every planned pilot pin is `4931-03-nnnn-99`
 *     (23 drawings), alongside a few `-01` rows, which are the ASSY's component
 *     parts. Same shape as `4693-05` on the M-BODY sheet: `-99` the assembly,
 *     `-01`…`-04` its pieces.
 *
 * Checked shelf-vs-plan two ways across all eight 4931 families. Only this one is
 * affected, and it is affected completely:
 *
 *     tooling          shelf   exact match   match with "-99"   no match
 *     FRONT SHOE           7             7                  0          0
 *     LOADING CHUTE        9             8                  0          1
 *     PILOT PIN           18             0                 18          0
 *     PLUG                 9             8                  0          1
 *     REAR SHOE            7             7                  0          0
 *     WORK DRIVER          5             4                  0          1
 *     WORK GUIDE           8             7                  0          1
 *     WORK PUSHER          6             6                  0          0
 *
 * (The single "no match" in four families is a shelf row the plan has not called
 * for yet — normal, and unrelated.)
 *
 * THIS IS A NUMBER BUG, NOT A SELECTION BUG. The dimensional search already picks
 * the right pin; what it prints on the SDS is an incomplete drawing number, and a
 * join to the factory plan on drawing number finds nothing. Nothing about the
 * formulas or the search rules changes here.
 *
 * IT ALSO FIXES KS-400B1, WHICH BORROWS THIS SHELF. `tooling_search_rule` gives
 * KS-400B1's own PILOT PIN `inventory_table_override = 'tooling_ks400b6'`, so both
 * machines have been printing the short number and both are corrected at once.
 *
 * WHAT IS DELIBERATELY *NOT* DONE: renaming the tooling to `PILOT PIN ASSY` to match
 * TEMPLATE_B. KS-400B1's search rules filter on `inventory_tooling_filter =
 * 'PILOT PIN'`; renaming the shelf without rewriting those filters would make the
 * family unfindable on both machines. The name difference is recorded in
 * docs/tooling_select_audit_findings.md (F-1) and left alone.
 *
 * Safety checked before writing: 18 rows, 18 distinct numbers, 18 distinct numbers
 * after appending, and no `4931-03%` rows in `tooling_partno_map` or any other
 * inventory table — so nothing else refers to the short form.
 *
 * Idempotent: rows already ending in `-99` are skipped. `--revert` strips it back.
 */

const { engPool } = require('../instance/eng_db');

const TABLE = 'tooling_ks400b6';
const TOOLING = 'PILOT PIN';
const FAMILY = '4931-03-';

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT id, tooling_no FROM ${TABLE}
        WHERE tooling_name = $1 AND tooling_no LIKE $2
        ORDER BY tooling_no FOR UPDATE`, [TOOLING, `${FAMILY}%`]);

    if (!rows.length) throw new Error(`no ${TOOLING} rows in ${TABLE}`);

    const todo = rows
      .map(r => {
        const cur = String(r.tooling_no).trim();
        const next = revert
          ? cur.replace(/-99$/, '')
          : (/-99$/.test(cur) ? cur : `${cur}-99`);
        return next === cur ? null : { id: r.id, cur, next };
      })
      .filter(Boolean);

    console.log(`${TABLE} · ${TOOLING}: ${rows.length} rows, ${todo.length} to change`);
    if (!todo.length) {
      console.log(revert ? 'already without -99 — nothing to do'
                         : 'already carrying -99 — nothing to do');
      await client.query('COMMIT');
      return;
    }
    for (const t of todo.slice(0, 4)) console.log(`   ${t.cur} → ${t.next}`);
    if (todo.length > 4) console.log(`   … and ${todo.length - 4} more`);

    if (dryRun) { await client.query('ROLLBACK'); console.log('(dry run — rolled back)'); return; }

    // Guard: the rewrite must not collide with an existing row.
    const nexts = todo.map(t => t.next);
    const { rows: clash } = await client.query(
      `SELECT tooling_no FROM ${TABLE} WHERE tooling_no = ANY($1)`, [nexts]);
    if (clash.length) throw new Error(`would collide with existing rows: ${clash.map(c => c.tooling_no).join(', ')}`);

    for (const t of todo) {
      await client.query(`UPDATE ${TABLE} SET tooling_no = $1 WHERE id = $2`, [t.next, t.id]);
    }

    await client.query('COMMIT');
    console.log(`\n${revert ? 'reverted' : 'updated'} ${todo.length} rows`);
    if (!revert) {
      console.log(`undo with:  node db_migrations/20260821g_pilot_pin_assy_suffix.js --revert`);
    }
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
