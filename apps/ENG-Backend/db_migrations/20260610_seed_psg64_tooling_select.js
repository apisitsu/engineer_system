'use strict';
/**
 * Seed PSG-64 (surface grinding, MSB races) into Tooling Select V2 — for the
 * DIMENSIONED 2MSB-T series only.
 *
 * Source `MSB_SURFACE-GRINDING_TOOLING(20150213yamamoto).xlsx` has no formulas
 * (pure P/N→DWG lookup). BUT the factory (lpb.eng_race) shows the work-fix-jig
 * tool family is a clean step-function of the work BORE ID for the 2MSB-T parts:
 *
 *   ID < 50 → 0036 · 50–56 → 0029 · 56–60 → 0030 · 60–70 → 0017 · ID ≥ 70 → 0024
 *
 * (verified deterministic over 19 dimensioned parts). So PSG-64 IS expressible
 * as a dimensional formula for these parts. Each family is a set of components
 * (WORK FIXED BASE/COLLET/COLLET ARBOR/COLLAR/ASSY = 4547-01-{base}-{suffix}).
 *
 * NOT covered (documented in formula-reference.md): 3MSB/9MSB series have NO
 * dimensions in eng_race and map categorically (all 3MSB→0031, 9MSB→0037); they
 * can't be dimension-driven and are excluded. SDS already serves all PSG-64 parts
 * via the factory process plan (process_code 1101) + sds_machine_tool.
 *
 * Idempotent. Run: node db_migrations/20260610_seed_psg64_tooling_select.js
 */

const { engPool } = require('../instance/eng_db');
const cnFormat = require('../api/engineer/mtc/utils/cnFormat');

const INV_TABLE = 'tooling_psg64';
const MACHINE = { machine_name: 'PSG-64', label: 'PSG-64', inventory_table: INV_TABLE };

// tool-fix-jig families: base suffix, representative served bore ID, component DWGs
const FAMILIES = [
  { base: '0036', id: 42.4, comps: { 'WORK FIXED BASE': '01', 'COLLET': '02', 'COLLET ARBOR': '03', 'COLLAR': '04' } },
  { base: '0029', id: 53.0, comps: { 'WORK FIXED BASE': '01', 'COLLET': '05', 'COLLET ARBOR': '03', 'COLLAR': '04', 'ASSY': '99' } },
  { base: '0030', id: 58.4, comps: { 'WORK FIXED BASE': '01', 'COLLET': '05', 'COLLET ARBOR': '03', 'COLLAR': '04' } },
  { base: '0017', id: 61.4, comps: { 'WORK FIXED BASE': '01', 'COLLET': '05', 'COLLET ARBOR': '03', 'COLLAR': '04' } },
  { base: '0024', id: 100.0, comps: { 'WORK FIXED BASE': '01', 'COLLET': '02', 'COLLET ARBOR': '03', 'COLLAR': '04', 'ASSY': '99' } },
];
const TOOLING_TYPES = ['WORK FIXED BASE', 'COLLET', 'COLLET ARBOR', 'COLLAR', 'ASSY'];

// Dimensioned 2MSB-T parts (factory eng_race): [controlNo, pn, id, od, width]
const PARTS = [
  ['C29-00881', '2MSB32-607-T', 42.43, 47.958, 8],
  ['C29-00794', '2MSB40-601-T', 52.24, 97, 14.1],
  ['C29-00839', '2MSB41-601-T', 52.24, 100, 13],
  ['C29-00838', '2MSB41-602-T', 54, 125, 15],
  ['C29-00840', '2MSB41-603-T', 54, 125, 15],
  ['C29-00841', '2MSB41-604-T', 54, 125, 15],
  ['C29-00842', '2MSB41-605-T', 54, 125, 15],
  ['C29-00843', '2MSB41-606-T', 54, 125, 15],
  ['C29-00844', '2MSB41-607-T', 54, 125, 15],
  ['C29-00795', '2MSB46-601-T', 57.94, 114, 14.1],
  ['C29-00836', '2MSB48-605-T', 58.87, 102, 13],
  ['C29-00837', '2MSB48-606-T', 58.87, 130, 15],
  ['C29-00847', '2MSB48-607-T', 58.87, 130, 15],
  ['C29-00774', '2MSB48-203-T', 61.3, 130, 14],
  ['C29-00773', '2MSB48-202-T', 61.5, 127, 14],
  ['C29-00579', '2MSB70-202-T', 89.94, 154, 20],
  ['C29-00582', '2MSB70-201-T', 89.94, 204, 20],
  ['C29-00846', '2MSB91-601-T', 113.05, 185, 27],
];

