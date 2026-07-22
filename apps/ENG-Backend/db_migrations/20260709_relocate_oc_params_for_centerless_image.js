'use strict';
/**
 * Relocate the OC setup-condition Excel Config rows that collide with the Centerless
 * template's A16:I29 image, so the full-size image can stay and no data is hidden.
 *
 * The Centerless grid template (assigned to OC-16A / OC-18BR-150 / OC-20BR-200 /
 * HI-GRIND-1-D) has a merged image at A16:I29. The 3 OC machines have Excel Parameter
 * Config (sds_parameter, cn IS NULL) value cells inside that block on rows
 * 16, 18, 19, 26, 28, 29 (GRIND SPEED / RUBBER WHEEL SPEED / MACHINE SETUP CONDITION /
 * dimensions A/B/C). Under the merge those values are hidden/routed to the master A16.
 *
 * Fix (user choice: keep the big image, move the params): renumber those 6 source rows
 * to the free rows 50–55 (below all content; template has 59 rows and cols A–I are empty
 * there). Values, units and headers are preserved — only the row number in the param_key
 * changes (row_16_* -> row_50_*, etc.). HI-GRIND-1-D has no params, so it is untouched.
 *
 * NOTE: rows 50–55 in the template have no borders/labels of their own, so the relocated
 * params render as plain text at the bottom — the engineer should review/re-format their
 * positions visually in SDS Admin -> Excel Config afterward.
 *
 * Idempotent: source rows are empty after a run, so re-running is a no-op. Guarded against
 * overwriting any pre-existing row_50..55 regular keys.
 *
 * Run: node db_migrations/20260709_relocate_oc_params_for_centerless_image.js
 */
const { engPool } = require('../instance/eng_db');

const MACHINES = ['OC-16A', 'OC-18BR-150', 'OC-20BR-200'];
const MAP = [[16, 50], [18, 51], [19, 52], [26, 53], [28, 54], [29, 55]];

(async () => {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    let moved = 0;
    for (const machine of MACHINES) {
      const before = await client.query(
        `SELECT COUNT(*)::int n FROM sds_parameter
          WHERE machine_type_name = $1 AND cn IS NULL
            AND param_key ~ '^row_(16|18|19|26|28|29)_'`, [machine]);
      if (before.rows[0].n === 0) {
        console.log(`${machine}: no source rows 16/18/19/26/28/29 — already relocated, skip.`);
        continue;
      }
      // Target rows 50-55 must be free of regular row_ keys (gw_ keys are separate).
      const tgt = await client.query(
        `SELECT COUNT(*)::int n FROM sds_parameter
          WHERE machine_type_name = $1 AND cn IS NULL AND param_key ~ '^row_5[0-5]_[A-Z]'`, [machine]);
      if (tgt.rows[0].n > 0) {
        throw new Error(`Abort: ${machine} target rows 50-55 already occupied (${tgt.rows[0].n} keys)`);
      }
      for (const [from, to] of MAP) {
        const r = await client.query(
          `UPDATE sds_parameter
              SET param_key = regexp_replace(param_key, $1, $2)
            WHERE machine_type_name = $3 AND cn IS NULL AND param_key ~ $1`,
          [`^row_${from}_`, `row_${to}_`, machine]
        );
        moved += r.rowCount;
      }
      console.log(`${machine}: relocated ${before.rows[0].n} key(s) from rows 16/18/19/26/28/29 -> 50/51/52/53/54/55`);
    }

    await client.query('COMMIT');
    console.log(`\nTotal keys moved: ${moved}.`);

    for (const t of ['sds_coverage_cache', 'sds_cache', 'tselect_cn_cache']) {
      try {
        const { rows } = await engPool.query(`SELECT to_regclass($1) AS t`, [t]);
        if (rows[0].t) { await engPool.query(`DELETE FROM ${t}`); console.log(`flushed ${t}`); }
      } catch (_) {}
    }
    console.log('Done. A16:I29 is now clear of OC value cells; image stays full size. Review the moved rows (50-55) in Excel Config.');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration failed, rolled back:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await engPool.end();
  }
})();
