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

// Two collet families, split by the part ID at ID_SPLIT (there is a real gap between the
// 4691-03 max band [12,12.5] and the 4691-19 min band [12.7,…]):
//   COLLET / BODY / STOPPER  = the AC collet 4691-19 (large balls, ID ≥ 12.6)
//   COLLET (A)               = the small drawbar collet 4691-03 (small balls, ID 4–12.5)
// Each branch is gated with the -999 sentinel so the OTHER family's parts produce no match
// (a bare `ID` would otherwise let a small ball match the smallest 4691-19 band, and vice
// versa). All match the workpiece ID against the band start (dim_a).
const ID_SPLIT = 12.6;
const FORMULAS = {
  COLLET:        [{ key: 'A', expr: `if(ID >= ${ID_SPLIT}, ID, -999)` }],
  'COLLET BODY': [{ key: 'A', expr: `if(ID >= ${ID_SPLIT}, ID, -999)` }],
  STOPPER:       [{ key: 'A', expr: `if(ID >= ${ID_SPLIT}, ID, -999)` }],
  'COLLET (A)':  [{ key: 'A', expr: `if(ID < ${ID_SPLIT}, ID, -999)` }],
};
// [output_key, inventory_col, tol_plus, tol_minus, is_match_dim, label]
// dim_a = band OD MIN; ranked closest to the part ID. The tolerance is WIDE (±GATE_TOL) on
// purpose: real band starts (3–38) always fall inside [ID±GATE_TOL] so ranking is unrestricted
// (= the old rank-only closest match), but the gated-out family's -999 sentinel falls far
// outside the BETWEEN window → that family correctly returns NO match. A null tolerance can't
// do this (no WHERE filter → the search returns the closest row regardless of the sentinel).
const GATE_TOL = 500;
const RULES = {
  COLLET:        [['A', 'dim_a', GATE_TOL, GATE_TOL, true, 'Grip dia (ID → nearest band start)']],
  'COLLET BODY': [['A', 'dim_a', GATE_TOL, GATE_TOL, true, 'Grip dia (ID → nearest band start)']],
  STOPPER:       [['A', 'dim_a', GATE_TOL, GATE_TOL, true, 'Grip dia (ID → nearest band start)']],
  'COLLET (A)':  [['A', 'dim_a', GATE_TOL, GATE_TOL, true, 'Grip bore (small-ball ID → nearest band start)']],
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

// COLLET (A) 4691-03 — the small-ball drawbar collet. Sheet `(工事中)COLLET対応表` rows 9-27 is
// an ID-band table (cols labeled "OD" are actually the grip-BORE = part ID, same trap as 4691-19):
// A=ID min, B=ID max, C=4691-03-XXXX. Validated 83.3% vs live (closest band start, used-only).
async function read03Bands() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);
  const ws = wb.getWorksheet('(工事中)COLLET対応表');
  const cell = (row, c) => { let x = row.getCell(c).value; if (x && typeof x === 'object') x = x.result ?? x.text ?? null; return x; };
  const bands = [];
  for (let r = 9; r <= 27; r++) {
    const row = ws.getRow(r);
    const idmin = Number(cell(row, 1)), idmax = Number(cell(row, 2));
    const dwg = cell(row, 3);
    if (!Number.isFinite(idmin)) continue;
    const m = dwg != null && String(dwg).match(/4691-03-(\d{4})/);
    if (!m) continue;
    bands.push({ collet: m[1], odmin: idmin, odmax: Number.isFinite(idmax) ? idmax : idmin });
  }
  return bands;
}

async function used03Set() {
  const r = await maqPool.query(
    `SELECT DISTINCT tool_dwg_no FROM lpb.eng_r_pi_tool
     WHERE process_code='1241' AND tool_dwg_no LIKE '4691-03-%'`);
  return new Set(r.rows.map(x => x.tool_dwg_no.replace('4691-03-', '').trim()));
}

// COLLET (A) inventory: one row per used 4691-03 band (dedup by band start). dim_a = ID band start.
function build03Rows(bands) {
  const rows = [];
  const seen = new Set();
  for (const b of bands) {
    if (seen.has(b.odmin)) continue;
    seen.add(b.odmin);
    rows.push(['COLLET (A)', `4691-03-${b.collet}`, b.odmin, null, b.odmin, b.odmax]);
  }
  return rows;
}

async function run() {
  const allBands = await readBands();
  const used = await usedColletSet();
  const bands = allBands.filter(b => used.has(b.collet));

  // COLLET (A) 4691-03 — small-ball collets (ID 4–12.5), complementary to 4691-19.
  const all03 = await read03Bands();
  const used03 = await used03Set();
  const bands03 = all03.filter(b => used03.has(b.collet));
  const rows = [...buildRows(bands), ...build03Rows(bands03)];

  // ID-eligibility spans BOTH families now (4691-03 reaches down to ~4 mm) so small balls
  // aren't gated out of the machine before COLLET (A) can match them.
  const allOdmin = [...bands, ...bands03].map(b => b.odmin);
  const allOdmax = [...bands, ...bands03].map(b => b.odmax);
  const idMin = Math.floor(Math.min(...allOdmin) - 0.5);
  const idMax = Math.ceil(Math.max(...allOdmax) + 0.5);
  console.log(`Read ${allBands.length} design bands (${bands.length} used) + ${all03.length} small-ball bands (${bands03.length} used) → ${rows.length} inventory rows; ID range ${idMin}-${idMax}`);

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
    // Scope deletes to THIS seed's tooling lines so the companion grinding-hybrid
    // migration (20260623) can manage GRINDSTONE BASE / GRIND STONE HOLDER in the
    // same machine/tables without either seed clobbering the other on re-run.
    const OWN = Object.keys(FORMULAS); // COLLET, COLLET BODY, STOPPER
    await client.query(`DELETE FROM ${INV_TABLE} WHERE tooling_name = ANY($1)`, [OWN]);
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

    await client.query(`DELETE FROM tooling_formula WHERE machine_id=$1 AND tooling_name = ANY($2)`, [id, OWN]);
    for (const [tooling, frows] of Object.entries(FORMULAS)) {
      let order = 0;
      for (const r of frows) {
        await client.query(
          `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, condition_expr, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6)`, [id, tooling, r.key, r.expr, r.cond || null, order++]);
      }
    }

    await client.query(`DELETE FROM tooling_search_rule WHERE machine_id=$1 AND tooling_name = ANY($2)`, [id, OWN]);
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