async function run() {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    // 1. Inventory table + rows (tool family per bore-ID band)
    await client.query(`CREATE TABLE IF NOT EXISTS ${INV_TABLE} (
      id serial PRIMARY KEY, tooling_name varchar, tooling_no varchar, dim_a numeric)`);
    await client.query(`DELETE FROM ${INV_TABLE}`);
    let inv = 0;
    for (const f of FAMILIES) {
      for (const [type, suffix] of Object.entries(f.comps)) {
        await client.query(`INSERT INTO ${INV_TABLE} (tooling_name, tooling_no, dim_a) VALUES ($1,$2,$3)`,
          [type, `4547-01-${f.base}-${suffix}`, f.id]);
        inv++;
      }
    }

    // 2. Upsert the 2MSB-T parts into the spec registry (so /search can find them)
    let parts = 0;
    for (const [ctrl, pn, id, od, w] of PARTS) {
      const cn = cnFormat.toSpecCn(ctrl) || ctrl;
      await client.query(
        `INSERT INTO tooling_spec_process (cn, pn, od_aft, id_aft, w_aft)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (cn) DO UPDATE SET pn=EXCLUDED.pn, od_aft=EXCLUDED.od_aft,
           id_aft=EXCLUDED.id_aft, w_aft=EXCLUDED.w_aft`,
        [cn, pn, od, id, w]);
      parts++;
    }

    // 3. Machine
    const m = await client.query(
      `INSERT INTO tooling_machine (machine_name, label, inventory_table, machine_group, enabled)
       VALUES ($1,$2,$3,NULL,true)
       ON CONFLICT (machine_name) DO UPDATE SET label=EXCLUDED.label,
         inventory_table=EXCLUDED.inventory_table, enabled=true, updated_at=now()
       RETURNING id`, [MACHINE.machine_name, MACHINE.label, MACHINE.inventory_table]);
    const machineId = m.rows[0].id;

    // 4. Reset config
    await client.query(`DELETE FROM tooling_machine_limit WHERE machine_id=$1`, [machineId]);
    await client.query(`DELETE FROM tooling_formula      WHERE machine_id=$1`, [machineId]);
    await client.query(`DELETE FROM tooling_search_rule  WHERE machine_id=$1`, [machineId]);

    // 5. Limit: PSG-64 handles large-bore races only → ID ≥ 38 (excludes balls/small races)
    await client.query(
      `INSERT INTO tooling_machine_limit (machine_id, input_var, min_value, max_value, min_inclusive, max_inclusive, sort_order)
       VALUES ($1,'ID',38,NULL,true,true,0)`, [machineId]);

    // 6. Formula + rule per tooling type: family selected by work bore ID (closest match)
    let f = 0, rr = 0;
    for (const type of TOOLING_TYPES) {
      await client.query(
        `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, sort_order)
         VALUES ($1,$2,'A','ID',0)`, [machineId, type]); f++;
      await client.query(
        `INSERT INTO tooling_search_rule (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus, sort_priority, label, is_match_dim, inventory_tooling_filter)
         VALUES ($1,$2,'A','dim_a',NULL,NULL,0,'Bore ID band',true,$3)`, [machineId, type, type]); rr++;
    }

    await client.query('COMMIT');
    console.log(`✅ PSG-64 seeded: machine id=${machineId}, ${inv} inventory rows, ${parts} spec parts, ${f} formulas, ${rr} rules`);
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
