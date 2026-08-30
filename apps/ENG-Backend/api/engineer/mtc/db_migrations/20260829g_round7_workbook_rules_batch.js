'use strict';

/**
 * Round-7 workbook follow-through — 3 independent pieces from the 2026-08-29 G: extract.
 * ============================================================================
 * A. DTS-IS 4691-18 COLLET BODY — 5-band OD-range rule (COLLET_BODY.tsv). Pairs with
 *    the 4691-19 bands from `20260829f_`; coarser (5 vs 67 bands). `+0` containment.
 * B. NSV-1555FE 4863-02 センタピン — `寸法算出` shows pin dia (軸径 K) = ID − 0.05 on
 *    all 12 sampled figures. Formula `A = ID - 0.05`, nearest match; dims loaded for
 *    the 12 the sheet gives (the other ~52 shelf rows stay cn-map-only).
 * C. Onboard 4800 BONDING (接着) as machine `その他` (SDS registry code 800). The
 *    `DIMENSION` sheet is a C/N answer key (BONDING PLATE 4800-66-, GUIDE RING
 *    4800-38-), not a dimensional rule — so cn-map only, same as `20260829e_`.
 *
 * NOT done here, with reason:
 *   • 4516 1MP-H — `Sheet2` is a 図番→型式 model list with NO dimensions; the
 *     `20260829e_` cn-map already covers 4516-01. Nothing to add.
 *   • bulk DIMENSION→dim load for Phase B/C — a non-issue: those inventory tables are
 *     already 80–100 % populated (audited 2026-08-29). The only 0 %-dim tables
 *     (1mph / nsv1555fe / qtn200 / tm330) have no usable DIMENSION sheet.
 *
 * Idempotent. `--revert` undoes all three.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260829g_round7_workbook_rules_batch.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260829g_round7_workbook_rules_batch.js
 *   node api/engineer/mtc/db_migrations/20260829g_round7_workbook_rules_batch.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');
const { seedCnMapFromPlan, ensureCnMapSchema } = require('./lib/seedCnMapFromPlan');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

// Parsed from `doc/tooling_calc_blocks/{4691/COLLET_BODY, 4863/寸法算出}` and vendored as
// JSON so this migration is self-contained (the source TSVs/PDFs can be gitignored).
// Re-derive with scripts/dump_tooling_calc_blocks.ps1.
const colletBody = () => require('./data/dtsis_4691.json').collet_body_18;
const centerPins = () => require('./data/nsv1555fe_4863.json').center_pin_02;

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    const midDts = (await client.query(`SELECT id FROM tooling_machine WHERE machine_name='DTS-IS'`)).rows[0].id;
    const midNsv = (await client.query(`SELECT id FROM tooling_machine WHERE machine_name='NSV-1555FE'`)).rows[0].id;

    if (revert) {
      await client.query(`DELETE FROM tooling_formula WHERE machine_id=$1 AND tooling_name='4691-18'`, [midDts]);
      await client.query(`DELETE FROM tooling_search_rule WHERE machine_id=$1 AND tooling_name='4691-18'`, [midDts]);
      await client.query(`DELETE FROM tooling_dtsis WHERE tooling_name='4691-18' AND plan_derived=false`);
      await client.query(`UPDATE tooling_dtsis SET dim_a=NULL,dim_b=NULL,dim_c=NULL WHERE tooling_name='4691-18'`);
      await client.query(`DELETE FROM tooling_formula WHERE machine_id=$1 AND tooling_name='4863-02'`, [midNsv]);
      await client.query(`DELETE FROM tooling_search_rule WHERE machine_id=$1 AND tooling_name='4863-02'`, [midNsv]);
      await client.query(`DELETE FROM tooling_nsv1555fe WHERE tooling_name='4863-02' AND plan_derived=false`);
      await client.query(`UPDATE tooling_nsv1555fe SET dim_a=NULL WHERE tooling_name='4863-02'`);
      const d1 = await client.query(`DELETE FROM tooling_partno_map WHERE machine_name='その他' AND cn IS NOT NULL`);
      const d2 = await client.query(`DELETE FROM tooling_machine WHERE machine_name='その他'`);
      await client.query(`DROP TABLE IF EXISTS tooling_sonota`);
      console.log(`[r7g] revert: 4691-18 + 4863-02 config removed; その他 -${d1.rowCount} map, -${d2.rowCount} machine, table dropped`);
      if (dryRun) { await client.query('ROLLBACK'); return; }
      await client.query('COMMIT');
      await recordRevert({ file: __filename });
      return;
    }

    // ── A. 4691-18 COLLET BODY ──────────────────────────────────────────────
    const bands = colletBody();
    await client.query(`DELETE FROM tooling_formula WHERE machine_id=$1 AND tooling_name='4691-18'`, [midDts]);
    await client.query(`DELETE FROM tooling_search_rule WHERE machine_id=$1 AND tooling_name='4691-18'`, [midDts]);
    await client.query(`DELETE FROM tooling_dtsis WHERE tooling_name='4691-18' AND plan_derived=false`);
    for (const b of bands) {
      const upd = await client.query(
        `UPDATE tooling_dtsis SET dim_a=$2::numeric,dim_b=$3::numeric,dim_c=$4::numeric
          WHERE tooling_name='4691-18' AND tooling_no=$1::text`, [b.no, b.min, b.max, b.w]);
      if (!upd.rowCount) await client.query(
        `INSERT INTO tooling_dtsis (tooling_name,tooling_no,machine,dim_a,dim_b,dim_c,plan_derived)
         VALUES ('4691-18',$1::text,'DTS-IS',$2::numeric,$3::numeric,$4::numeric,false)`, [b.no, b.min, b.max, b.w]);
    }
    await client.query(
      `INSERT INTO tooling_formula (machine_id,tooling_name,output_key,formula_expr,sort_order,description)
       VALUES ($1,'4691-18','A','OD',0,'COLLET BODY band — workpiece OD (COLLET_BODY sheet 把握径)'),
              ($1,'4691-18','Amax','OD',1,'COLLET BODY band ceiling key')`, [midDts]);
    await client.query(
      `INSERT INTO tooling_search_rule (machine_id,tooling_name,output_key,inventory_column,tol_plus,tol_minus,is_match_dim,inventory_tooling_filter,label)
       VALUES ($1,'4691-18','A','dim_a',0,NULL,true,'4691-18','body band min ≤ OD'),
              ($1,'4691-18','Amax','dim_b',NULL,0,true,'4691-18','body band max ≥ OD')`, [midDts]);
    console.log(`[r7g] A: 4691-18 — ${bands.length} bands + rule`);

    // ── B. 4863-02 センタピン ──────────────────────────────────────────────
    const pins = centerPins();
    await client.query(`DELETE FROM tooling_formula WHERE machine_id=$1 AND tooling_name='4863-02'`, [midNsv]);
    await client.query(`DELETE FROM tooling_search_rule WHERE machine_id=$1 AND tooling_name='4863-02'`, [midNsv]);
    await client.query(`DELETE FROM tooling_nsv1555fe WHERE tooling_name='4863-02' AND plan_derived=false`);
    let loaded = 0;
    for (const p of pins) {
      const u = await client.query(
        `UPDATE tooling_nsv1555fe SET dim_a=$2::numeric WHERE tooling_name='4863-02' AND tooling_no=$1::text`,
        [p.no, p.dia]);
      if (u.rowCount) { loaded += 1; continue; }
      await client.query(
        `INSERT INTO tooling_nsv1555fe (tooling_name,tooling_no,machine,dim_a,plan_derived)
         VALUES ('4863-02',$1::text,'NSV-1555FE',$2::numeric,false)`, [p.no, p.dia]);
      loaded += 1;
    }
    await client.query(
      `INSERT INTO tooling_formula (machine_id,tooling_name,output_key,formula_expr,sort_order,description)
       VALUES ($1,'4863-02','A','ID - 0.05',0,'センタピン pin dia = 内径 − 0.05 (寸法算出 sheet, 12/12)')`, [midNsv]);
    await client.query(
      `INSERT INTO tooling_search_rule (machine_id,tooling_name,output_key,inventory_column,tol_plus,tol_minus,is_match_dim,inventory_tooling_filter,label)
       VALUES ($1,'4863-02','A','dim_a',0.3,0.3,true,'4863-02','pin dia ≈ ID − 0.05')`, [midNsv]);
    console.log(`[r7g] B: 4863-02 — ${loaded}/${pins.length} shelf rows got a dim + rule`);

    // ── C. onboard 4800 BONDING as その他 ──────────────────────────────────
    await ensureCnMapSchema(engPool);
    await client.query(`
      CREATE TABLE IF NOT EXISTS tooling_sonota (
        id serial PRIMARY KEY, tooling_name text NOT NULL, tooling_no text NOT NULL, machine text,
        dim_a numeric, dim_b numeric, dim_c numeric, dim_d numeric, dim_e numeric, dim_f numeric,
        plan_derived boolean DEFAULT true)`);
    const { rows: dwgs } = await maqPool.query(
      `SELECT DISTINCT tool_dwg_no, split_part(tool_dwg_no,'-',1)||'-'||split_part(tool_dwg_no,'-',2) sf
         FROM lpb.eng_r_pi_tool WHERE tool_dwg_no LIKE '4800-38-%' OR tool_dwg_no LIKE '4800-66-%' ORDER BY 1`);
    for (const r of dwgs) {
      const has = await client.query(`SELECT 1 FROM tooling_sonota WHERE tooling_no=$1::text`, [r.tool_dwg_no.trim()]);
      if (!has.rowCount) await client.query(
        `INSERT INTO tooling_sonota (tooling_name,tooling_no,machine) VALUES ($1::text,$2::text,'その他')`,
        [r.sf, r.tool_dwg_no.trim()]);
    }
    await client.query(
      `INSERT INTO tooling_machine (machine_name,label,inventory_table,enabled)
       VALUES ('その他','その他 (4800 BONDING / 接着)','tooling_sonota',true)
       ON CONFLICT (machine_name) DO UPDATE SET inventory_table=EXCLUDED.inventory_table, enabled=true`);
    console.log(`[r7g] C: その他 onboarded, ${dwgs.length} drawings`);
    if (!dryRun) {
      await client.query('COMMIT');
      for (const sf of ['4800-38', '4800-66']) {
        const s = await seedCnMapFromPlan({
          engPool, maqPool, machine: 'その他', tooling: sf, inventory: 'tooling_sonota',
          family: sf, source: 'plan (4800 BONDING onboard, round-7 2026-08-29)', dryRun: false,
        });
        console.log(`[r7g] C: ${sf} cn-map ${s.inserted} rows (ambiguous ${s.ambiguous.length})`);
      }
      await recordRun({ file: __filename });
      console.log('[r7g] done');
      return;
    }
    console.log('[r7g] --dry-run — ROLLBACK'); await client.query('ROLLBACK');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await engPool.end();
    await maqPool.end();
  }
}

main().catch((e) => { console.error('[r7g] FAILED:', e.message); process.exit(1); });
