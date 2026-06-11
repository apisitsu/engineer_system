'use strict';
/**
 * Seed KS-400B6 (Spherical Grind) into Tooling Select V2.
 *
 * ⚠ SOURCE HAS NO FORMULAS. `（計算式追加予定_山本）20240912_TOOLING LIST_KS-400B6.xlsx`
 * is a single MASTER sheet — a hand-curated per-P/N tooling lookup. These formulas
 * are REVERSE-ENGINEERED from inventory dims + the MASTER assignment (answer key)
 * and validated against it. PILOT PIN reuses KS-400B1's proven formula (the sheet
 * states 4931-03 PILOT PIN is shared across B1–B3/B6/B7).
 *
 * MASTER input dims → spec var:  OD(col C)=odBf · W(col F)=w_aft · ID(col I)=idBf.
 * Many ball CNs have id_bf=NULL → ID formulas fall back to idAft (if(idBf>0,...)).
 *
 * Idempotent. Run: node db_migrations/20260610_seed_ks400b6_tooling_select.js
 */

const { engPool } = require('../instance/eng_db');

const MACHINE = {
  machine_name: 'KS-400B6', label: 'KS-400B6', inventory_table: 'tooling_ks400b6',
  inventory_machine_filter: null, machine_group: null,
};

const LIMITS = [
  { input_var: 'OD', min_value: null, max_value: 35, min_inclusive: true, max_inclusive: true },
];

const FORMULAS = {
  'PILOT PIN': [
    { key: 'A', expr: '(if(idBf > 0, idBf_min, idAft_min)) - 1' },
    { key: 'B', expr: 'W + 3.5' },
    { key: 'C', expr: '(if(idBf > 0, idBf_min, idAft_min)) - 1' },
    { key: 'D', expr: 'W' },
    { key: 'E', expr: 'if((if(idBf > 0, idBf, idAft)) < 5, 6, if((if(idBf > 0, idBf, idAft)) < 10, 9, 9.5))' },
    { key: 'F', expr: 'B + 5' },
  ],
  'PLUG': [
    { key: 'A', expr: '(if(idBf > 0, idBf_min, idAft_min)) - 1' },
    { key: 'B', expr: 'W - 1.5' },
    { key: 'C', expr: 'if(W * 0.6 < 8, W * 0.6, 8)' },
  ],
  'LOADING CHUTE': [
    { key: 'C', expr: 'odBf + 0.15' },
    { key: 'D', expr: 'W + 0.1' },
    { key: 'B', expr: 'if(W < 20, 30, 40)' },
    { key: 'E', expr: 'if(idBf < 7, 10, 20)' },
  ],
  'WORK GUIDE': [{ key: 'A', expr: 'round(W)' }],
  'WORK PUSHER': [{ key: 'A', expr: 'odBf * 0.55' }],
  'WORK DRIVER': [{ key: 'A', expr: '(if(idBf > 0, idBf, idAft)) - 0.4' }],
  // FRONT SHOE 4931-11 / REAR SHOE 4931-12 — AUTHORITATIVE DWG (SME 2026-06-11).
  // Two categories:
  //   Cat.1 Inner Ring w/ Balls Included (ボール入りインナー) = isBallInner (yball=Y / ABR):
  //         FRONT A = V (端面からの距離);  REAR A = X−1, B = Y_dwg+1  — V/X/Y are per-part
  //         END-FACE DISTANCES, NOT in spec & NOT derivable from OD/ID/W → keep odBf proxy.
  //         (`Y` context var is groove_y, a DIFFERENT quantity — must NOT be reused here.)
  //   Cat.2 Standard Ball (通常ボール) = isBallInner=0 (WHT etc): computable —
  //         FRONT A = W/2+2;  REAR A = W/2−2, B = W/2+2.
  // Other DWG dims (display; inventory already stores real values): FRONT B=if(OD<10,8,9),
  //   C=0.15, D=round(31−(10−A−1)); REAR C=if(OD<10,4,5), D=angle(180°/None). OD=odBf_max.
  // Validated vs MASTER (26 rows): FRONT 23%→46%, REAR 58%→81%. The residual misses are all
  // Cat.1 (ABR) parts whose V/X/Y aren't in spec — see DEBUG_FORMULA_PENDING for the manual path.
  'FRONT SHOE': [{ key: 'A', expr: 'if(isBallInner, odBf * 0.32, W / 2 + 2)' }],
  'REAR SHOE':  [{ key: 'B', expr: 'if(isBallInner, odBf - 0.5, W / 2 + 2)' }],
};

const RULES = {
  'PILOT PIN': [
    // dim_b is rank-only: B=W+3.5 breaks for wide parts, a hard BETWEEN excluded
    // an otherwise-correct A match.
    ['A', 'dim_a', 1.0, 1.0, true,  'Pin dia (A)'],
    ['B', 'dim_b', null, null, true,  'Length (B)'],
    ['D', 'dim_d', null, null, false, 'Width (D)'],
    ['F', 'dim_f', null, null, false, 'F'],
  ],
  'PLUG': [
    ['A', 'dim_a', 0.6, 0.6, true,  'Bore (A)'],
    ['B', 'dim_b', 1.5, 1.5, true,  'Length (B)'],
    ['C', 'dim_c', null, null, false, 'C'],
  ],
  'LOADING CHUTE': [
    ['C', 'dim_c', 0.6, 0.6, true,  'Bore (C)'],
    ['D', 'dim_d', 1.5, 1.5, true,  'Width (D)'],
    ['B', 'dim_b', null, null, false, 'Length class (B)'],
    ['E', 'dim_e', null, null, false, 'E'],
  ],
  'WORK GUIDE': [['A', 'dim_a', 2.0, 2.0, true, 'Width (A)']],
  'WORK PUSHER': [['A', 'dim_a', 1.5, 1.5, true, 'OD-driven (A)']],
  'WORK DRIVER': [['A', 'dim_a', 1.5, 1.5, true, 'Bore (A)']],
  'FRONT SHOE': [['A', 'dim_a', 1.5, 1.5, true, 'Shoe dia (A)']],
  'REAR SHOE': [['B', 'dim_b', 1.5, 1.5, true, 'Shoe (B)']],
};

async function run() {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    const m = await client.query(
      `INSERT INTO tooling_machine (machine_name, label, inventory_table, inventory_machine_filter, machine_group, enabled)
       VALUES ($1,$2,$3,$4,$5,true)
       ON CONFLICT (machine_name) DO UPDATE SET label=EXCLUDED.label,
         inventory_table=EXCLUDED.inventory_table, inventory_machine_filter=EXCLUDED.inventory_machine_filter,
         machine_group=EXCLUDED.machine_group, enabled=true, updated_at=now()
       RETURNING id`,
      [MACHINE.machine_name, MACHINE.label, MACHINE.inventory_table, MACHINE.inventory_machine_filter, MACHINE.machine_group]
    );
    const machineId = m.rows[0].id;
    console.log(`machine KS-400B6 id=${machineId}`);

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
    console.log(`✅ KS-400B6 seeded: ${LIMITS.length} limits, ${fCount} formulas, ${rCount} search rules`);
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
