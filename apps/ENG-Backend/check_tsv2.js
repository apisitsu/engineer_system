'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PG_NEW_HOST,
  port: +process.env.PG_NEW_PORT,
  database: process.env.PG_NEW_DB,
  user: process.env.PG_NEW_USER,
  password: process.env.PG_NEW_PASS,
});

async function main() {
  console.log('host:', process.env.PG_NEW_HOST, 'port:', process.env.PG_NEW_PORT);

  const { rows: machines } = await pool.query(
    'SELECT id, machine_name, inventory_table FROM tooling_machine ORDER BY id'
  );
  console.log('\n=== MACHINES ===');
  machines.forEach(x => console.log('  id=' + x.id, '[' + x.machine_name + ']', 'inv=' + x.inventory_table));

  const { rows: formulas } = await pool.query(`
    SELECT m.machine_name, f.tooling_name, f.output_key, f.formula_expr, f.condition_expr, f.sort_order
    FROM tooling_machine m
    JOIN tooling_formula f ON f.machine_id = m.id
    ORDER BY m.machine_name, f.tooling_name, f.sort_order, f.id
  `);

  console.log('\n=== FORMULAS ===');
  let cur = '';
  formulas.forEach(x => {
    const grp = x.machine_name + ' / ' + x.tooling_name;
    if (grp !== cur) { console.log('\n-- ' + grp + ' --'); cur = grp; }
    const cond = x.condition_expr ? ' [IF: ' + x.condition_expr + ']' : '';
    console.log('  s=' + String(x.sort_order).padStart(3) + ' ' + x.output_key + ' = ' + x.formula_expr + cond);
  });

  await pool.end();
}

main().catch(e => { console.error(e.message); pool.end(); });
