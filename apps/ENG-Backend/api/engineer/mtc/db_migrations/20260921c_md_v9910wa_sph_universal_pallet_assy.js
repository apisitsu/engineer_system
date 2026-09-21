'use strict';

/**
 * MD-V9910WA — SPH parts take the UNIVERSAL PALLET ASSY 4918-01-0001-99, not a 4918-02 pallet.
 * ------------------------------------------------------------------------------
 * Found on CN 414303 (A41, SPH): Tooling Select offered PALLET 4918-02-0011. TEMPLATE_B does
 * not say that for SPH - every SPH sheet (JWAVE, SPH(DT), SPH(D->T), SPH(D->DT), SPH 中型)
 * lists UNIVERSAL PALLET ASSY = 4918-01 + 0001-99 at 3491, and 4918-02 appears only on the
 * SLEEVE sheet. The factory plan agrees (process 3491, distinct C/N by part class):
 *
 *   4918-01-0001-99   A41 70 - A43 40 - A42 23        (SPH: the ASSY, always)
 *   4918-02-xxxx      F01 126 - F00 14 - A41/A43/A44 1 each   (sleeve / assemblies)
 *
 * No C/N plans both. The PALLET formula (W_max + GAP, from the 4918-03 sheet header) had no
 * part-class gate, so it ran on SPH and picked a 4918-02 the plan does not use there.
 *
 * -- CHANGES ---------------------------------------------------------------------
 *   1. PALLET  A = wAft_max + 0.2   ->   if(cnPrefix >= 41 and cnPrefix <= 49, -999, wAft_max + 0.2)
 *      SPH classes (A41-A49) emit the unmatchable -999 sentinel (BETWEEN rule, so -999 is the
 *      right sign - see tooling-select.md "A ceiling rule's sentinel"); every other class is
 *      computed exactly as before.
 *   2. NEW tooling UNIVERSAL PALLET ASSY: one shelf row (4918-01-0001-99, dim_a 0), formula
 *      A = if(SPH, 0, -999), rule dim_a +-0.5 with inventory_tooling_filter so it never ranks
 *      against the PALLET rows in the shared `tooling_marking` table. It has no dimension
 *      rule because the ASSY is one fixed drawing, not sized to the part.
 *   3. Clears `tselect_cn_cache` (direct SQL bypasses the route middleware that flushes it).
 *      A running backend also holds `tsv2ConfigCache` in memory - it picks the change up when
 *      that expires or the server restarts.
 *
 * Non-SPH parts now see UNIVERSAL PALLET ASSY as an empty (gated) result, the same shape as
 * KL-20's out-of-grip collet - a deliberate "does not apply here", not a missing tool.
 *
 * Idempotent; `--revert` restores the old PALLET formula and removes the new tooling.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const MACHINE = 'MD-V9910WA';
const OLD_PALLET_EXPR = 'wAft_max + 0.2';
const NEW_PALLET_EXPR = 'if(cnPrefix >= 41 and cnPrefix <= 49, -999, wAft_max + 0.2)';
const ASSY = 'UNIVERSAL PALLET ASSY';
const ASSY_NO = '4918-01-0001-99';
const ASSY_EXPR = 'if(cnPrefix >= 41 and cnPrefix <= 49, 0, -999)';

async function state(c, machineId) {
  const p = await c.query(
    `SELECT formula_expr FROM tooling_formula WHERE machine_id=$1 AND tooling_name='PALLET' AND output_key='A'`, [machineId]);
  const a = await c.query(
    `SELECT (SELECT count(*) FROM tooling_formula WHERE machine_id=$1 AND tooling_name=$2)::int AS f,
            (SELECT count(*) FROM tooling_search_rule WHERE machine_id=$1 AND tooling_name=$2)::int AS r,
            (SELECT count(*) FROM tooling_marking WHERE tooling_name=$2)::int AS s`, [machineId, ASSY]);
  return { pallet: p.rows[0] && p.rows[0].formula_expr, assy: a.rows[0] };
}

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const c = await engPool.connect();
  try {
    const m = await c.query(`SELECT id FROM tooling_machine WHERE machine_name=$1`, [MACHINE]);
    if (!m.rows.length) throw new Error(`${MACHINE} not found in tooling_machine`);
    const machineId = m.rows[0].id;

    console.log('\n-- before --', JSON.stringify(await state(c, machineId)));
    if (dryRun) { console.log('\n--dry-run: nothing written'); return; }

    await c.query('BEGIN');
    if (revert) {
      await c.query(`DELETE FROM tooling_search_rule WHERE machine_id=$1 AND tooling_name=$2`, [machineId, ASSY]);
      await c.query(`DELETE FROM tooling_formula WHERE machine_id=$1 AND tooling_name=$2`, [machineId, ASSY]);
      await c.query(`DELETE FROM tooling_marking WHERE tooling_name=$1 AND tooling_no=$2`, [ASSY, ASSY_NO]);
      await c.query(
        `UPDATE tooling_formula SET formula_expr=$2, updated_at=now()
          WHERE machine_id=$1 AND tooling_name='PALLET' AND output_key='A'`, [machineId, OLD_PALLET_EXPR]);
    } else {
      await c.query(
        `UPDATE tooling_formula SET formula_expr=$2, updated_at=now()
          WHERE machine_id=$1 AND tooling_name='PALLET' AND output_key='A'`, [machineId, NEW_PALLET_EXPR]);

      const shelf = await c.query(`SELECT 1 FROM tooling_marking WHERE tooling_name=$1 AND tooling_no=$2`, [ASSY, ASSY_NO]);
      if (!shelf.rows.length) {
        await c.query(
          `INSERT INTO tooling_marking (tooling_name, tooling_no, machine, note, dim_a)
           VALUES ($1, $2, $3, $4, 0)`, [ASSY, ASSY_NO, MACHINE, 'ASSY (SPH)']);
      }
      const fx = await c.query(`SELECT 1 FROM tooling_formula WHERE machine_id=$1 AND tooling_name=$2 AND output_key='A'`, [machineId, ASSY]);
      if (!fx.rows.length) {
        await c.query(
          `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, sort_order, description)
           VALUES ($1, $2, 'A', $3, 0, $4)`,
          [machineId, ASSY, ASSY_EXPR,
           'TEMPLATE_B SPH sheets list UNIVERSAL PALLET ASSY 4918-01 + 0001-99 at 3491; the plan uses it on every SPH C/N. Fixed drawing - gated to SPH classes (A41-A49) with a -999 sentinel elsewhere.']);
      }
      const rx = await c.query(`SELECT 1 FROM tooling_search_rule WHERE machine_id=$1 AND tooling_name=$2 AND output_key='A'`, [machineId, ASSY]);
      if (!rx.rows.length) {
        await c.query(
          `INSERT INTO tooling_search_rule
             (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus, sort_priority, label, inventory_tooling_filter, is_match_dim)
           VALUES ($1, $2::varchar, 'A', 'dim_a', 0.5, 0.5, 0, 'SPH gate (0 = applies)', $2::text, true)`, [machineId, ASSY]);
      }
    }
    await c.query('COMMIT');

    try { await engPool.query('DELETE FROM tselect_cn_cache'); console.log('tselect_cn_cache cleared'); }
    catch (e) { console.warn('tselect_cn_cache not cleared:', e.message); }

    console.log('-- after --', JSON.stringify(await state(c, machineId)));
    if (revert) { await recordRevert({ file: __filename }); return; }
    await recordRun({ file: __filename });
    console.log('\nundo with:  node api/engineer/mtc/db_migrations/20260921c_md_v9910wa_sph_universal_pallet_assy.js --revert');
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
