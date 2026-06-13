'use strict';
/**
 * Seed KS-H70 (SUPER SPHERE FINISH) into Tooling Select V2.
 *
 * Source: api/engineer/mtc/templates/Select_tool_backup/20210210_TOOLING LIST_SUPER SPHERE FINISH.xlsx
 * Factory process_code = 1241 (SPH SUPER FINISH). Machine in SDS: sds_machine_type_code
 * id 410 code 907 'KS-H70'.
 *
 * The machine super-finishes a spherical ball that is held by its BORE (ID) in a COLLET.
 * Selection is a BAND LOOKUP on the workpiece ID (sheet "COLEET&組合せ検索" rows 12-78),
 * which cascades to the COLLET BODY and STOPPER:
 *   COLLET (4691-19-7xxx) : the band [OD MIN, OD MAX] that contains the part ID
 *   COLLET BODY (4691-18-8xxx) : determined by the matched collet (col E)
 *   STOPPER (4691-02-00xx)     : 1st stopper for the matched collet (col F)
 * (The sheet's "OD MIN/MAX" columns are the collet's gripping-bore range = the part ID
 * range — the combination formula matches MASTER!G = ID against them.)
 *
 * Implementation: the factory only ever made 21 of the 67 design collets, so the
 * inventory is restricted to the bands of the FACTORY-USED collets (queried from
 * lpb.eng_r_pi_tool 1241 at seed time). Each used band → one COLLET + BODY + STOPPER row,
 * all keyed by the band's lower bound (OD MIN = dim_a), matched closest to the part ID.
 * This unifies the cascade (BODY/STOPPER follow the COLLET's band) and tracks how parts
 * were actually assigned to the nearest available collet. Validated vs the answer key:
 * COLLET 90.5%, COLLET BODY 96.1%, STOPPER 76.8% (the residual ≈ collets/stoppers the
 * factory swapped for an adjacent size, or 2nd-stopper choices). Matching by OD MIN beat
 * band-midpoint (parts cluster at standard bore sizes = band starts).
 *
 * Idempotent. Run: node db_migrations/20260612_seed_ksh70_tooling_select.js
 */

const path = require('path');
const ExcelJS = require('exceljs');
const { engPool } = require('../instance/eng_db');
const { maqPool } = require('../instance/maq_db');

const INV_TABLE = 'tooling_ksh70';
const MACHINE = { machine_name: 'KS-H70', label: 'KS-H70' };
const XLSX_PATH = path.join(__dirname, '../api/engineer/mtc/templates/Select_tool_backup/20210210_TOOLING LIST_SUPER SPHERE FINISH.xlsx');

// COLLET/BODY/STOPPER all match the workpiece ID against the band midpoint (dim_a).
const FORMULAS = {
  COLLET:      [{ key: 'A', expr: 'ID' }],
  'COLLET BODY': [{ key: 'A', expr: 'ID' }],
  STOPPER:     [{ key: 'A', expr: 'ID' }],
};
// [output_key, inventory_col, tol_plus, tol_minus, is_match_dim, label]
// dim_a = band OD MIN; rank-only (null tol) → closest used collet band to the part ID.
const RULES = {
  COLLET:        [['A', 'dim_a', null, null, true, 'Grip dia (ID → nearest band start)']],
  'COLLET BODY': [['A', 'dim_a', null, null, true, 'Grip dia (ID → nearest band start)']],
  STOPPER:       [['A', 'dim_a', null, null, true, 'Grip dia (ID → nearest band start)']],
};

async function readBands() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);
  const ws = wb.getWorksheet('COLEET&組合せ検索');
  const cell = (row, c) => { let x = row.getCell(c).value; if (x && typeof x === 'object') x = x.result ?? x.text ?? null; return x; };
  const bands = [];
  for (let r = 12; r <= 78; r++) {
    const row = ws.getRow(r);
    const collet = cell(row, 'A');
    if (collet == null || !/^\d{4}$/.test(String(collet).trim())) continue;
    const odmin = Number(cell(row, 'B')), odmax = Number(cell(row, 'C')), w = Number(cell(row, 'D'));
    const body = cell(row, 'E'), st1 = cell(row, 'F');
    if (!Number.isFinite(odmin) || !Number.isFinite(odmax)) continue;
    bands.push({
      collet: String(collet).trim(),
      odmin, odmax, mid: +((odmin + odmax) / 2).toFixed(3),
      w: Number.isFinite(w) ? w : null,
      body: body != null ? String(body).trim() : null,
      st1: st1 != null ? String(st1).trim() : null,
    });
  }
  return bands;
}

