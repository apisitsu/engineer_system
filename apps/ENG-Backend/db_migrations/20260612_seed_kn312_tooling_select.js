'use strict';
/**
 * Seed KN-312A / KN-312B (arbor-mount OD grind) into Tooling Select V2.
 *
 * Tooling: ARBOR 4828-01 + NUT 4828-02 (イズミ Izumi arbor). The part mounts on the
 * ARBOR by its BORE (ID); the NUT clamps it; the OD is ground (factory process_code 1041).
 *
 * DWG formulas (provided 2026-06-12). SELECTION is by the part bore — proven from the
 * factory answer key: CNs sharing an arbor cluster tightly by id_aft (e.g. 4828-01-0042 ←
 * 20 CNs all bore 19.05; 4828-01-0111 ← 15 CNs all 25.40). So:
 *   ARBOR  D3 = idAft_min − 0.01   (fit dia just under the bore)  → MATCH dim
 *          D2 = SD − 0.5           (shoulder seat, display)
 *   NUT    C  = idAft_min + 0.09   (bore-tracking; = ARBOR D3 + 0.1) → MATCH dim
 *          B  = SD − 0.5  (= ARBOR D2),  A = SD + 7.5  (= B + 8)     (display)
 *
 * INVENTORY is REVERSE-ENGINEERED at seed time from the factory answer key
 * (lpb.eng_r_pi_tool proc 1041 → CN → tooling_spec_process SD/idAft_min): each distinct
 * 4828-01/02 tool's match dim = the median bore of the CNs that use it. This is the same
 * [RE] approach as KS-400B6 — validated below against the answer key (a different CN with
 * the same bore must re-select the factory tool), NOT a hollow self-match.
 *
 * TYPE 1–4 (affects only DISPLAY dims D4/F/G/H/L1, NOT selection): the source gives no
 * classification rule, so a HYPOTHESIS keyed on SD bands (≤10 / ≤30 / >30, drawn from the
 * deterministic thresholds in J@D2<45, K@D2<30, L3@SD≤10/≤46) is used and FLAGGED. Wrong
 * TYPE only changes a displayed secondary value, never which tool is picked.
 *
 * Idempotent. Run: node db_migrations/20260612_seed_kn312_tooling_select.js
 */

const { engPool } = require('../instance/eng_db');
const { maqPool } = require('../instance/maq_db');
const cnFormat = require('../api/engineer/mtc/utils/cnFormat');

const INV_TABLE = 'tooling_kn312';
const MACHINES = [
  { machine_name: 'KN-312A', label: 'KN-312A' },
  { machine_name: 'KN-312B', label: 'KN-312B' },
];

// One row PER TYPE branch (condition_expr gated) — mirrors the DWG's discrete
// "TYPE 1: X / TYPE 2: Y / TYPE 3,4: Z" structure and FormulaService's "first matching
// condition wins, per output_key" model. An explicit T (= TYPE 1/2/3/4) is computed from
// the spec's own thresholds (T1=SD≤10 [L3 band1 / "M5↓ no relief"], T2=D2<30 [K's R3 region],
// T3=D2≥30 & SD≤46, T4=SD>46) and every TYPE-branched dim is gated on it.
const FORMULAS = {
  ARBOR: [
    { key: 'D2', expr: 'SD - 0.5' },                         // shoulder seat (display)
    { key: 'D3', expr: 'idAft_min - 0.01' },                 // fit dia (primary MATCH)
    { key: 'P',  expr: 'W' },                                // width (secondary MATCH — breaks bore ties)
    { key: 'Q',  expr: 'OD' },                               // OD (secondary MATCH — breaks bore ties)
    { key: 'T',  expr: 'if(SD <= 10, 1, if(D2 < 30, 2, if(SD <= 46, 3, 4)))' }, // explicit TYPE 1/2/3/4
    { key: 'D1', expr: '46', cond: 'D2 < 45' },              // D2≥45 → None
    { key: 'L3', expr: '10', cond: 'SD <= 10' },             // SD≤10 → 10
    { key: 'L3', expr: '15', cond: 'SD <= 46' },             // 10<SD≤46 → 15 (else None)
    // F = chamfer/radius (numeric): TYPE1 "1~2×15°" chamfer (text → None) · TYPE2 R1.5 · TYPE3,4 R3
    { key: 'F',  expr: '1.5', cond: 'T == 2' },
    { key: 'F',  expr: '3',   cond: 'T >= 3' },
    // D4: TYPE1 None · TYPE2,3,4 = D3 − F×2
    { key: 'D4', expr: 'D3 - F * 2', cond: 'T >= 2' },
    // G: TYPE1 None · TYPE2 3 · TYPE3,4 6
    { key: 'G',  expr: '3', cond: 'T == 2' },
    { key: 'G',  expr: '6', cond: 'T >= 3' },
    // H: TYPE1 None · TYPE2 4.5 · TYPE3,4 7.5
    { key: 'H',  expr: '4.5', cond: 'T == 2' },
    { key: 'H',  expr: '7.5', cond: 'T >= 3' },
    // L1: TYPE1,2 ceil(W+4) · TYPE3,4 ceil(W+7)
    { key: 'L1', expr: 'ceil(W + 4)', cond: 'T <= 2' },
    { key: 'L1', expr: 'ceil(W + 7)', cond: 'T >= 3' },
    { key: 'L',  expr: 'L1 + 67' },                          // L1 + L2(17, mid 15~20) + 50
  ],
  NUT: [
    { key: 'B',  expr: 'SD - 0.5' },           // = ARBOR D2 (display)
    { key: 'A',  expr: 'SD + 7.5' },           // = B + 8 (display)
    { key: 'C',  expr: 'idAft_min + 0.09' },   // = ARBOR D3 + 0.1 (primary MATCH, bore-tracking)
    { key: 'P',  expr: 'W' },                  // width (secondary MATCH — breaks bore ties)
    { key: 'L1', expr: '15' },                 // const
    { key: 'L2', expr: '10' },                 // const
    { key: 'L',  expr: '25' },                 // L1 + 10
    { key: 'T',  expr: 'if(B < 30, 1, 2)' },   // NUT TYPE 1/2 (B = arbor D2; TYPE2 = larger c'bore nut)
    // F: TYPE1 None · TYPE2 (L − L1)/2
    { key: 'F',  expr: '(L - L1) / 2', cond: 'T == 2' },
  ],
};

