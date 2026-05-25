'use strict';
/**
 * Migration: Add KS-400B1, KS-400B2, KS-400B7 to Tooling Select V2
 *
 * - Inserts 3 machines into tooling_machine (shared inventory: tooling_ks400b)
 * - Machine limits: OD ≤ 32, W ≤ 30
 * - Formulas per machine (5 tooling types each): LOADING CHUTE, PLUG(A), PLUG(B),
 *   SUPPORT BLOCK, WORK DRIVER — per formula_reference.md KS-400B1 section
 * - Search rules per machine: dim_d+dim_c for LOADING CHUTE, dim_a+dim_b for others
 *
 * Run: node db_migrations/add_ks400b1_b2_b7.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.PG_NEW_HOST,
  port: process.env.PG_NEW_PORT,
  database: process.env.PG_NEW_DB,
  user: process.env.PG_NEW_USER,
  password: process.env.PG_NEW_PASS,
});

// ─── Formula definitions per tooling type ────────────────────────────────────
// Each row: { tooling_name, output_key, formula_expr, condition_expr, sort_order, description }

const FORMULAS = {
  'LOADING CHUTE': [
    // NOTE: cannot use output_key='E' as intermediate — expr-eval treats E as Euler's number (2.71828)
    // Use 'od6' as the intermediate key instead
    { output_key: 'od6', formula_expr: 'floor(odAft_max / 6)',                       condition_expr: null, sort_order: 10,  description: 'OD/6 floor (intermediate for A calc)' },
    { output_key: 'A',   formula_expr: 'ceil(197 - odAft_max / 2 + od6)',            condition_expr: null, sort_order: 20,  description: 'Chute height' },
    { output_key: 'B', formula_expr: 'ceil(wAft_max + 6)',                           condition_expr: null, sort_order: 30,  description: 'Width+6 ceil' },
    { output_key: 'C', formula_expr: 'wAft_max + 0.2',                              condition_expr: null, sort_order: 40,  description: 'Width+0.2' },
    { output_key: 'D', formula_expr: 'odAft_max + 0.2',                             condition_expr: null, sort_order: 50,  description: 'OD+0.2 (bore opening)' },
    { output_key: 'F', formula_expr: 'C',                                            condition_expr: null, sort_order: 60,  description: 'Same as C' },
  ],

  'PLUG(A)': [
    { output_key: 'A', formula_expr: 'if(idAft_min < 20, idAft_min * 0.7, idAft_min - 4.0)',                     condition_expr: null, sort_order: 10, description: 'ID-derived bore' },
    { output_key: 'B', formula_expr: 'SD - 0.5',                                                                   condition_expr: null, sort_order: 20, description: 'Shoulder dia - 0.5' },
    { output_key: 'C', formula_expr: 'if(wAft_min <= 5, 7, roundN(wAft_min * 0.9, 1))',                           condition_expr: null, sort_order: 30, description: 'Width factor' },
    { output_key: 'D', formula_expr: 'if(idAft_min < 4, 0.5, 1)',                                                 condition_expr: null, sort_order: 40, description: 'Clearance step' },
    // E: TYPE1,3 → A/2 ; TYPE2 (SD>8.5 AND ID≤11.4) → 4
    { output_key: 'E', formula_expr: 'if(SD <= 8.5, A / 2, if(idAft_min <= 11.4, 4, A / 2))',                    condition_expr: null, sort_order: 50, description: 'Pilot depth (type-based)' },
    { output_key: 'F', formula_expr: '48',                                                                          condition_expr: null, sort_order: 60, description: 'Fixed length 48' },
  ],

  'PLUG(B)': [
    { output_key: 'A', formula_expr: 'if(idAft_min < 20, idAft_min - 0.7, idAft_min - 1.0)',                     condition_expr: null, sort_order: 10, description: 'ID-derived bore (looser fit)' },
    { output_key: 'B', formula_expr: 'SD - 0.5',                                                                   condition_expr: null, sort_order: 20, description: 'Shoulder dia - 0.5' },
    { output_key: 'C', formula_expr: 'if(wAft_min <= 5, 7, roundN(wAft_min * 0.9, 1))',                           condition_expr: null, sort_order: 30, description: 'Width factor' },
    { output_key: 'D', formula_expr: 'if(idAft_min < 4, 0.5, 1)',                                                 condition_expr: null, sort_order: 40, description: 'Clearance step' },
    { output_key: 'E', formula_expr: 'if(SD <= 8.5, A / 2, if(idAft_min <= 11.4, 4, A / 2))',                    condition_expr: null, sort_order: 50, description: 'Pilot depth (type-based)' },
    { output_key: 'F', formula_expr: '70',                                                                          condition_expr: null, sort_order: 60, description: 'Fixed length 70' },
  ],

  'SUPPORT BLOCK': [
    { output_key: 'A', formula_expr: '20 + odAft_max / 3',                          condition_expr: null, sort_order: 10, description: '20 + OD/3' },
    { output_key: 'B', formula_expr: 'wAft_max + 0.3',                              condition_expr: null, sort_order: 20, description: 'Width + 0.3' },
    { output_key: 'C', formula_expr: 'odAft_max * 5 / 6',                           condition_expr: null, sort_order: 30, description: 'OD×5/6' },
    { output_key: 'D', formula_expr: '30 - odAft_max / 2',                          condition_expr: null, sort_order: 40, description: '30 - OD/2' },
    { output_key: 'E', formula_expr: '30 + odAft_max / 4',                          condition_expr: null, sort_order: 50, description: '30 + OD/4' },
  ],

  'WORK DRIVER': [
    { output_key: 'A', formula_expr: 'ceil05(SD - 0.5)',                            condition_expr: null, sort_order: 10, description: 'SD-0.5 (round up 0.5)' },
    { output_key: 'B', formula_expr: 'floor05(ID - 0.8)',                           condition_expr: null, sort_order: 20, description: 'ID-0.8 (round down 0.5)' },
    { output_key: 'C', formula_expr: 'if(A < 13, 32, 36)',                          condition_expr: null, sort_order: 30, description: 'Fixed boss dia (32 or 36)' },
    { output_key: 'D', formula_expr: 'if(SD < 13.5, 24, 30)',                       condition_expr: null, sort_order: 40, description: 'Fixed drive dia (24 or 30)' },
    { output_key: 'E', formula_expr: '23',                                           condition_expr: null, sort_order: 50, description: 'Fixed: 23 (KS-400B1~B3,B7)' },
    { output_key: 'F', formula_expr: '8',                                            condition_expr: null, sort_order: 60, description: 'Fixed: 8 (KS-400B1~B3,B7)' },
  ],
};

// ─── Search rules per tooling type ───────────────────────────────────────────
// { output_key, inventory_column, tol_plus, tol_minus, label, sort_priority, inventory_tooling_filter }

const SEARCH_RULES = {
  'LOADING CHUTE': [
    { output_key: 'D', inventory_column: 'dim_d', tol_plus: 1.0, tol_minus: 1.0, label: 'Bore (D)',   sort_priority: 0, inventory_tooling_filter: 'LOADING CHUTE' },
    { output_key: 'C', inventory_column: 'dim_c', tol_plus: 1.0, tol_minus: 1.0, label: 'Width (C)',  sort_priority: 1, inventory_tooling_filter: null },
  ],
  'PLUG(A)': [
    { output_key: 'A', inventory_column: 'dim_a', tol_plus: 0.5, tol_minus: 0.5, label: 'Bore A',    sort_priority: 0, inventory_tooling_filter: 'PLUG(A)' },
    { output_key: 'B', inventory_column: 'dim_b', tol_plus: 0.5, tol_minus: 0.5, label: 'SD Fit B',  sort_priority: 1, inventory_tooling_filter: null },
  ],
  'PLUG(B)': [
    { output_key: 'A', inventory_column: 'dim_a', tol_plus: 0.5, tol_minus: 0.5, label: 'Bore A',    sort_priority: 0, inventory_tooling_filter: 'PLUG(B)' },
    { output_key: 'B', inventory_column: 'dim_b', tol_plus: 0.5, tol_minus: 0.5, label: 'SD Fit B',  sort_priority: 1, inventory_tooling_filter: null },
  ],
  'SUPPORT BLOCK': [
    { output_key: 'A', inventory_column: 'dim_a', tol_plus: 0.5, tol_minus: 0.5, label: 'Height A',  sort_priority: 0, inventory_tooling_filter: 'SUPPORT BLOCK' },
    { output_key: 'D', inventory_column: 'dim_d', tol_plus: 0.5, tol_minus: 0.5, label: 'Offset D',  sort_priority: 1, inventory_tooling_filter: null },
  ],
  'WORK DRIVER': [
    { output_key: 'A', inventory_column: 'dim_a', tol_plus: 0.5, tol_minus: 0.5, label: 'Driver A',  sort_priority: 0, inventory_tooling_filter: 'WORK DRIVER' },
    { output_key: 'B', inventory_column: 'dim_b', tol_plus: 0.5, tol_minus: 0.5, label: 'Bore B',    sort_priority: 1, inventory_tooling_filter: null },
  ],
};

const MACHINE_NAMES = ['KS-400B1', 'KS-400B2', 'KS-400B7'];

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Insert machines ────────────────────────────────────────────────────
    console.log('Inserting machines...');
    const machineIds = {};
    for (const name of MACHINE_NAMES) {
      // Skip if already exists
      const existing = await client.query(
        `SELECT id FROM tooling_machine WHERE machine_name = $1`,
        [name]
      );
      if (existing.rows.length > 0) {
        console.log(`  Machine ${name} already exists (id=${existing.rows[0].id}), skipping.`);
        machineIds[name] = existing.rows[0].id;
        continue;
      }
      const r = await client.query(
        `INSERT INTO tooling_machine (machine_name, label, inventory_table, enabled)
         VALUES ($1, $2, 'tooling_ks400b', true)
         RETURNING id`,
        [name, name]
      );
      machineIds[name] = r.rows[0].id;
      console.log(`  Inserted ${name} id=${r.rows[0].id}`);
    }

    // ── 2. Machine limits ─────────────────────────────────────────────────────
    console.log('Inserting machine limits...');
    for (const name of MACHINE_NAMES) {
      const machineId = machineIds[name];
      // Skip if limits already exist
      const existing = await client.query(
        `SELECT COUNT(*) FROM tooling_machine_limit WHERE machine_id = $1`,
        [machineId]
      );
      if (Number(existing.rows[0].count) > 0) {
        console.log(`  Limits for ${name} already exist, skipping.`);
        continue;
      }
      await client.query(
        `INSERT INTO tooling_machine_limit (machine_id, input_var, min_value, max_value, min_inclusive, max_inclusive, description, sort_order)
         VALUES
           ($1, 'OD', null, 32, true, true, 'OD ≤ 32 MAX',  10),
           ($1, 'W',  null, 30, true, true, 'W ≤ 30 MAX',   20)`,
        [machineId]
      );
      console.log(`  Limits inserted for ${name}`);
    }

    // ── 3. Formulas ───────────────────────────────────────────────────────────
    console.log('Inserting formulas...');
    for (const name of MACHINE_NAMES) {
      const machineId = machineIds[name];
      // Skip if any formulas already exist for this machine
      const existing = await client.query(
        `SELECT COUNT(*) FROM tooling_formula WHERE machine_id = $1`,
        [machineId]
      );
      if (Number(existing.rows[0].count) > 0) {
        console.log(`  Formulas for ${name} already exist (${existing.rows[0].count} rows), skipping.`);
        continue;
      }
      let totalInserted = 0;
      for (const [toolingName, rows] of Object.entries(FORMULAS)) {
        for (const row of rows) {
          await client.query(
            `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, condition_expr, sort_order, description)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [machineId, toolingName, row.output_key, row.formula_expr, row.condition_expr, row.sort_order, row.description]
          );
          totalInserted++;
        }
      }
      console.log(`  Formulas inserted for ${name}: ${totalInserted} rows`);
    }

    // ── 4. Search rules ───────────────────────────────────────────────────────
    console.log('Inserting search rules...');
    for (const name of MACHINE_NAMES) {
      const machineId = machineIds[name];
      const existing = await client.query(
        `SELECT COUNT(*) FROM tooling_search_rule WHERE machine_id = $1`,
        [machineId]
      );
      if (Number(existing.rows[0].count) > 0) {
        console.log(`  Search rules for ${name} already exist (${existing.rows[0].count} rows), skipping.`);
        continue;
      }
      let totalInserted = 0;
      for (const [toolingName, rules] of Object.entries(SEARCH_RULES)) {
        for (const rule of rules) {
          await client.query(
            `INSERT INTO tooling_search_rule (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus, label, sort_priority, inventory_tooling_filter)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [machineId, toolingName, rule.output_key, rule.inventory_column,
             rule.tol_plus, rule.tol_minus, rule.label, rule.sort_priority, rule.inventory_tooling_filter]
          );
          totalInserted++;
        }
      }
      console.log(`  Search rules inserted for ${name}: ${totalInserted} rows`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Migration complete.');

    // ── Summary ───────────────────────────────────────────────────────────────
    for (const name of MACHINE_NAMES) {
      const mid = machineIds[name];
      const [fc, rc] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM tooling_formula WHERE machine_id=$1`, [mid]),
        pool.query(`SELECT COUNT(*) FROM tooling_search_rule WHERE machine_id=$1`, [mid]),
      ]);
      console.log(`  ${name} (id=${mid}): ${fc.rows[0].count} formulas, ${rc.rows[0].count} search rules`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed, rolled back:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