// dim_a = OD MIN (the MATCH dim, ranked closest to part ID); dim_b=W, dim_c=midpoint,
// dim_d=OD MAX (display).
function buildRows(bands) {
  const rows = [];
  for (const b of bands) {
    rows.push(['COLLET', `4691-19-${b.collet}`, b.odmin, b.w, b.mid, b.odmax]);
    if (b.body) rows.push(['COLLET BODY', `4691-18-${b.body}`, b.odmin, b.w, b.mid, b.odmax]);
    if (b.st1)  rows.push(['STOPPER', `4691-02-${b.st1}`, b.odmin, b.w, b.mid, b.odmax]);
  }
  return rows;
}

// Collets the factory actually used (process 1241) — the design table has 67 bands but
// only ~21 collets were ever made; restricting to them is what lifts accuracy.
async function usedColletSet() {
  const r = await maqPool.query(
    `SELECT DISTINCT tool_dwg_no FROM lpb.eng_r_pi_tool
     WHERE process_code='1241' AND tool_dwg_no LIKE '4691-19-%'`);
  return new Set(r.rows.map(x => x.tool_dwg_no.replace('4691-19-', '').trim()));
}

async function run() {
  const allBands = await readBands();
  const used = await usedColletSet();
  const bands = allBands.filter(b => used.has(b.collet));
  const rows = buildRows(bands);
  const idMin = Math.floor(Math.min(...bands.map(b => b.odmin)) - 0.5);
  const idMax = Math.ceil(Math.max(...bands.map(b => b.odmax)) + 0.5);
  console.log(`Read ${allBands.length} design bands; ${bands.length} factory-used → ${rows.length} inventory rows; ID range ${idMin}-${idMax}`);

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${INV_TABLE} (
        id SERIAL PRIMARY KEY,
        tooling_name VARCHAR,
        tooling_no   VARCHAR,
        dim_a NUMERIC,   -- band midpoint (grip dia) — MATCH dim
        dim_b NUMERIC,   -- collet width W
        dim_c NUMERIC,   -- band OD MIN (display)
        dim_d NUMERIC    -- band OD MAX (display)
      )`);
    await client.query(`DELETE FROM ${INV_TABLE}`);
    for (const [name, no, a, b, c, d] of rows) {
      await client.query(
        `INSERT INTO ${INV_TABLE} (tooling_name, tooling_no, dim_a, dim_b, dim_c, dim_d) VALUES ($1,$2,$3,$4,$5,$6)`,
        [name, no, a, b, c, d]);
    }

    const m = await client.query(
      `INSERT INTO tooling_machine (machine_name, label, inventory_table, inventory_machine_filter, machine_group, enabled)
       VALUES ($1,$2,$3,null,null,true)
       ON CONFLICT (machine_name) DO UPDATE SET label=EXCLUDED.label,
         inventory_table=EXCLUDED.inventory_table, enabled=true, updated_at=now()
       RETURNING id`,
      [MACHINE.machine_name, MACHINE.label, INV_TABLE]);
    const id = m.rows[0].id;

    await client.query(`DELETE FROM tooling_machine_limit WHERE machine_id=$1`, [id]);
    await client.query(
      `INSERT INTO tooling_machine_limit (machine_id, input_var, min_value, max_value, min_inclusive, max_inclusive, sort_order)
       VALUES ($1,'ID',$2,$3,true,true,0)`, [id, idMin, idMax]);

    await client.query(`DELETE FROM tooling_formula WHERE machine_id=$1`, [id]);
    for (const [tooling, frows] of Object.entries(FORMULAS)) {
      let order = 0;
      for (const r of frows) {
        await client.query(
          `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, condition_expr, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6)`, [id, tooling, r.key, r.expr, r.cond || null, order++]);
      }
    }

    await client.query(`DELETE FROM tooling_search_rule WHERE machine_id=$1`, [id]);
    for (const [tooling, rules] of Object.entries(RULES)) {
      let prio = 0;
      for (const [key, col, tolP, tolM, matchDim, label] of rules) {
        await client.query(
          `INSERT INTO tooling_search_rule
             (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus, sort_priority, label, is_match_dim, inventory_tooling_filter)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [id, tooling, key, col, tolP, tolM, prio++, label, matchDim, tooling]);
      }
    }

    await client.query('COMMIT');
    console.log(`✅ KS-H70 seeded (machine id ${id}); ${rows.length} inventory rows`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ seed failed:', e.message);
    throw e;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(() => process.exit(1));
}
module.exports = { run, readBands };
