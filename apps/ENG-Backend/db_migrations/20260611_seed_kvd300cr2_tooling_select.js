'use strict';
/**
 * Seed KVD-300CRII (Face Grind / 巾研) into Tooling Select V2.
 *
 * Source: 20251202_TOOLING LIST_KVD300CR2(FACE GRIND).xlsx
 *   DIMENSION sheet: TURNING cols S/T/U = turned OD nominal+tol+/tol-;
 *                    TURNING cols V/W/X = turned Width nominal+tol+/tol-.
 *   CARRIER sheet (rows 11-24): inventory of 4036-01-XXXX carriers.
 *     Col C = A (pocket bore dia), Col D = B (281-A), Col E = (C) (A-5),
 *     Col F = D (pocket width), Col G = E (# pockets, manual),
 *     Col H = F (360/E), Col I = (G) (pocket depth, manual),
 *     Col J = H (corner R text), Col K = J (material text).
 *
 * Formula inputs:
 *   OD = turned OD max = odBf_max (fallback od_aft_max if od_bf is NULL/0)
 *   W  = turned width max = wBf_max (fallback w_aft_max)
 *
 * Match dims: A (pocket bore) ↔ dim_a, D (pocket width) ↔ dim_d.
 * New standard: rows 23-24 (row 23 marked "以降、新基準"); rows 11-22 are legacy.
 * Machine limit: OD 9.5–46, Width 6–29 (per DIMENSION sheet note E9/A10).
 *
 * SDS: sds_machine_type_code already has 'KVD-300CRII' (code 036).
 * T-Select machine_name='KVD-300CRII' matches it exactly.
 *
 * Idempotent. Run: node db_migrations/20260611_seed_kvd300cr2_tooling_select.js
 */

const { engPool } = require('../instance/eng_db');

const MACHINE = {
  machine_name: 'KVD-300CRII',
  label: 'KVD-300CRII',
  inventory_table: 'tooling_kvd300cr2',
  inventory_machine_filter: null,
  machine_group: null,
};

const LIMITS = [
  { input_var: 'OD', min_value: 9.5,  max_value: 46,   min_inclusive: true,  max_inclusive: true },
  { input_var: 'W',  min_value: 6.0,  max_value: 29,   min_inclusive: true,  max_inclusive: true },
];

// CARRIER 4036-01 formulas (evaluated sequentially; A computed first, then B uses A, etc.)
// OD = if(odBf_max>0, odBf_max, odAft_max)  [turned OD upper bound]
// W  = if(wBf_max>0, wBf_max, wAft_max)     [turned width upper bound]
// Note: round(A-5,1) → preprocessed to roundN(A-5,1) by _preprocess().
const FORMULAS = {
  'CARRIER': [
    {
      key: 'A',
      expr: 'if(if(odBf_max>0,odBf_max,odAft_max)<=30, ceil05(if(odBf_max>0,odBf_max,odAft_max)+0.4), ceil05(if(odBf_max>0,odBf_max,odAft_max)+1))',
    }, // pocket bore dia (NEW std 2025/12/05)
    { key: 'B', expr: '281 - A' },              // reference dim
    { key: 'C', expr: 'round(A-5, 1)' },        // reference dim (→ roundN by preprocess)
    { key: 'D', expr: 'ceil05(if(wBf_max>0,wBf_max,wAft_max)*0.8)' }, // pocket width
    { key: 'H', expr: 'if(A<=40,"R0.5","R1")' }, // corner R (text)
    { key: 'J', expr: 'if(D<=2.5,"S45C-S55C",if(D<=12,"SS400","S45C-S55C"))' }, // material (text)
  ],
};

// [output_key, inventory_col, tol_plus, tol_minus, is_match_dim, label]
const RULES = {
  'CARRIER': [
    ['A', 'dim_a', 0.5,  0.5,  true,  'Pocket bore dia (A)'],
    ['D', 'dim_d', 0.5,  0.5,  true,  'Pocket width (D)'],
    ['B', 'dim_b', null, null, false, 'Ref dim (B)'],
    ['C', 'dim_c', null, null, false, 'Ref dim (C)'],
    ['H', 'dim_h', null, null, false, 'Corner R (H)'],
    ['J', 'dim_j', null, null, false, 'Material (J)'],
  ],
};

