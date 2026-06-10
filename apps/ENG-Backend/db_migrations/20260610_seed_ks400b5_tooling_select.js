'use strict';
/**
 * Seed KS-400B5 into the Tooling Select V2 DB-driven engine.
 *
 * Source of truth: 20241223_TOOLING LIST_KS-400B5.xlsx (Select_tool_backup).
 * Inventory table `tooling_ks400b5` (dim_a..dim_x) was already imported; this
 * migration registers the machine, eligibility limits, formula rows, and
 * inventory search rules so `POST /api/tooling-select/search` can select B5 tools.
 *
 * Spec-variable vocabulary (see searchService.buildSpecContext):
 *   OD/ID/W      = after-grind nominal (od_aft/id_aft/w_aft)   — DIMENSION cols G/J/M
 *   odBf/idBf/wBf= before-grind / turning nominal               — DIMENSION cols S/V/Y
 *   *_max/*_min  = ABSOLUTE bounds (nominal + signed tol delta)
 *   SD           = shoulder dia (肩径 / 判別式)
 *   isIDtoOD     = process '内→球' (ID->OD)  ·  isODtoID = '球→内' (OD->ID)
 *
 * Idempotent: deletes all KS-400B5 config rows then re-inserts.
 *
 * Run:  node db_migrations/20260610_seed_ks400b5_tooling_select.js
 */

const { engPool } = require('../instance/eng_db');

const MACHINE = {
  machine_name: 'KS-400B5',
  label: 'KS-400B5',
  inventory_table: 'tooling_ks400b5',
  inventory_machine_filter: null,
  machine_group: null, // stands alone (matches sds_machine_type_code 'KS-400B5')
};

// Eligibility: B5 inventory parts span OD up to ~35, W up to ~32 (Spherical grind).
const LIMITS = [
  { input_var: 'OD', min_value: null, max_value: 40, min_inclusive: true, max_inclusive: true },
];

// ── Formulas: one row per (tooling_name, output_key). condition = optional gate ──
const FORMULAS = {
  'WORK CHUTE': [
    { key: 'A', expr: 'odBf + 0.1' },                 // dim_a  Z-bore upper
    { key: 'B', expr: 'wBf + 0.1' },                  // dim_b  width
    { key: 'C', expr: 'odBf / 2 + 27.55' },           // dim_c  centre height
    { key: 'D', expr: 'if(wBf < 20, 30, 37)' },       // dim_d  body length class
  ],
  'WORK LOADER': [
    { key: 'A', expr: 'odBf + 0.1' },                 // dim_a
    { key: 'D', expr: 'wBf' },                        // dim_d  before-grind width
  ],
  'MASTER RING FOR JAW': [
    { key: 'A', expr: '(idBf_max + idBf_min) / 2' },  // dim_a  ID t.c.
    { key: 'B', expr: '(odBf_max + odBf_min) / 2' },  // dim_b  OD t.c.
    { key: 'C', expr: 'W' },                          // dim_c  after-grind width
  ],
  'STOPPER': [
    { key: 'A', expr: 'if(isIDtoOD, idAft_max, idBf_max) + 0.5' }, // dim_a
    { key: 'B', expr: 'SD - 0.1' },                                // dim_b
  ],
  'CHUCK JAW': [
    { key: 'A', expr: 'if(isIDtoOD, idAft_max, idBf_max) + 0.5' }, // dim_a  bore A
    { key: 'B', expr: 'A - 0.8' },                                 // dim_b  bore B
    { key: 'C', expr: '36 + W * 2 / 3' },                          // dim_c  length
    { key: 'D', expr: 'if(isIDtoOD, idAft_min, idBf_min) - 0.03' },// dim_d  seat
  ],
  'WORK HOLDER': [
    { key: 'A', expr: 'SD + 2' },                                  // dim_a  φX
    { key: 'B', expr: 'if(A < 11.5, 0, if(A < 15, 10, if(A < 18.5, 13, if(A < 20.8, 16, if(A < 27.7, 18, if(A < 34.6, 24, 0))))))' }, // dim_b
  ],
  'WORK CLAMP': [
    { key: 'A', expr: 'SD' },               // dim_a  tip dia (A MAX)
    { key: 'W', expr: 'W' },                // dim_w  work width (firm match)
    { key: 'B', expr: '49 - W' },           // dim_b  protrusion (B+W≈49)
  ],
  'SHAFT': [
    { key: 'A', expr: 'SD - 0.5' },                       // dim_a  A max
    { key: 'B', expr: 'if(W > 12, 10, 8)' },              // dim_b  B
    { key: 'C', expr: 'if(isIDtoOD, ID, idBf) - 0.5' },   // dim_c  C max (bore)
  ],
  'WORK CHUCK': [
    // Stepped lookup on after-grind OD (dim_a collides across bands).
    { key: 'A', expr: 'if(OD<16, 10.38, if(OD<20, 12.12, if(OD<23, 15.59, if(OD<33, 17.32, 19.05))))' }, // dim_a
    { key: 'B', expr: 'if(OD<12, 22.95, if(OD<16, 20.15, if(OD<20, 18.15, if(OD<23, 16.65, if(OD<33, 12.75, 11.15)))))' }, // dim_b
    { key: 'C', expr: 'if(OD<16, 10, if(OD<20, 12, if(OD<29, 14, if(OD<33, 18, 16))))' }, // dim_c centre pos
  ],
  'WORK CHUTE GUIDE': [
    { key: 'A', expr: 'if(wBf < 20, 30, 37)' },           // dim_a  (= chute D)
    { key: 'C', expr: 'if(isIDtoOD, ID, idBf) - 0.5' },   // dim_c  bore
    { key: 'D', expr: 'SD - 0.5' },                       // dim_d  shoulder
  ],
};

