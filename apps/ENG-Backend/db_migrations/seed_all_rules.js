'use strict';
/**
 * Phase 2: Seed Script - All remaining machines
 * KS03A, KS500RD, KS400B5, KS400B6
 * Run: node db_migrations/seed_all_rules.js
 */

const { engPool } = require('../instance/eng_db');

const RULES = [
  // ── KS03A ──────────────────────────────────────────────────────────────────
  {
    machine_name: 'KS03A', tool_category: 'ROLLER SHOE',
    calc_context: 'ks03a', target_tool_table: 'tooling_ks03a',
    machine_ok_condition: 'ks03aOK',
    dims: [
      { calc_key: 'rollerShoe.A', tool_field: 'dim_a', label: 'A', tol_plus: 1.0, tol_minus: 1.0, sort_priority: 1 },
      { calc_key: 'rollerShoe.C', tool_field: 'dim_c', label: 'C', tol_plus: 1.0, tol_minus: 1.0, sort_priority: 2 },
    ],
    result_fields: [
      { tool_field: 'dim_a', label: 'A' }, { tool_field: 'dim_c', label: 'C' },
      { tool_field: 'dim_d', label: 'D' }, { tool_field: 'dim_b', label: 'B' },
    ],
  },
  {
    machine_name: 'KS03A', tool_category: 'CPX SHOE',
    calc_context: 'ks03a', target_tool_table: 'tooling_ks03a',
    machine_ok_condition: 'ks03aOK',
    dims: [
      { calc_key: 'cpxShoe.A', tool_field: 'dim_a', label: 'A (W)', tol_plus: 0.5, tol_minus: 0.5, sort_priority: 1 },
      { calc_key: 'cpxShoe.D', tool_field: 'dim_d', label: 'D',     tol_plus: 2.0, tol_minus: 2.0, sort_priority: 2 },
    ],
    result_fields: [
      { tool_field: 'dim_a', label: 'A' }, { tool_field: 'dim_c', label: 'C' },
      { tool_field: 'dim_d', label: 'D' }, { tool_field: 'dim_v', label: 'V' },
    ],
  },
  {
    machine_name: 'KS03A', tool_category: 'CHUTE COVER',
    calc_context: 'ks03a', target_tool_table: 'tooling_ks03a',
    machine_ok_condition: 'ks03aOK',
    dims: [
      { calc_key: 'chute.A', tool_field: 'dim_a', label: 'A (OD)', tol_plus: 1.0, tol_minus: 0.1, sort_priority: 1 },
      { calc_key: 'chute.B', tool_field: 'dim_b', label: 'B (W)',  tol_plus: 3.0, tol_minus: 0.1, sort_priority: 2 },
    ],
    result_fields: [
      { tool_field: 'dim_a', label: 'A' }, { tool_field: 'dim_b', label: 'B' },
      { tool_field: 'dim_c', label: 'C' }, { tool_field: 'dim_d', label: 'D' },
    ],
  },
  {
    machine_name: 'KS03A', tool_category: 'FRONT PLATE',
    calc_context: 'ks03a', target_tool_table: 'tooling_ks03a',
    machine_ok_condition: 'ks03aOK',
    dims: [
      { calc_key: 'fp.A', tool_field: 'dim_a', label: 'A (ID)',  tol_plus: 0.5, tol_minus: 0.5, sort_priority: 1 },
    ],
    result_fields: [
      { tool_field: 'dim_a', label: 'A' }, { tool_field: 'dim_b', label: 'B' },
      { tool_field: 'dim_d', label: 'D' }, { tool_field: 'dim_e', label: 'E' },
    ],
  },
  {
    machine_name: 'KS03A', tool_category: 'SETTING GAUGE',
    calc_context: 'ks03a', target_tool_table: 'tooling_ks03a',
    machine_ok_condition: 'ks03aOK',
    dims: [
      { calc_key: 'sg.A', tool_field: 'dim_a', label: 'A (ID)',  tol_plus: 0.5, tol_minus: 0.5, sort_priority: 1 },
    ],
    result_fields: [
      { tool_field: 'dim_a', label: 'A' }, { tool_field: 'dim_b', label: 'B' },
      { tool_field: 'dim_c', label: 'C' }, { tool_field: 'dim_d', label: 'D' },
    ],
  },
  {
    machine_name: 'KS03A', tool_category: 'MASTER RING',
    calc_context: 'ks03a', target_tool_table: 'tooling_ks03a',
    machine_ok_condition: 'ks03aOK',
    dims: [
      { calc_key: 'mr.A', tool_field: 'dim_a', label: 'A (OD)',  tol_plus: 0.5, tol_minus: 0.5, sort_priority: 1 },
      { calc_key: 'mr.B', tool_field: 'dim_b', label: 'B (ID)',  tol_plus: 0.5, tol_minus: 0.5, sort_priority: 2 },
    ],
    result_fields: [
      { tool_field: 'dim_a', label: 'A' }, { tool_field: 'dim_b', label: 'B' }, { tool_field: 'dim_c', label: 'C' },
    ],
  },
  {
    machine_name: 'KS03A', tool_category: 'PLUG GAUGE',
    calc_context: 'ks03a', target_tool_table: 'tooling_ks03a',
    machine_ok_condition: 'ks03aOK',
    dims: [
      { calc_key: 'pg.A', tool_field: 'dim_a', label: 'A (ID)', tol_plus: 1.0, tol_minus: 1.0, sort_priority: 1 },
    ],
    result_fields: [
      { tool_field: 'dim_a', label: 'A' }, { tool_field: 'dim_b', label: 'B' },
      { tool_field: 'dim_c', label: 'C' }, { tool_field: 'dim_f', label: 'F' },
    ],
  },
  {
    machine_name: 'KS03A', tool_category: 'LOADER',
    calc_context: 'ks03a', target_tool_table: 'tooling_ks03a',
    machine_ok_condition: 'ks03aOK',
    dims: [
      { calc_key: 'ld.B', tool_field: 'dim_b', label: 'B (OD)',  tol_plus: 1.0, tol_minus: 1.0, sort_priority: 1 },
    ],
    result_fields: [
      { tool_field: 'dim_a', label: 'A' }, { tool_field: 'dim_b', label: 'B' },
      { tool_field: 'dim_c', label: 'C' }, { tool_field: 'dim_d', label: 'D' },
    ],
  },
  {
    machine_name: 'KS03A', tool_category: 'PRESSURE ROTOR',
    calc_context: 'ks03a', target_tool_table: 'tooling_ks03a',
    machine_ok_condition: 'ks03aOK',
    dims: [
      { calc_key: 'pr.A', tool_field: 'dim_a', label: 'A (ID+)', tol_plus: 0.5, tol_minus: 0.5, sort_priority: 1 },
    ],
    result_fields: [
      { tool_field: 'dim_a', label: 'A' }, { tool_field: 'dim_b', label: 'B' },
    ],
  },

  // ── KS500RD ────────────────────────────────────────────────────────────────
  {
    machine_name: 'KS500RD', tool_category: 'LOADING PINTLE',
    calc_context: 'ks500rd', target_tool_table: 'tooling_ks500rd',
    machine_ok_condition: 'ks500rdOK',
    dims: [
      { calc_key: 'lp.A', tool_field: 'dim_a', label: 'A', tol_plus: 0.5, tol_minus: 0.5, sort_priority: 1 },
      { calc_key: 'lp.B', tool_field: 'dim_b', label: 'B', tol_plus: 0.5, tol_minus: 0.5, sort_priority: 2 },
    ],
    result_fields: [
      { tool_field: 'dim_a', label: 'A' }, { tool_field: 'dim_b', label: 'B' },
      { tool_field: 'dim_c', label: 'C' }, { tool_field: 'dim_d', label: 'D' },
      { tool_field: 'dim_e', label: 'E' }, { tool_field: 'dim_f', label: 'F' },
      { tool_field: 'dim_g', label: 'G' }, { tool_field: 'dim_h', label: 'H' },
    ],
  },
  {
    machine_name: 'KS500RD', tool_category: 'WORK DRIVER',
    calc_context: 'ks500rd', target_tool_table: 'tooling_ks500rd',
    machine_ok_condition: 'ks500rdOK',
    dims: [
      { calc_key: 'wd.A', tool_field: 'dim_a', label: 'A (SD)', tol_plus: 1.0, tol_minus: 1.0, sort_priority: 1 },
      { calc_key: 'wd.B', tool_field: 'dim_b', label: 'B',      tol_plus: 1.0, tol_minus: 1.0, sort_priority: 2 },
    ],
    result_fields: [
      { tool_field: 'dim_a', label: 'A' }, { tool_field: 'dim_b', label: 'B' },
    ],
  },

  // ── KS400B5 ────────────────────────────────────────────────────────────────
  {
    machine_name: 'KS400B5', tool_category: 'WORK CLAMP',
    calc_context: 'ks400b5', target_tool_table: 'tooling_ks400b5',
    machine_ok_condition: 'ks400b5OK',
    dims: [
      { calc_key: 'workClamp.A', tool_field: 'dim_a', label: 'A', tol_plus: 1.0, tol_minus: 1.0, sort_priority: 1 },
    ],
    result_fields: [
      { tool_field: 'dim_a', label: 'A' }, { tool_field: 'dim_b', label: 'B' },
      { tool_field: 'dim_c', label: 'C' }, { tool_field: 'dim_d', label: 'D' },
    ],
  },
  {
    machine_name: 'KS400B5', tool_category: 'SHAFT',
    calc_context: 'ks400b5', target_tool_table: 'tooling_ks400b5',
    machine_ok_condition: 'ks400b5OK',
    dims: [
      { calc_key: 'shaft.A', tool_field: 'dim_a', label: 'A (SD)', tol_plus: 1.0, tol_minus: 1.0, sort_priority: 1 },
      { calc_key: 'shaft.C', tool_field: 'dim_c', label: 'C (ID)', tol_plus: 1.0, tol_minus: 1.0, sort_priority: 2 },
    ],
    result_fields: [
      { tool_field: 'dim_a', label: 'A' }, { tool_field: 'dim_b', label: 'B' }, { tool_field: 'dim_c', label: 'C' },
    ],
  },
  {
    machine_name: 'KS400B5', tool_category: 'WORK CHUTE',
    calc_context: 'ks400b5', target_tool_table: 'tooling_ks400b5',
    machine_ok_condition: 'ks400b5OK',
    dims: [
      { calc_key: 'workChute.A', tool_field: 'dim_a', label: 'A (OD)', tol_plus: 1.0, tol_minus: 0.1, sort_priority: 1 },
      { calc_key: 'workChute.B', tool_field: 'dim_b', label: 'B (W)',  tol_plus: 1.0, tol_minus: 0.1, sort_priority: 2 },
    ],
    result_fields: [
      { tool_field: 'dim_a', label: 'A' }, { tool_field: 'dim_b', label: 'B' },
      { tool_field: 'dim_c', label: 'C' }, { tool_field: 'dim_d', label: 'D' },
    ],
  },
  {
    machine_name: 'KS400B5', tool_category: 'CHUCK JAW',
    calc_context: 'ks400b5', target_tool_table: 'tooling_ks400b5',
    machine_ok_condition: 'ks400b5OK',
    dims: [
      { calc_key: 'chuckJaw.A', tool_field: 'dim_a', label: 'A (ID+)', tol_plus: 0.5, tol_minus: 0.5, sort_priority: 1 },
    ],
    result_fields: [
      { tool_field: 'dim_a', label: 'A' }, { tool_field: 'dim_b', label: 'B' },
      { tool_field: 'dim_c', label: 'C' }, { tool_field: 'dim_d', label: 'D' },
    ],
  },
  {
    machine_name: 'KS400B5', tool_category: 'STOPPER',
    calc_context: 'ks400b5', target_tool_table: 'tooling_ks400b5',
    machine_ok_condition: 'ks400b5OK',
    dims: [
      { calc_key: 'stopper.A', tool_field: 'dim_a', label: 'A', tol_plus: 0.5, tol_minus: 0.5, sort_priority: 1 },
    ],
    result_fields: [
      { tool_field: 'dim_a', label: 'A' }, { tool_field: 'dim_b', label: 'B' },
    ],
  },

  // ── KS400B6 ────────────────────────────────────────────────────────────────
  {
    machine_name: 'KS400B6', tool_category: 'WORK DRIVER',
    calc_context: 'ks400b6', target_tool_table: 'tooling_ks400b6',
    machine_ok_condition: 'ks400b6OK',
    dims: [
      { calc_key: 'workDriver.A', tool_field: 'dim_a', label: 'A (ID)', tol_plus: 1.0, tol_minus: 1.0, sort_priority: 1 },
      { calc_key: 'workDriver.B', tool_field: 'dim_b', label: 'B (SD)', tol_plus: 1.0, tol_minus: 1.0, sort_priority: 2 },
    ],
    result_fields: [
      { tool_field: 'dim_a', label: 'A' }, { tool_field: 'dim_b', label: 'B' },
      { tool_field: 'dim_c', label: 'C' }, { tool_field: 'dim_d', label: 'D' }, { tool_field: 'dim_e', label: 'E' },
    ],
  },
  {
    machine_name: 'KS400B6', tool_category: 'STOCKER CHUTE',
    calc_context: 'ks400b6', target_tool_table: 'tooling_ks400b6',
    machine_ok_condition: 'ks400b6OK',
    dims: [
      { calc_key: 'stockerChute.A', tool_field: 'dim_a', label: 'A (OD)', tol_plus: 1.0, tol_minus: 0.1, sort_priority: 1 },
      { calc_key: 'stockerChute.B', tool_field: 'dim_b', label: 'B (W)',  tol_plus: 1.0, tol_minus: 0.1, sort_priority: 2 },
    ],
    result_fields: [
      { tool_field: 'dim_a', label: 'A' }, { tool_field: 'dim_b', label: 'B' },
      { tool_field: 'dim_c', label: 'C' }, { tool_field: 'dim_d', label: 'D' },
    ],
  },
  {
    machine_name: 'KS400B6', tool_category: 'PLUG',
    calc_context: 'ks400b6', target_tool_table: 'tooling_ks400b6',
    machine_ok_condition: 'ks400b6OK',
    dims: [
      { calc_key: 'plug.A', tool_field: 'dim_a', label: 'A (ID)', tol_plus: 0.5, tol_minus: 0.5, sort_priority: 1 },
      { calc_key: 'plug.B', tool_field: 'dim_b', label: 'B (W)',  tol_plus: 1.5, tol_minus: 1.5, sort_priority: 2 },
    ],
    result_fields: [
      { tool_field: 'dim_a', label: 'A' }, { tool_field: 'dim_b', label: 'B' },
      { tool_field: 'dim_c', label: 'C' }, { tool_field: 'dim_d', label: 'D' },
    ],
  },
  {
    machine_name: 'KS400B6', tool_category: 'FRONT SHOE',
    calc_context: 'ks400b6', target_tool_table: 'tooling_ks400b6',
    machine_ok_condition: 'ks400b6OK',
    dims: [
      { calc_key: 'frontShoe.A', tool_field: 'dim_a', label: 'A', tol_plus: 1.0, tol_minus: 1.0, sort_priority: 1 },
    ],
    result_fields: [
      { tool_field: 'dim_a', label: 'A' }, { tool_field: 'dim_b', label: 'B' },
      { tool_field: 'dim_c', label: 'C' }, { tool_field: 'dim_d', label: 'D' },
    ],
  },
  {
    machine_name: 'KS400B6', tool_category: 'REAR SHOE',
    calc_context: 'ks400b6', target_tool_table: 'tooling_ks400b6',
    machine_ok_condition: 'ks400b6OK',
    dims: [
      { calc_key: 'rearShoe.A', tool_field: 'dim_a', label: 'A', tol_plus: 1.0, tol_minus: 1.0, sort_priority: 1 },
    ],
    result_fields: [
      { tool_field: 'dim_a', label: 'A' }, { tool_field: 'dim_b', label: 'B' },
      { tool_field: 'dim_c', label: 'C' }, { tool_field: 'dim_d', label: 'D' },
    ],
  },
  {
    machine_name: 'KS400B6', tool_category: 'PILOT PIN',
    calc_context: 'ks400b6', target_tool_table: 'tooling_ks400b6',
    machine_ok_condition: 'ks400b6OK',
    dims: [
      { calc_key: 'pilotPin.A', tool_field: 'dim_a', label: 'A', tol_plus: 0.5, tol_minus: 0.5, sort_priority: 1 },
    ],
    result_fields: [
      { tool_field: 'dim_a', label: 'A' }, { tool_field: 'dim_b', label: 'B' },
      { tool_field: 'dim_c', label: 'C' },
    ],
  },
];

