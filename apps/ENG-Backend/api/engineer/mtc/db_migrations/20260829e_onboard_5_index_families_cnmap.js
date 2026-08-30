'use strict';

/**
 * Onboard 5 index-flagged (`治具選定=1`) machines that had NO Tooling Select config.
 * ============================================================================
 * The Selection-Condition Conformance page (`20260202_Tooling_Excel_List.xlsm`)
 * lists these as `none` — flagged for jig selection but never onboarded. Their
 * per-machine workbooks live only on G: (calc blocks not vendored), so no formula
 * can be written. But every one has heavy factory-plan usage, so the shop's actual
 * fitment can be pinned per C/N — the FTL PUSHER OP1 / MSB pattern.
 *
 *   family  machine (SDS registry)   plan C/N  spec-covered   sub-families
 *   4007    QTN200                    904       875            4007-04 (868) · 4007-01 (72) · …
 *   4009    TM330                     969       948            4009-01 (969) · 4009-02 (962) · …
 *   4516    1MP-H                     895       796            4516-01 (895)
 *   4691    DTS-IS                    210       177            4691-01/02/03/04/18/19/…
 *   4863    NSV-1555FE                199       175            4863-01 (194) · 4863-02 (196)
 *
 * Per machine this migration:
 *   1. CREATEs `tooling_<slug>` (standard inventory shape — dims left NULL until the
 *      Okamoto/… workbook is vendored; they are unused on a cn-map-only machine).
 *   2. Fills it with the DISTINCT drawings the plan names, tooling_name = sub-family.
 *   3. INSERTs the `tooling_machine` row (machine_name === the SDS registry spelling,
 *      no group, enabled).
 *   4. `seedCnMapFromPlan` per sub-family — pins CN → drawing. A C/N whose plan lists
 *      two drawings of one sub-family is AMBIGUOUS and skipped (no rule to choose):
 *      4009 0 · 4516 2 · 4007 28 · 4691 62 · 4863 84.
 *
 * Result: mapped C/Ns get an exact pinned selection via `_applyLookupOnlyToolings`
 * (these toolings have no formula); unmapped C/Ns show empty, the documented
 * lookup-only behaviour. The ambiguous C/Ns and the missing dimensions stay a gap
 * pending the workbooks — see `api/engineer/mtc/doc/tooling_select_audit_findings.md` "รอบที่เจ็ด".
 *
 * NOT onboarded here: 4029 KS-450C (plan C/Ns are `C99-*` prototype dummies, no
 * spec rows) · 4800 その他 BONDING (adhesive — dimensional selection unconfirmed).
 *
 * Idempotent. `--revert` removes the cn-map rows, the `tooling_machine` row, and
 * DROPs the inventory table for all 5.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260829e_onboard_5_index_families_cnmap.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260829e_onboard_5_index_families_cnmap.js
 *   node api/engineer/mtc/db_migrations/20260829e_onboard_5_index_families_cnmap.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');
const { seedCnMapFromPlan, ensureCnMapSchema } = require('./lib/seedCnMapFromPlan');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const CFG = [
  { family: '4007', machine: 'QTN200',     table: 'tooling_qtn200',    label: 'QTN200 (BODY COLLET)' },
  { family: '4009', machine: 'TM330',      table: 'tooling_tm330',     label: 'TM330 (BBS KINMEI 巾切削)' },
  { family: '4516', machine: '1MP-H',      table: 'tooling_1mph',      label: '1MP-H (HYDRA GRIP 巾仕上)' },
  { family: '4691', machine: 'DTS-IS',     table: 'tooling_dtsis',     label: 'DTS-IS (SUPER SPHERE FINISH)' },
  { family: '4863', machine: 'NSV-1555FE', table: 'tooling_nsv1555fe', label: 'NSV-1555FE (SUGINO tap 治具)' },
];
const SOURCE = 'plan (index none-family onboard, round-7 2026-08-29)';

async function subFamilies(family) {
  const { rows } = await maqPool.query(
    `SELECT split_part(tool_dwg_no,'-',1)||'-'||split_part(tool_dwg_no,'-',2) AS sf,
            count(DISTINCT process_plan_no)::int cns
       FROM lpb.eng_r_pi_tool WHERE tool_dwg_no LIKE $1 GROUP BY 1 ORDER BY 2 DESC`,
    [`${family}-%`]);
  return rows.filter((r) => r.cns >= 1).map((r) => r.sf);
}

async function main() {
  if (await guard({ file: __filename, revert })) return;
  try {
    if (revert) {
      for (const c of CFG) {
        const d = await engPool.query(
          `DELETE FROM tooling_partno_map WHERE machine_name = $1 AND cn IS NOT NULL`, [c.machine]);
        const m = await engPool.query(
          `DELETE FROM tooling_machine WHERE machine_name = $1`, [c.machine]);
        await engPool.query(`DROP TABLE IF EXISTS ${c.table}`);
        console.log(`[onboard5] revert ${c.machine}: -${d.rowCount} map rows, -${m.rowCount} machine, dropped ${c.table}`);
      }
      await recordRevert({ file: __filename });
      return;
    }

    await ensureCnMapSchema(engPool);

    for (const c of CFG) {
      const subs = await subFamilies(c.family);
      console.log(`\n[onboard5] ${c.machine} (${c.family}) — sub-families: ${subs.join(', ')}`);

      // 1. inventory table
      if (!dryRun) {
        await engPool.query(`
          CREATE TABLE IF NOT EXISTS ${c.table} (
            id serial PRIMARY KEY,
            tooling_name text NOT NULL,
            tooling_no   text NOT NULL,
            machine      text,
            dim_a numeric, dim_b numeric, dim_c numeric,
            dim_d numeric, dim_e numeric, dim_f numeric,
            plan_derived boolean DEFAULT true
          )`);
      }

      // 2. populate drawings from the plan
      const { rows: dwgs } = await maqPool.query(
        `SELECT DISTINCT tool_dwg_no,
                split_part(tool_dwg_no,'-',1)||'-'||split_part(tool_dwg_no,'-',2) AS sf
           FROM lpb.eng_r_pi_tool WHERE tool_dwg_no LIKE $1 ORDER BY 1`, [`${c.family}-%`]);
      if (!dryRun && dwgs.length) {
        const vals = dwgs.flatMap((r) => [r.sf, r.tool_dwg_no.trim(), c.machine]);
        const ph = dwgs.map((_, i) => `($${i * 3 + 1},$${i * 3 + 2},$${i * 3 + 3})`).join(',');
        await engPool.query(
          `INSERT INTO ${c.table} (tooling_name, tooling_no, machine) VALUES ${ph}
           ON CONFLICT DO NOTHING`, vals);
      }
      console.log(`[onboard5]   ${dwgs.length} drawings ${dryRun ? '(dry)' : 'inserted'}`);

      // 3. tooling_machine row
      if (!dryRun) {
        await engPool.query(
          `INSERT INTO tooling_machine (machine_name, label, inventory_table, enabled)
           VALUES ($1,$2,$3,true)
           ON CONFLICT (machine_name) DO UPDATE SET inventory_table = EXCLUDED.inventory_table, enabled = true`,
          [c.machine, c.label, c.table]);
      }

      // 4. cn-map per sub-family
      let mapped = 0, ambiguous = 0;
      for (const sf of subs) {
        try {
          const s = await seedCnMapFromPlan({
            engPool, maqPool, machine: c.machine, tooling: sf, inventory: c.table,
            family: sf, source: SOURCE, dryRun,
          });
          mapped += s.mapped; ambiguous += s.ambiguous.length;
          console.log(`[onboard5]   ${sf.padEnd(9)} mapped=${s.mapped} inserted=${s.inserted || 0} ambiguous=${s.ambiguous.length}`);
        } catch (e) {
          console.log(`[onboard5]   ${sf.padEnd(9)} skip (${e.message})`);
        }
      }
      console.log(`[onboard5]   TOTAL ${c.machine}: mapped ${mapped}, ambiguous ${ambiguous}`);
    }

    if (dryRun) { console.log('\n[onboard5] --dry-run — no writes'); return; }
    await recordRun({ file: __filename });
    console.log('\n[onboard5] done');
  } finally {
    await engPool.end();
    await maqPool.end();
  }
}

main().catch((e) => { console.error('[onboard5] FAILED:', e.message); process.exit(1); });
