'use strict';

const { engPool } = require('../../../../instance/eng_db');
const { TABLES } = require('../mtcConstants');
const { tableExists, registerTable } = require('./inventoryService');

const ALPHA = 'abcdefghijklmnopqrstuvwxyz';

async function listToolingTables() {
  const r = await engPool.query(`
    SELECT t.table_name,
      array_agg(c.column_name::TEXT ORDER BY c.ordinal_position)
        FILTER (WHERE c.column_name NOT IN ('id','tooling_name','tooling_no','machine','created_at','updated_at')) AS data_cols
    FROM information_schema.tables t
    JOIN information_schema.columns c
      ON c.table_name = t.table_name AND c.table_schema = 'public'
    WHERE t.table_schema = 'public'
      AND t.table_name LIKE 'tooling_%'
      AND t.table_name != $1
    GROUP BY t.table_name
    ORDER BY t.table_name
  `, [TABLES.TI_LIST]);
  return r.rows;
}

async function createTable(machineName, dimCount) {
  const tableName = 'tooling_' +
    machineName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  if (!/^tooling_[a-z0-9_]+$/.test(tableName))
    throw Object.assign(new Error('Invalid machine name format'), { statusCode: 400 });

  if (await tableExists(tableName))
    throw Object.assign(new Error('Table already exists'), { statusCode: 400 });

  const count = Math.min(Math.max(parseInt(dimCount) || 6, 1), 26);
  const dimCols = Array.from({ length: count }, (_, i) => `dim_${ALPHA[i]} NUMERIC`).join(', ');

  await engPool.query(`
    CREATE TABLE ${tableName} (
      id SERIAL PRIMARY KEY,
      tooling_name TEXT,
      tooling_no   TEXT,
      ${dimCols},
      machine TEXT
    )
  `);

  registerTable(tableName);

  return { tableName, dimCount: count, lastDim: `dim_${ALPHA[count - 1]}` };
}

module.exports = { listToolingTables, createTable };
