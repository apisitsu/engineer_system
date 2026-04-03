'use strict';
/**
 * Phase 2: Seed Script - ย้าย Hardcode rules ของ KS400B เข้า mtc_selection_rules
 * Run: node db_migrations/seed_ks400b_rules.js
 */

const { engPool } = require('../instance/eng_db');

// ── กฎทั้งหมดสำหรับ KS400B ──────────────────────────────────────────────────
const KS400B_RULES = [
  {
    machine_name: 'KS400B',
    tool_category: 'WORK DRIVER',
    calc_context: 'ks400b',
    target_tool_table: 'tooling_ks400b',
    machine_ok_condition: 'ks400bOK',
    dims: [
      { calc_key: 'wd_A', tool_field: 'dim_a', label: 'A (SD)',   tol_plus: 1.01, tol_minus: 1.01, sort_priority: 1, penalty_over: 1.01 },
      { calc_key: 'wd_B', tool_field: 'dim_b', label: 'B (ID)',   tol_plus: 1.01, tol_minus: 1.01, sort_priority: 2, penalty_over: 1.01 },
      { calc_key: 'wd_E', tool_field: 'dim_e', label: 'E',        tol_plus: 5.0,  tol_minus: 5.0,  sort_priority: 3 },
    ],
    result_fields: [
      { tool_field: 'dim_a', label: 'A' },
      { tool_field: 'dim_b', label: 'B' },
      { tool_field: 'dim_c', label: 'C' },
      { tool_field: 'dim_d', label: 'D' },
      { tool_field: 'dim_e', label: 'E' },
    ],
  },
  {
    machine_name: 'KS400B',
    tool_category: 'SUPPORT BLOCK',
    calc_context: 'ks400b',
    target_tool_table: 'tooling_ks400b',
    machine_ok_condition: 'ks400bOK',
    dims: [
      { calc_key: 'sb_A', tool_field: 'dim_a', label: 'A',  tol_plus: 2.0, tol_minus: 2.0, sort_priority: 1 },
      { calc_key: 'sb_B', tool_field: 'dim_b', label: 'B',  tol_plus: 1.0, tol_minus: 1.0, sort_priority: 2 },
    ],
    result_fields: [
      { tool_field: 'dim_a', label: 'A' },
      { tool_field: 'dim_b', label: 'B' },
      { tool_field: 'dim_c', label: 'C' },
      { tool_field: 'dim_d', label: 'D' },
    ],
  },
  {
    machine_name: 'KS400B',
    tool_category: 'LOADING CHUTE',
    calc_context: 'ks400b',
    target_tool_table: 'tooling_ks400b',
    machine_ok_condition: 'ks400bOK',
    dims: [
      { calc_key: 'lc_D', tool_field: 'dim_d', label: 'D (OD)', tol_plus: 1.0, tol_minus: 1.0, sort_priority: 1, penalty_over: 0.5 },
      { calc_key: 'lc_C', tool_field: 'dim_c', label: 'C (W)',  tol_plus: 1.0, tol_minus: 1.0, sort_priority: 2 },
    ],
    result_fields: [
      { tool_field: 'dim_a', label: 'A' },
      { tool_field: 'dim_b', label: 'B' },
      { tool_field: 'dim_c', label: 'C' },
      { tool_field: 'dim_d', label: 'D' },
    ],
  },
  {
    machine_name: 'KS400B',
    tool_category: 'PLUG(A)',
    calc_context: 'ks400b',
    target_tool_table: 'tooling_ks400b',
    machine_ok_condition: 'ks400bOK',
    dims: [
      { calc_key: 'pa_A', tool_field: 'dim_a', label: 'A', tol_plus: 0.5, tol_minus: 0.5, sort_priority: 1 },
      { calc_key: 'pa_B', tool_field: 'dim_b', label: 'B', tol_plus: 2.0, tol_minus: 2.0, sort_priority: 2 },
    ],
    result_fields: [
      { tool_field: 'dim_a', label: 'A' },
      { tool_field: 'dim_b', label: 'B' },
      { tool_field: 'dim_c', label: 'C' },
      { tool_field: 'dim_d', label: 'D' },
      { tool_field: 'dim_e', label: 'E' },
    ],
  },
  {
    machine_name: 'KS400B',
    tool_category: 'PLUG(B)',
    calc_context: 'ks400b',
    target_tool_table: 'tooling_ks400b',
    machine_ok_condition: 'ks400bOK',
    dims: [
      { calc_key: 'pb_A', tool_field: 'dim_a', label: 'A', tol_plus: 1.01, tol_minus: 1.01, sort_priority: 1, penalty_over: 1.01 },
      { calc_key: 'pb_B', tool_field: 'dim_b', label: 'B', tol_plus: 1.01, tol_minus: 1.01, sort_priority: 2, penalty_over: 1.01 },
    ],
    result_fields: [
      { tool_field: 'dim_a', label: 'A' },
      { tool_field: 'dim_b', label: 'B' },
      { tool_field: 'dim_c', label: 'C' },
      { tool_field: 'dim_d', label: 'D' },
      { tool_field: 'dim_e', label: 'E' },
    ],
  },
];

async function seedRules() {
  console.log('🌱 Seeding KS400B rules into mtc_selection_rules...');
  try {
    // ลบกฎเก่าของ KS400B ถ้ามี
    await engPool.query(`DELETE FROM mtc_selection_rules WHERE machine_name = 'KS400B'`);
    console.log('  🗑 Cleared old KS400B rules.');

    for (const rule of KS400B_RULES) {
      await engPool.query(`
        INSERT INTO mtc_selection_rules
          (machine_name, tool_category, calc_context, target_tool_table,
           machine_ok_condition, dims, result_fields, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      `, [
        rule.machine_name,
        rule.tool_category,
        rule.calc_context,
        rule.target_tool_table,
        rule.machine_ok_condition,
        JSON.stringify(rule.dims),
        JSON.stringify(rule.result_fields),
      ]);
      console.log(`  ✅ Inserted rule: ${rule.machine_name} / ${rule.tool_category}`);
    }

    // แสดงผลลัพธ์
    const r = await engPool.query(`SELECT id, machine_name, tool_category, calc_context FROM mtc_selection_rules ORDER BY id`);
    console.log('\n📋 Current rules in DB:');
    console.table(r.rows);

  } catch (err) {
    console.error('❌ Seed failed:', err.message);
  } finally {
    process.exit(0);
  }
}

seedRules();
