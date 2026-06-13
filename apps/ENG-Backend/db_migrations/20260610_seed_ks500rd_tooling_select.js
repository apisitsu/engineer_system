'use strict';
/**
 * Seed KS-500RD (Spherical Grind) into Tooling Select V2.
 *
 * Source: IDE製作中_20180828_TOOLING LIST_KS-500RD(SPHERICAL GRIND).xlsx (WIP).
 * Inventory table `tooling_ks500rd` (dim_a..dim_h) already imported.
 *
 * Spec vars: ID/OD/W = after-grind nominal; SD = stored sd (NOT geometric
 * sqrt(OD²−W²), which breaks for Y-ball; reconstruction confirms stored SD);
 * wAft_max = W + w_aft tol+.
 *
 * Tooling formulas (verified by inventory reconstruction, residual ~0):
 *   WORK DRIVER 4033-01 : A = SD−0.2 ; B = A−7  (inventory dim_a−dim_b = 7)
 *   LOADING PINTLE 4033-02 : stepped lookup on grind ID
 *   FRONT SHOE 4033-03 : OD band — compute band lower bound, match dim_a exactly
 *
 * Idempotent. Run: node db_migrations/20260610_seed_ks500rd_tooling_select.js
 */

const { engPool } = require('../instance/eng_db');

const MACHINE = {
  machine_name: 'KS-500RD', label: 'KS-500RD', inventory_table: 'tooling_ks500rd',
  inventory_machine_filter: null, machine_group: null,
};

const LIMITS = [
  { input_var: 'OD', min_value: 24, max_value: 62, min_inclusive: true, max_inclusive: true },
];

const FORMULAS = {
  'WORK DRIVER': [
    { key: 'A', expr: 'SD - 0.2' },
    { key: 'B', expr: 'A - 7' },
  ],
  'LOADING PINTLE': [
    { key: 'A', expr: 'round(ID - 1)' },
    { key: 'B', expr: 'round(ID + 3)' },
    { key: 'C', expr: 'if(wAft_max <= 20, wAft_max * 0.6, 12)' },
    { key: 'D', expr: 'if(ID <= 14.5, 9, if(ID <= 24.5, 9.5, 17.5))' },
    { key: 'E', expr: 'if(ID <= 24.5, 5.5, 11)' },
    { key: 'F', expr: 'round(ID - 4.5, 1)' },
    { key: 'G', expr: 'if(ID <= 24.5, 9, 20)' },
    { key: 'H', expr: 'round(ID - 0.8, 1)' },
  ],
  'FRONT SHOE': [
    { key: 'A', expr: 'if(OD<19, 0, if(OD<21, 19, if(OD<28, 21, if(OD<37, 28, if(OD<46, 37, 46)))))' },
  ],
};

const RULES = {
  'WORK DRIVER': [
    ['A', 'dim_a', 0.6, 0.6, true,  'Seat dia (A)'],
    ['B', 'dim_b', null, null, false, 'A−7 (B)'],
  ],
  'LOADING PINTLE': [
    ['A', 'dim_a', 1.5, 1.5, true,  'ID−1 (A)'],
    ['H', 'dim_h', 1.5, 1.5, true,  'ID−0.8 (H)'],
    ['B', 'dim_b', null, null, false, 'ID+3 (B)'],
    ['C', 'dim_c', null, null, false, 'C'],
    ['D', 'dim_d', null, null, false, 'D'],
    ['E', 'dim_e', null, null, false, 'E'],
    ['F', 'dim_f', null, null, false, 'F'],
    ['G', 'dim_g', null, null, false, 'G'],
  ],
  'FRONT SHOE': [
    ['A', 'dim_a', 2.0, 2.0, true,  'OD band (A)'],
  ],
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
    console.log(`machine KS-500RD id=${machineId}`);

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
    console.log(`✅ KS-500RD seeded: ${LIMITS.length} limits, ${fCount} formulas, ${rCount} search rules`);
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
