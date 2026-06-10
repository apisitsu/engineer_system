'use strict';
/**
 * Seed KL-20 (TRIM, bearing race/sleeve) into Tooling Select V2.
 *
 * Source: 20241204_TOOLING LIST_KL-20(TRIM).xlsx (data → kl20_data.json).
 * Two collet types — selection gated by the part's flange flag:
 *   flange 'N' (race, OD chuck)   → 4030-01_COLLET, matched by trim OD
 *   flange 'F' (sleeve, ID chuck) → 4030-02_COLLET, matched by trim ID
 *
 * The TRIM dims differ from the finished grind dims (od_aft/id_aft) — flange
 * parts' trim OD is the flange dia, and some races' od_aft is the bore-side OD —
 * so the Excel trim OD/ID are stored in od_bf/id_bf (NULL/0 for these parts) and
 * used by the formula. The flange flag is stored in `type` (was NULL) and read
 * via condition `Type == "F"/"N"` (expr-eval supports string equality).
 *   4030-01: A = odBf (trim OD)        → dim_a (grip OD, near-exact)
 *   4030-02: A = idBf + 0.15 (trim ID) → dim_a (grip ID; +0.15 per 2024 design rule)
 *
 * SDS: sds_machine_type_code already has 'KL-20' (code 030).
 *
 * Idempotent. Run: node db_migrations/20260610_seed_kl20_tooling_select.js
 */

const fs = require('fs');
const path = require('path');
const { engPool } = require('../instance/eng_db');

const INV_TABLE = 'tooling_kl20';
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'kl20_data.json'), 'utf8'));

// Flange gate is embedded as an unmatchable sentinel (-999) for the wrong flange,
// NOT a condition_expr: a skipped row leaves A undefined, which makes searchInventory
// drop the tolerance filter and return arbitrary rows. -999 keeps the BETWEEN filter
// active so the wrong-flange tooling correctly returns nothing.
const FORMULAS = {
  '4030-01_COLLET': [{ key: 'A', expr: 'if(Type == "N", odBf, -999)' }],        // OD chuck (race), trim OD
  '4030-02_COLLET': [{ key: 'A', expr: 'if(Type == "F", idBf + 0.15, -999)' }], // ID chuck (sleeve), trim ID
};
const RULES = {
  '4030-01_COLLET': [['A', 'dim_a', 0.5, 0.5, true, 'Grip OD']],
  '4030-02_COLLET': [['A', 'dim_a', 0.4, 0.4, true, 'Grip ID']],
};

async function run() {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    // 1. Inventory: collet grip dimension per DWG
    await client.query(`CREATE TABLE IF NOT EXISTS ${INV_TABLE} (
      id serial PRIMARY KEY, tooling_name varchar, tooling_no varchar, dim_a numeric)`);
    await client.query(`DELETE FROM ${INV_TABLE}`);
    let inv = 0;
    for (const [no, od] of DATA.inv01) {
      await client.query(`INSERT INTO ${INV_TABLE} (tooling_name, tooling_no, dim_a) VALUES ('4030-01_COLLET',$1,$2)`, [no, od]); inv++;
    }
    for (const [no, id] of DATA.inv02) {
      await client.query(`INSERT INTO ${INV_TABLE} (tooling_name, tooling_no, dim_a) VALUES ('4030-02_COLLET',$1,$2)`, [no, id]); inv++;
    }

    // 2. Tag the flange flag onto existing spec rows (type was NULL). UPDATE-only:
    //    we don't insert new bearing parts (avoids cross-machine spec noise).
    // Grip mode → spec `type`: 'N' = OD-chuck (4030-01), 'F' = ID-chuck (4030-02).
    // When the master list already assigns a collet, honour that grip mode (the
    // engineer's decision — covers the flange-N sleeves that still ID-grip);
    // otherwise predict from the flange flag.
    let tagged = 0;
    for (const p of DATA.parts) {
      const grip = p.coll ? (p.coll.startsWith('4030-01') ? 'N' : 'F') : p.fl;
      const r = await client.query(
        `UPDATE tooling_spec_process SET type = $2, od_bf = $3, id_bf = $4, w_bf = $5
           WHERE cn = $1 AND (type IS NULL OR type IN ('F','N'))`,
        [p.cn, grip, p.od, p.id, p.w]);
      tagged += r.rowCount;
    }

    // 3. Machine
    const m = await client.query(
      `INSERT INTO tooling_machine (machine_name, label, inventory_table, machine_group, enabled)
       VALUES ('KL-20','KL-20',$1,NULL,true)
       ON CONFLICT (machine_name) DO UPDATE SET label=EXCLUDED.label,
         inventory_table=EXCLUDED.inventory_table, enabled=true, updated_at=now()
       RETURNING id`, [INV_TABLE]);
    const machineId = m.rows[0].id;

    await client.query(`DELETE FROM tooling_machine_limit WHERE machine_id=$1`, [machineId]);
    await client.query(`DELETE FROM tooling_formula      WHERE machine_id=$1`, [machineId]);
    await client.query(`DELETE FROM tooling_search_rule  WHERE machine_id=$1`, [machineId]);

    // 4. Formulas (flange-gated) + rules. Both tooling types share one table →
    //    inventory_tooling_filter required.
    let f = 0, rr = 0;
    for (const [tooling, rows] of Object.entries(FORMULAS)) {
      let order = 0;
      for (const row of rows) {
        await client.query(
          `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, condition_expr, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6)`, [machineId, tooling, row.key, row.expr, row.cond || null, order++]); f++;
      }
    }
    for (const [tooling, rules] of Object.entries(RULES)) {
      let prio = 0;
      for (const [key, col, tolP, tolM, matchDim, label] of rules) {
        await client.query(
          `INSERT INTO tooling_search_rule (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus, sort_priority, label, is_match_dim, inventory_tooling_filter)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [machineId, tooling, key, col, tolP, tolM, prio++, label, matchDim, tooling]); rr++;
      }
    }

    await client.query('COMMIT');
    console.log(`✅ KL-20 seeded: machine id=${machineId}, ${inv} collets, ${tagged} parts flagged, ${f} formulas, ${rr} rules`);
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
