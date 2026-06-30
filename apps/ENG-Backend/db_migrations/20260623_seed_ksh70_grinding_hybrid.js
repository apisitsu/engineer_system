'use strict';
/**
 * Seed the KS-H70 GRINDING + LOADER tooling as a FORMULA + PART-NUMBER-LOOKUP **hybrid**:
 *   GRINDSTONE BASE (4691-04), GRIND STONE HOLDER (4691-01), GRINDSTONE (4691-20) — all
 *     size-driven hybrid (default size formula + parts_no override);
 *   JOINT (4691-10, the variable 0002/0003), LOADER END BLOCK (4907-01, part-specific),
 *     LOADER FINGER CHUCK (4907-03, OD-band) — categorical/lookup, OVERRIDE-ONLY (sentinel
 *     formula → appear only when the part has a parts_no mapping; loaders only exist for
 *     auto-feedable balls: 20<OD<40, ID≥12.7, 14<shoot<25 — the rest are 対応不可).
 *
 * Why hybrid (audit 2026-06-23, sheet `STONE HOLDER PART`):
 *  - The four grinding tools are ONE decision + a cascade. The only real choice is the
 *    grindstone SIZE; 4691-04 BASE (col G) and 4691-01 HOLDER (col M) are a VLOOKUP off it
 *    (base↔holder is 1:1 — 90.3% consistent live). 4691-10 sleeve/spring are constant.
 *  - The factory's OWN size formula (cell A8: smallest grindstone size strictly >
 *    ((肩径 if Y-ball else WIDTH) + 1)) reproduces only **59.2%** of actual usage — the other
 *    ~41% are manual sphere-contact overrides. A formula-only model would put wrong grinding
 *    specs on ~40% of SDS sheets (worse than blank). So:
 *      DEFAULT  = the official size formula  (sensible pick for parts with no history)
 *      OVERRIDE = `tooling_partno_map` per parts_no, sourced from the FACTORY-ACTUAL process
 *                 plans (`lpb.eng_r_pi_tool` 1241, joined control_no→eng_item.parts_no, mode per
 *                 part). This is the real ground truth — the engineering MASTER sheet diverges
 *                 from it ~20-45% (BASE/HOLDER 81%, GRINDSTONE 53%, loaders 57-68% vs factory),
 *                 so factory-actual is the correct source. Consulted by searchService
 *                 `_applyPartnoOverrides` AFTER the formula search.
 *
 * Inventory rows are keyed by grindstone size (dim_a). The DEFAULT formula computes the size
 * via lookup(); the OVERRIDE pins the exact 4691-04/01 the factory used. Restricted to bases/
 * holders that actually appear in the MASTER answer key so the default never emits a tool that
 * was never made.
 *
 * Idempotent — manages only its own tooling lines (GRINDSTONE BASE, GRIND STONE HOLDER) and the
 * KS-H70 partno_map rows from this source; the collet seed (20260612) owns COLLET/BODY/STOPPER.
 *
 * Run: node db_migrations/20260623_seed_ksh70_grinding_hybrid.js
 */

const path = require('path');
const ExcelJS = require('exceljs');
const { engPool } = require('../instance/eng_db');
const { maqPool } = require('../instance/maq_db');
const { TABLES } = require('../api/engineer/mtc/mtcConstants');

const INV_TABLE = 'tooling_ksh70';
const MACHINE_NAME = 'KS-H70';
const XLSX_PATH = path.join(__dirname, '../api/engineer/mtc/templates/Select_tool_backup/20210210_TOOLING LIST_SUPER SPHERE FINISH.xlsx');
const PARTNO_MAP = TABLES.TOOLING_PARTNO_MAP;
const SOURCE = 'eng_r_pi_tool_1241 (factory-actual)';

const TOOLING = {
  BASE: 'GRINDSTONE BASE',        // 4691-04 — size-driven hybrid (default formula + override)
  HOLDER: 'GRIND STONE HOLDER',   // 4691-01 — size-driven hybrid
  GRINDSTONE: 'GRINDSTONE',       // 4691-20 — size-driven hybrid (rough CBN cup wheel)
  JOINT: 'JOINT',                 // 4691-10 — categorical, OVERRIDE-ONLY (no dimensional formula)
  END_BLOCK: 'LOADER END BLOCK',  // 4907-01 — part-specific loader, OVERRIDE-ONLY
  FINGER_CHUCK: 'LOADER FINGER CHUCK', // 4907-03 — OD-band loader, OVERRIDE-ONLY (override = 100%)
  LOADER_05: 'LOADER 4907-05',    // 4907-05 — binary loader part (0001/0002), OVERRIDE-ONLY
  LOADER_06: 'LOADER 4907-06',    // 4907-06 — binary loader part (0001/0002), OVERRIDE-ONLY
};

