'use strict';

const { engPool } = require('../../../../instance/eng_db');

const _tableCache = new Map();
const _colCache   = new Map();
const _colCacheAt = new Map();
const COL_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const ALLOWED_TABLES = new Set([
  'tooling_ksb22g',
  'tooling_ksb80',
  'tooling_tsg300',
  'tooling_ks03a',
  'tooling_ks400b',
  'tooling_ks500rd',
  'tooling_ks400b5',
  'tooling_ks400b6',
]);

async function tableExists(tableName) {
  if (!/^tooling_[a-z0-9_]+$/.test(tableName)) return false;
  if (ALLOWED_TABLES.has(tableName)) return true;
  if (_tableCache.has(tableName)) return _tableCache.get(tableName);
  const r = await engPool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
    [tableName]
  );
  const exists = r.rows.length > 0;
  _tableCache.set(tableName, exists);
  return exists;
}

function registerTable(tableName) {
  _tableCache.set(tableName, true);
  _colCache.delete(tableName);
  _colCacheAt.delete(tableName);
}

async function getValidColumns(tableName) {
  const now = Date.now();
  if (_colCache.has(tableName) && now - (_colCacheAt.get(tableName) || 0) < COL_CACHE_TTL_MS) {
    return _colCache.get(tableName);
  }
  const r = await engPool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
    [tableName]
  );
  const cols = new Set(r.rows.map(row => row.column_name));
  _colCache.set(tableName, cols);
  _colCacheAt.set(tableName, now);
  return cols;
}

async function listRecords(tableName) {
  const r = await engPool.query(`SELECT * FROM ${tableName} ORDER BY id ASC`);
  return r.rows;
}

async function getToolingNames(tableName) {
  const r = await engPool.query(
    `SELECT DISTINCT tooling_name FROM ${tableName} WHERE tooling_name IS NOT NULL ORDER BY tooling_name`
  );
  return r.rows.map(row => row.tooling_name);
}

async function insertRecord(tableName, data) {
  const validCols = await getValidColumns(tableName);
  const fields = Object.keys(data).filter(
    f => f !== 'id' && f !== 'created_at' && f !== 'updated_at'
      && data[f] !== null && data[f] !== ''
      && validCols.has(f)
  );
  if (fields.length === 0) throw Object.assign(new Error('No valid data provided'), { statusCode: 400 });
  const cols = fields.join(', ');
  const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
  const r = await engPool.query(
    `INSERT INTO ${tableName} (${cols}) VALUES (${placeholders}) RETURNING *`,
    fields.map(f => data[f])
  );
  return r.rows[0];
}

async function updateRecord(tableName, id, data) {
  const validCols = await getValidColumns(tableName);
  const fields = Object.keys(data).filter(
    f => f !== 'id' && f !== 'created_at' && f !== 'updated_at' && validCols.has(f)
  );
  if (fields.length === 0) throw Object.assign(new Error('No valid fields to update'), { statusCode: 400 });
  const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values = [...fields.map(f => data[f]), id];
  const r = await engPool.query(
    `UPDATE ${tableName} SET ${setClause} WHERE id = $${values.length} RETURNING *`,
    values
  );
  return r.rows[0];
}

async function deleteRecord(tableName, id) {
  const r = await engPool.query(`DELETE FROM ${tableName} WHERE id = $1 RETURNING id`, [id]);
  if (r.rowCount === 0) throw Object.assign(new Error('Record not found'), { statusCode: 404 });
  return r.rows[0].id;
}

module.exports = {
  tableExists,
  registerTable,
  getValidColumns,
  listRecords,
  getToolingNames,
  insertRecord,
  updateRecord,
  deleteRecord,
};