// [output_key, inventory_col, tol_plus, tol_minus, is_match_dim, label]
const RULES = {
  ARBOR: [
    ['D3', 'dim_a', 0.5, 0.5, true,  'Fit dia D3 (bore − 0.01)'],  // primary gate + rank
    ['D2', 'dim_b', null, null, false, 'Shoulder D2'],             // display
    ['P',  'dim_c', null, null, true,  'Width (tie-break)'],       // rank-only secondary
    ['Q',  'dim_d', null, null, true,  'OD (tie-break)'],          // rank-only secondary
  ],
  NUT: [
    ['C', 'dim_a', 0.5, 0.5, true,  'Bore C (bore + 0.09)'],   // primary gate + rank
    ['B', 'dim_b', null, null, false, 'B (= arbor D2)'],        // display
    ['A', 'dim_c', null, null, false, 'A (B + 8)'],             // display
    ['P', 'dim_d', null, null, true,  'Width (tie-break)'],     // rank-only secondary
  ],
};

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Build the answer key (tool → CNs) and RE the inventory match dim per tool.
async function reverseEngineerInventory() {
  const rpt = await maqPool.query(`
    SELECT tool_dwg_no, process_plan_no AS cn FROM lpb.eng_r_pi_tool
    WHERE (tool_dwg_no LIKE '4828-01-%' OR tool_dwg_no LIKE '4828-02-%') AND process_code = '1041'`);
  const pairs = rpt.rows
    .map(r => ({ tool: r.tool_dwg_no, cn: cnFormat.toSpecCn(r.cn) }))
    .filter(p => p.cn);
  const specCns = [...new Set(pairs.map(p => p.cn))];
  const sp = await engPool.query(
    `SELECT cn, sd, id_aft, id_aft_min, od_aft, w_aft FROM ${'tooling_spec_process'} WHERE cn = ANY($1)`, [specCns]);
  const spec = Object.fromEntries(sp.rows.map(r => [r.cn, r]));

  // idAft_min exactly as buildSpecContext computes it (id_aft + signed min delta)
  const idMin = (r) => Number(r.id_aft) + Number(r.id_aft_min || 0);
  const med = (xs) => { const v = xs.filter(x => x > 0); return v.length ? median(v) : null; };

  const byTool = {};   // tool → { bores:[], sds:[], ws:[], ods:[] }
  const answerKey = {}; // cn → { ARBOR, NUT }
  for (const p of pairs) {
    const r = spec[p.cn];
    if (!r || !(Number(r.id_aft) > 0)) continue;
    (byTool[p.tool] = byTool[p.tool] || { bores: [], sds: [], ws: [], ods: [] });
    byTool[p.tool].bores.push(idMin(r));
    byTool[p.tool].sds.push(Number(r.sd) || 0);
    byTool[p.tool].ws.push(Number(r.w_aft) || 0);
    byTool[p.tool].ods.push(Number(r.od_aft) || 0);
    const kind = p.tool.startsWith('4828-01') ? 'ARBOR' : 'NUT';
    (answerKey[p.cn] = answerKey[p.cn] || {})[kind] = p.tool;
  }

  const rows = []; // [tooling_name, tooling_no, dim_a, dim_b, dim_c, dim_d]
  for (const [tool, d] of Object.entries(byTool)) {
    if (d.bores.length === 0) continue;
    const bore = +median(d.bores).toFixed(3);
    const sd = med(d.sds) != null ? +med(d.sds).toFixed(3) : null;
    const w  = med(d.ws)  != null ? +med(d.ws).toFixed(3)  : null;
    const od = med(d.ods) != null ? +med(d.ods).toFixed(3) : null;
    if (tool.startsWith('4828-01')) {
      // ARBOR: dim_a=D3(bore−0.01), dim_b=D2(SD−0.5), dim_c=W, dim_d=OD (tie-breakers)
      rows.push(['ARBOR', tool, +(bore - 0.01).toFixed(3), sd != null ? +(sd - 0.5).toFixed(3) : null, w, od]);
    } else {
      // NUT: dim_a=C(bore+0.09), dim_b=B(SD−0.5), dim_c=A(SD+7.5), dim_d=W
      rows.push(['NUT', tool, +(bore + 0.09).toFixed(3), sd != null ? +(sd - 0.5).toFixed(3) : null, sd != null ? +(sd + 7.5).toFixed(3) : null, w]);
    }
  }
  return { rows, answerKey, spec, idMin };
}