const cellVal = (cell) => { let x = cell.value; if (x && typeof x === 'object') x = (x.result !== undefined ? x.result : (x.text !== undefined ? x.text : null)); return x; };
const sfx = (v, pre) => { if (v == null) return null; const m = String(v).match(new RegExp(pre + '-(\\d{4})')); return m ? m[1] : null; };

async function readSheet() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);

  // STONE HOLDER PART: A(1)=rough grindstone size, C(3)=4691-20 grindstone, G(7)=4691-04 base,
  // M(13)=4691-01 holder. Size→{grindstone,base,holder} are 1:1 (one row per rough size).
  const ws = wb.getWorksheet('STONE HOLDER PART');
  const sheet = [];
  for (let r = 16; r <= 59; r++) {
    const row = ws.getRow(r);
    const rough = Number(cellVal(row.getCell(1)));
    const grindstone = sfx(cellVal(row.getCell(3)), '4691-20');
    const base = sfx(cellVal(row.getCell(7)), '4691-04');
    const holder = sfx(cellVal(row.getCell(13)), '4691-01');
    if (!Number.isFinite(rough) || rough <= 0) continue;
    sheet.push({ rough, grindstone, base, holder });
  }

  return { sheet };
}

// FACTORY-ACTUAL answer key from lpb.eng_r_pi_tool (process 1241), keyed by parts_no via the
// control_no→eng_item join. This is what was REALLY used on the floor — the engineering MASTER
// sheet diverges from it ~20-45% (BASE/HOLDER 81%, GRINDSTONE 53%, loaders ~57-68%), so sourcing
// the overrides here lifts every tool to ≈100% vs the real ground truth. Per (parts_no, family)
// we take the MODE (most-used DWG) since a part ordered repeatedly can show minor variation.
async function readFactory() {
  const FAMILIES = ['4691-04', '4691-01', '4691-20', '4691-10', '4907-01', '4907-03', '4907-05', '4907-06'];
  const like = FAMILIES.map(f => `t.tool_dwg_no LIKE '${f}-%'`).join(' OR ');
  const { rows } = await maqPool.query(
    `SELECT i.parts_no, t.tool_dwg_no
       FROM lpb.eng_r_pi_tool t
       JOIN lpb.eng_item i ON i.control_no = t.process_plan_no
      WHERE t.process_code = '1241' AND i.parts_no IS NOT NULL AND (${like})`);

  // tally[family][parts_no][dwg] = count  → mode per (family, parts_no)
  const tally = {}, usedDwg = {};
  for (const f of FAMILIES) { tally[f] = {}; usedDwg[f] = new Set(); }
  for (const { parts_no, tool_dwg_no } of rows) {
    const dwg = tool_dwg_no.trim();
    const f = FAMILIES.find(x => dwg.startsWith(x + '-'));
    if (!f) continue;
    usedDwg[f].add(dwg);
    const pn = String(parts_no).trim();
    ((tally[f][pn] ??= {})[dwg] ??= 0, tally[f][pn][dwg]++);
  }
  const modeFor = (f) => {
    const out = {};
    for (const [pn, counts] of Object.entries(tally[f])) {
      out[pn] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    }
    return out; // parts_no -> dwg
  };
  return { FAMILIES, usedDwg, mode: Object.fromEntries(FAMILIES.map(f => [f, modeFor(f)])) };
}

// Default size formula: size = smallest grindstone size strictly > (driver + 1),
// driver = 肩径(≈SD) for Y-ball/inner balls else WIDTH. lookup(x,…) returns first item ≥ x,
// so (driver + 1.001) yields the first size > driver+1.
function buildSizeFormula(sizes) {
  const list = sizes.join(',');
  return `lookup(if(isBallInner, SD, W) + 1.001, ${list})`;
}