// Inventory rows from CARRIER sheet rows 11-24.
// [tooling_no, dim_a, dim_b, dim_c, dim_d, dim_e, dim_f, dim_g, dim_h, dim_j, note]
// B for row 0009 corrected from dump value 25.15 (decimal error) to 251.5 (= 281−29.5).
// Rows 11-22 = old standard (A not a 0.5 multiple); rows 23-24 = new standard.
const CARRIER_ROWS = [
  ['4036-01-0001', 56.6,  224.4, 51.6, 8.5,  8,  45,    46.67, 'R1',   'SS400'],
  ['4036-01-0002', 43.7,  237.3, 37.8, 8.5,  12, 30,    26.4,  'R1',   'SS400'],
  ['4036-01-0003', 17.9,  263.1, 12.9, 6.5,  32, 11.25, 8.69,  'R0.5', 'SS400'],
  ['4036-01-0004', 28.9,  252.1, 23.9, 6,    20, 18,    13.61, 'R0.5', 'SS400'],
  ['4036-01-0005', 38.5,  242.5, 33.5, 10.5, 16, 22.5,  14.57, 'R0.5', 'SS400'],
  ['4036-01-0006', 21.1,  259.9, 16.11, 8,   32, 11.25, 5.38,  'R0.5', 'SS400'],
  ['4036-01-0007', 63.5,  217.5, 58.5, 10,   8,  45,    39.52, 'R1',   'SS400'],
  ['4036-01-0008', 33,    248,   28,   8,    16, 22.5,  18.98, 'R0.5', 'SS400'],
  ['4036-01-0009', 29.5,  251.5, 24.5, 6,    18, 20,    17.73, 'R0.5', 'SS400'],
  ['4036-01-0010', 36.5,  244.5, 31.5, 9,    16, 22.5,  16.59, 'R0.5', 'SS400'],
  ['4036-01-0011', 21.5,  259.5, 16.5, 7,    32, 11.25, 5.09,  'R0.5', 'SS400'],
  ['4036-01-0012', 19.5,  261.5, 14.5, 5,    32, 11.25, 7.09,  'R0.5', 'SS400'],
  // Row 23 → "以降、新基準" (new standard from here): P/N=3L117614-T
  ['4036-01-0013', 20.5,  260.5, 15.5, 6.5,  32, 11.25, 6.09,  'R0.5', 'SS400'],
  // Row 24: P/N=3L117544-T
  ['4036-01-0014', 24,    257,   19,   8.5,  24, 15,    11.44, 'R0.5', 'SS400'],
];

async function run() {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create inventory table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tooling_kvd300cr2 (
        id       SERIAL PRIMARY KEY,
        tooling_name VARCHAR DEFAULT 'CARRIER',
        tooling_no   VARCHAR,
        dim_a    NUMERIC,  -- pocket bore dia (A) — match dim
        dim_b    NUMERIC,  -- 281 − A (B)
        dim_c    NUMERIC,  -- A − 5 (C)
        dim_d    NUMERIC,  -- pocket width (D) — match dim
        dim_e    NUMERIC,  -- # pockets (E), manual
        dim_f    NUMERIC,  -- 360/E (F)
        dim_g    NUMERIC,  -- pocket depth (G), manual
        dim_h    TEXT,     -- corner R: 'R0.5' or 'R1'
        dim_j    TEXT      -- material: 'SS400' or 'S45C-S55C'
      )
    `);
    await client.query(`DELETE FROM tooling_kvd300cr2`);

    for (const [no, a, b, c, d, e, f, g, h, j] of CARRIER_ROWS) {
      await client.query(
        `INSERT INTO tooling_kvd300cr2
           (tooling_name, tooling_no, dim_a, dim_b, dim_c, dim_d, dim_e, dim_f, dim_g, dim_h, dim_j)
           VALUES ('CARRIER',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [no, a, b, c, d, e, f, g, h, j]
      );
    }
    console.log(`Imported ${CARRIER_ROWS.length} CARRIER inventory rows into tooling_kvd300cr2`);

    // 2. Machine (upsert)
    const m = await client.query(
      `INSERT INTO tooling_machine (machine_name, label, inventory_table, inventory_machine_filter, machine_group, enabled)
       VALUES ($1,$2,$3,$4,$5,true)
       ON CONFLICT (machine_name) DO UPDATE SET
         label=EXCLUDED.label, inventory_table=EXCLUDED.inventory_table,
         inventory_machine_filter=EXCLUDED.inventory_machine_filter,
         machine_group=EXCLUDED.machine_group, enabled=true, updated_at=now()
       RETURNING id`,
      [MACHINE.machine_name, MACHINE.label, MACHINE.inventory_table, MACHINE.inventory_machine_filter, MACHINE.machine_group]
    );
    const machineId = m.rows[0].id;
    console.log(`Machine KVD-300CRII id=${machineId}`);

    // 3. Limits
    await client.query(`DELETE FROM tooling_machine_limit WHERE machine_id=$1`, [machineId]);
    let so = 0;
    for (const l of LIMITS) {
      await client.query(
        `INSERT INTO tooling_machine_limit (machine_id, input_var, min_value, max_value, min_inclusive, max_inclusive, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [machineId, l.input_var, l.min_value, l.max_value, l.min_inclusive, l.max_inclusive, so++]
      );
    }

    // 4. Formulas
    await client.query(`DELETE FROM tooling_formula WHERE machine_id=$1`, [machineId]);
    let fCount = 0;
    for (const [tooling, rows] of Object.entries(FORMULAS)) {
      let order = 0;
      for (const r of rows) {
        await client.query(
          `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, condition_expr, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [machineId, tooling, r.key, r.expr, r.cond || null, order++]
        );
        fCount++;
      }
    }

    // 5. Search rules
    await client.query(`DELETE FROM tooling_search_rule WHERE machine_id=$1`, [machineId]);
    let rCount = 0;
    for (const [tooling, rules] of Object.entries(RULES)) {
      let prio = 0;
      for (const [key, col, tolP, tolM, matchDim, label] of rules) {
        await client.query(
          `INSERT INTO tooling_search_rule
             (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus, sort_priority, label, is_match_dim, inventory_tooling_filter)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [machineId, tooling, key, col, tolP, tolM, prio++, label, matchDim, null]
        );
        rCount++;
      }
    }

    await client.query('COMMIT');
    console.log(`✅ KVD-300CRII seeded: ${LIMITS.length} limits, ${fCount} formulas, ${rCount} search rules`);
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
module.exports = { run };