async function run() {
  const { rows, answerKey, spec, idMin } = await reverseEngineerInventory();
  const arbors = rows.filter(r => r[0] === 'ARBOR');
  const nuts   = rows.filter(r => r[0] === 'NUT');
  console.log(`RE inventory: ${arbors.length} ARBOR + ${nuts.length} NUT (from answer key)`);

  // Eligibility limits from the answer-key bore range (a little headroom).
  const allBores = rows.map(r => r[2]).filter(Boolean);
  const idMinLim = Math.max(0, Math.floor(Math.min(...allBores) - 1));
  const idMaxLim = Math.ceil(Math.max(...allBores) + 2);

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${INV_TABLE} (
        id SERIAL PRIMARY KEY,
        tooling_name VARCHAR,
        tooling_no   VARCHAR,
        dim_a NUMERIC,   -- ARBOR D3 (fit dia) | NUT C (bore) — primary MATCH dim
        dim_b NUMERIC,   -- ARBOR D2 | NUT B (= arbor D2)
        dim_c NUMERIC,   -- ARBOR W | NUT A (B+8)
        dim_d NUMERIC    -- ARBOR OD | NUT W  — tie-break
      )`);
    // add dim_d if the table pre-existed without it
    await client.query(`ALTER TABLE ${INV_TABLE} ADD COLUMN IF NOT EXISTS dim_d NUMERIC`);
    await client.query(`DELETE FROM ${INV_TABLE}`);
    for (const [name, no, a, b, c, d] of rows) {
      await client.query(
        `INSERT INTO ${INV_TABLE} (tooling_name, tooling_no, dim_a, dim_b, dim_c, dim_d) VALUES ($1,$2,$3,$4,$5,$6)`,
        [name, no, a, b, c, d]);
    }

    const machineIds = [];
    for (const M of MACHINES) {
      const m = await client.query(
        `INSERT INTO tooling_machine (machine_name, label, inventory_table, inventory_machine_filter, machine_group, enabled)
         VALUES ($1,$2,$3,null,null,true)
         ON CONFLICT (machine_name) DO UPDATE SET label=EXCLUDED.label,
           inventory_table=EXCLUDED.inventory_table, enabled=true, updated_at=now()
         RETURNING id`,
        [M.machine_name, M.label, INV_TABLE]);
      const id = m.rows[0].id;
      machineIds.push(id);

      await client.query(`DELETE FROM tooling_machine_limit WHERE machine_id=$1`, [id]);
      await client.query(
        `INSERT INTO tooling_machine_limit (machine_id, input_var, min_value, max_value, min_inclusive, max_inclusive, sort_order)
         VALUES ($1,'ID',$2,$3,true,true,0)`, [id, idMinLim, idMaxLim]);

      await client.query(`DELETE FROM tooling_formula WHERE machine_id=$1`, [id]);
      for (const [tooling, frows] of Object.entries(FORMULAS)) {
        let order = 0;
        for (const r of frows) {
          await client.query(
            `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, condition_expr, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [id, tooling, r.key, r.expr, r.cond || null, order++]);
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
    }

    await client.query('COMMIT');
    console.log(`✅ KN-312A/KN-312B seeded (machine ids ${machineIds.join(', ')}); ID limit ${idMinLim}–${idMaxLim}`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ seed failed:', e.message);
    throw e;
  } finally {
    client.release();
  }

  // Persist the answer key for the separate validation script.
  return { answerKey, spec, idMin };
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(() => process.exit(1));
}
module.exports = { run, reverseEngineerInventory };