async function seedAllRules() {
  console.log('🌱 Seeding all remaining machine rules...\n');
  const machines = [...new Set(RULES.map(r => r.machine_name))];

  try {
    for (const machine of machines) {
      await engPool.query(`DELETE FROM mtc_selection_rules WHERE machine_name = $1`, [machine]);
      console.log(`  🗑  Cleared old rules: ${machine}`);
    }

    for (const rule of RULES) {
      await engPool.query(`
        INSERT INTO mtc_selection_rules
          (machine_name, tool_category, calc_context, target_tool_table,
           machine_ok_condition, dims, result_fields, is_active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,true)
      `, [
        rule.machine_name, rule.tool_category, rule.calc_context,
        rule.target_tool_table, rule.machine_ok_condition,
        JSON.stringify(rule.dims), JSON.stringify(rule.result_fields),
      ]);
      console.log(`  ✅ ${rule.machine_name} / ${rule.tool_category}`);
    }

    const r = await engPool.query(
      `SELECT machine_name, COUNT(*) AS rule_count FROM mtc_selection_rules GROUP BY machine_name ORDER BY machine_name`
    );
    console.log('\n📋 Rules summary in DB:');
    console.table(r.rows);

  } catch (err) {
    console.error('❌ Seed failed:', err.message);
  } finally {
    process.exit(0);
  }
}

seedAllRules();