// Tool family → tooling line + whether it has a size-driven default formula.
const FAMILY = [
  { f: '4691-04', tool: TOOLING.BASE, sizeKey: 'base', sizeDriven: true },
  { f: '4691-01', tool: TOOLING.HOLDER, sizeKey: 'holder', sizeDriven: true },
  { f: '4691-20', tool: TOOLING.GRINDSTONE, sizeKey: 'grindstone', sizeDriven: true },
  { f: '4691-10', tool: TOOLING.JOINT, sizeDriven: false },
  { f: '4907-01', tool: TOOLING.END_BLOCK, sizeDriven: false },
  { f: '4907-03', tool: TOOLING.FINGER_CHUCK, sizeDriven: false },
  { f: '4907-05', tool: TOOLING.LOADER_05, sizeDriven: false },
  { f: '4907-06', tool: TOOLING.LOADER_06, sizeDriven: false },
];

async function run() {
  const { sheet } = await readSheet();
  const { usedDwg, mode } = await readFactory(); // factory-actual used DWGs + parts_no→dwg (mode)

  // Size-driven inventory (BASE/HOLDER/GRINDSTONE): one row per rough size → DWG, restricted to
  // FACTORY-used DWGs (so the default never emits a tool that was never run on the floor).
  const sizeRows = {}, sizeSet = {};
  for (const { tool, sizeDriven } of FAMILY) if (sizeDriven) { sizeRows[tool] = []; sizeSet[tool] = new Set(); }
  for (const s of sheet) {
    for (const { f, tool, sizeKey, sizeDriven } of FAMILY) {
      if (!sizeDriven || !s[sizeKey]) continue;
      const dwg = `${f}-${s[sizeKey]}`;
      if (usedDwg[f].has(dwg) && !sizeSet[tool].has(s.rough)) {
        sizeSet[tool].add(s.rough);
        sizeRows[tool].push([tool, dwg, s.rough]);
      }
    }
  }
  const sizes = (t) => [...sizeSet[t]].sort((a, b) => a - b);
  const baseRows = sizeRows[TOOLING.BASE], holderRows = sizeRows[TOOLING.HOLDER], grindRows = sizeRows[TOOLING.GRINDSTONE];

  // OVERRIDE-ONLY tools (JOINT, LOADER END BLOCK, LOADER FINGER CHUCK): no dimensional formula.
  // Inventory = the distinct factory-used DWGs with dim_a = 0; their formula emits the -999
  // sentinel whose ±GATE_TOL BETWEEN window [-1499,-499] excludes dim_a=0 → the default search
  // matches NOTHING, so they appear only when the parts_no override fills them. (dim_a must differ
  // from the sentinel, else it self-matches.)
  const OVERRIDE_ONLY = FAMILY.filter(x => !x.sizeDriven);
  const ovInvRows = [];
  for (const { f, tool } of OVERRIDE_ONLY) for (const dwg of usedDwg[f]) ovInvRows.push([tool, dwg, 0]);

  // partno_map override rows (one per parts_no per tooling), from the FACTORY-actual mode map.
  const mapRows = [];
  const partsNoSet = new Set();
  for (const { f, tool } of FAMILY) {
    for (const [pn, dwg] of Object.entries(mode[f])) {
      mapRows.push([MACHINE_NAME, tool, pn, dwg]);
      partsNoSet.add(pn);
    }
  }

  console.log(`factory-used DWGs: ${FAMILY.map(x => `${x.f}=${usedDwg[x.f].size}`).join(' ')}`);
  console.log(`inventory: BASE ${baseRows.length}, HOLDER ${holderRows.length}, GRINDSTONE ${grindRows.length} sizes; override-only dwgs ${ovInvRows.length}`);
  console.log(`partno_map overrides: ${mapRows.length} rows (${partsNoSet.size} distinct parts_no)`);

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    const mres = await client.query(`SELECT id FROM tooling_machine WHERE machine_name=$1`, [MACHINE_NAME]);
    if (!mres.rows.length) throw new Error(`machine ${MACHINE_NAME} not found — run the collet seed (20260612) first`);
    const machineId = mres.rows[0].id;

    const SIZE_TOOLS = [TOOLING.BASE, TOOLING.HOLDER, TOOLING.GRINDSTONE]; // size-driven hybrid
    const OV_TOOLS = OVERRIDE_ONLY.map(o => o.tool);                       // JOINT, END BLOCK, FINGER CHUCK
    const OWN = [...SIZE_TOOLS, ...OV_TOOLS];

    // ── inventory (only our tooling lines) ──
    await client.query(`DELETE FROM ${INV_TABLE} WHERE tooling_name = ANY($1::text[])`, [OWN]);
    for (const [name, no, a] of [...baseRows, ...holderRows, ...grindRows, ...ovInvRows]) {
      await client.query(
        `INSERT INTO ${INV_TABLE} (tooling_name, tooling_no, dim_a) VALUES ($1,$2,$3)`,
        [name, no, a]);
    }

    // ── formulas ──
    // size tools: default size = lookup() (≈59% fallback). override-only tools: sentinel -999 so
    // the default search matches nothing — they appear ONLY when the partno override fills them.
    await client.query(`DELETE FROM tooling_formula WHERE machine_id=$1 AND tooling_name = ANY($2::text[])`, [machineId, OWN]);
    for (const t of SIZE_TOOLS) {
      await client.query(
        `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, condition_expr, sort_order)
         VALUES ($1,$2,'A',$3,null,0)`, [machineId, t, buildSizeFormula(sizes(t))]);
    }
    for (const t of OV_TOOLS) {
      await client.query(
        `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, condition_expr, sort_order)
         VALUES ($1,$2,'A','-999',null,0)`, [machineId, t]);
    }

    // ── search rules (closest dim_a, shared-table filter) ──
    await client.query(`DELETE FROM tooling_search_rule WHERE machine_id=$1 AND tooling_name = ANY($2::text[])`, [machineId, OWN]);
    const SIZE_LABEL = 'Grindstone size (default; pinned by parts_no when known)';
    const OV_LABEL = 'Selected by parts_no only (no dimensional default)';
    const ruleLabel = Object.fromEntries([
      ...SIZE_TOOLS.map(t => [t, SIZE_LABEL]),
      ...OV_TOOLS.map(t => [t, OV_LABEL]),
    ]);
    // SIZE_TOOLS: rank-only (null tol) → always return a default. OV_TOOLS: wide tol (±GATE_TOL)
    // so the -999 sentinel is filtered out by the BETWEEN → they return NOTHING by default and
    // show up ONLY when the parts_no override fills them (a null tol would let the sentinel still
    // match the closest row). See the collet seed's GATE_TOL note.
    const GATE_TOL = 500;
    for (const t of OWN) {
      const tol = OV_TOOLS.includes(t) ? GATE_TOL : null;
      await client.query(
        `INSERT INTO tooling_search_rule
           (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus, sort_priority, label, is_match_dim, inventory_tooling_filter)
         VALUES ($1,$2,'A','dim_a',$5,$5,0,$3,true,$4)`,
        [machineId, t, ruleLabel[t], t, tol]);
    }

    // ── partno_map overrides ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${PARTNO_MAP} (
        id SERIAL PRIMARY KEY, machine_name TEXT NOT NULL, tooling_name TEXT NOT NULL,
        parts_no TEXT NOT NULL, tool_dwg_no TEXT NOT NULL,
        is_forbidden BOOLEAN NOT NULL DEFAULT false, note TEXT, source TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE (machine_name, tooling_name, parts_no, tool_dwg_no))`);
    // Replace ALL rows for these toolings (incl. any earlier MASTER-sourced rows from a prior run
    // of this migration); this migration fully owns the KS-H70 grinding/loader partno map.
    await client.query(
      `DELETE FROM ${PARTNO_MAP} WHERE machine_name=$1 AND tooling_name = ANY($2::text[])`,
      [MACHINE_NAME, OWN]);
    let mapN = 0;
    for (const [mn, tn, pn, dwg] of mapRows) {
      const res = await client.query(
        `INSERT INTO ${PARTNO_MAP} (machine_name, tooling_name, parts_no, tool_dwg_no, source)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (machine_name, tooling_name, parts_no, tool_dwg_no) DO NOTHING`,
        [mn, tn, pn, dwg, SOURCE]);
      mapN += res.rowCount;
    }

    await client.query('COMMIT');
    const invN = baseRows.length + holderRows.length + grindRows.length + ovInvRows.length;
    console.log(`✅ KS-H70 grinding+loader hybrid seeded (machine ${machineId}): ` +
      `${invN} inventory rows, ${SIZE_TOOLS.length + OV_TOOLS.length} formulas, ${mapN} partno_map rows`);
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
module.exports = { run, readSheet, buildSizeFormula };