// [col, tol_plus, tol_minus, is_match_dim, label]
const RULES = {
  'WORK CHUTE': [
    ['A', 'dim_a', 0.6, 0.6, true,  'Z-bore (A)'],
    ['B', 'dim_b', 2.0, 2.0, true,  'Width (B)'],
    ['C', 'dim_c', null, null, false, 'Centre H (C)'],
    ['D', 'dim_d', null, null, false, 'Body class (D)'],
  ],
  'WORK LOADER': [
    ['A', 'dim_a', 0.6, 0.6, true,  'OD bore (A)'],
    ['D', 'dim_d', 2.0, 2.0, true,  'Before-grind W (D)'],
  ],
  'MASTER RING FOR JAW': [
    ['A', 'dim_a', 0.5, 0.5, true,  'ID t.c. (A)'],
    ['B', 'dim_b', 0.8, 0.8, true,  'OD t.c. (B)'],
    ['C', 'dim_c', 3.0, 3.0, true,  'Width (C)'],
  ],
  'STOPPER': [
    ['A', 'dim_a', 0.6, 0.6, true,  'ID+0.5 (A)'],
    ['B', 'dim_b', null, null, false, 'SD-0.1 (B)'],
  ],
  'CHUCK JAW': [
    ['A', 'dim_a', 0.6, 0.6, true,  'Bore A'],
    ['B', 'dim_b', 0.6, 0.6, true,  'Bore B'],
    ['C', 'dim_c', null, null, false, 'Length C'],
    ['D', 'dim_d', null, null, false, 'Seat D'],
  ],
  'WORK HOLDER': [
    ['A', 'dim_a', 2.0, 2.0, true,  'φX (A)'],
    ['B', 'dim_b', null, null, false, 'Step (B)'],
  ],
  'WORK CLAMP': [
    ['W', 'dim_w', 1.5, 1.5, true,  'Work width (W)'],
    ['A', 'dim_a', 0.5, 6.0, true,  'Tip dia (A)'],
    ['B', 'dim_b', null, null, false, 'Protrusion (B)'],
  ],
  'SHAFT': [
    ['A', 'dim_a', 0.5, 4.0, true,  'Tip dia (A)'],
    ['B', 'dim_b', null, null, false, 'B'],
  ],
  'WORK CHUCK': [
    ['A', 'dim_a', 1.0, 1.0, true,  'Jaw dia (A)'],
    ['B', 'dim_b', 1.0, 1.0, true,  'Stroke (B)'],
    ['C', 'dim_c', 1.0, 1.0, true,  'Centre pos (C)'],
  ],
  'WORK CHUTE GUIDE': [
    ['C', 'dim_c', 1.5, 1.5, true,  'Bore (C)'],
    ['A', 'dim_a', null, null, false, 'Body class (A)'],
    ['D', 'dim_d', null, null, false, 'Shoulder (D)'],
  ],
};

async function run() {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
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
    console.log(`machine KS-400B5 id=${machineId}`);

    await client.query(`DELETE FROM tooling_machine_limit WHERE machine_id=$1`, [machineId]);
    await client.query(`DELETE FROM tooling_formula      WHERE machine_id=$1`, [machineId]);
    await client.query(`DELETE FROM tooling_search_rule  WHERE machine_id=$1`, [machineId]);

    let so = 0;
    for (const l of LIMITS) {
      await client.query(
        `INSERT INTO tooling_machine_limit (machine_id, input_var, min_value, max_value, min_inclusive, max_inclusive, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [machineId, l.input_var, l.min_value, l.max_value, l.min_inclusive, l.max_inclusive, so++]
      );
    }

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

    // All 10 tooling types share ONE inventory table → every rule MUST set
    // inventory_tooling_filter = tooling_name (else search ranks across the whole table).
    let rCount = 0;
    for (const [tooling, rules] of Object.entries(RULES)) {
      let prio = 0;
      for (const [key, col, tolP, tolM, matchDim, label] of rules) {
        await client.query(
          `INSERT INTO tooling_search_rule (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus, sort_priority, label, is_match_dim, inventory_tooling_filter)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [machineId, tooling, key, col, tolP, tolM, prio++, label, matchDim, tooling]
        );
        rCount++;
      }
    }

    await client.query('COMMIT');
    console.log(`✅ KS-400B5 seeded: ${LIMITS.length} limits, ${fCount} formulas, ${rCount} search rules`);
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
