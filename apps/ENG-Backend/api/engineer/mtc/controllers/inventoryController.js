'use strict';

const { engPool } = require('../../../../instance/eng_db');

// Whitelist: table name must match tooling_* and exist in public schema
async function assertInventoryTable(table) {
  if (!/^[a-z0-9_]+$/i.test(table)) throw Object.assign(new Error('Invalid table name'), { status: 400 });
  const r = await engPool.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1 AND table_name LIKE 'tooling_%'`,
    [table]
  );
  if (!r.rows.length) throw Object.assign(new Error(`Table "${table}" not found`), { status: 404 });
}

// GET /inventory/:table?machine=KS-B22G
const list = async (req, res) => {
  const table = req.params.table;
  try {
    await assertInventoryTable(table);
    const { machine } = req.query;
    let sql = `SELECT * FROM "${table}"`;
    const params = [];
    if (machine) {
      // Check if Machine column exists
      const colCheck = await engPool.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema='public' AND table_name=$1 AND column_name='Machine'`,
        [table]
      );
      if (colCheck.rows.length) {
        sql += ` WHERE "Machine" = $1`;
        params.push(machine);
      }
    }
    sql += ' ORDER BY id ASC';
    const { rows } = await engPool.query(sql, params);
    res.json({ success: true, rows });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// POST /inventory/:table
const create = async (req, res) => {
  const table = req.params.table;
  try {
    await assertInventoryTable(table);

    const body = { ...req.body };
    delete body.id; // never let client set id

    const keys = Object.keys(body);
    if (!keys.length) return res.status(400).json({ success: false, error: 'No fields provided' });

    // Validate column names against information_schema
    const colRes = await engPool.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1`,
      [table]
    );
    const validCols = new Set(colRes.rows.map(r => r.column_name));
    const safeKeys = keys.filter(k => k !== 'id' && validCols.has(k));
    if (!safeKeys.length) return res.status(400).json({ success: false, error: 'No valid columns' });

    const cols   = safeKeys.map(k => `"${k}"`).join(', ');
    const vals   = safeKeys.map((_, i) => `$${i + 1}`).join(', ');
    const values = safeKeys.map(k => body[k] === '' ? null : body[k]);

    const { rows } = await engPool.query(
      `INSERT INTO "${table}" (${cols}) VALUES (${vals}) RETURNING *`,
      values
    );
    res.json({ success: true, row: rows[0] });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// PUT /inventory/:table/:id
const update = async (req, res) => {
  const { table, id } = req.params;
  try {
    await assertInventoryTable(table);

    const body = { ...req.body };
    delete body.id;

    const keys = Object.keys(body);
    if (!keys.length) return res.status(400).json({ success: false, error: 'No fields provided' });

    const colRes = await engPool.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1`,
      [table]
    );
    const validCols = new Set(colRes.rows.map(r => r.column_name));
    const safeKeys = keys.filter(k => k !== 'id' && validCols.has(k));
    if (!safeKeys.length) return res.status(400).json({ success: false, error: 'No valid columns' });

    const setClauses = safeKeys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const values = safeKeys.map(k => body[k] === '' ? null : body[k]);
    values.push(Number(id));

    const { rows, rowCount } = await engPool.query(
      `UPDATE "${table}" SET ${setClauses} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!rowCount) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, row: rows[0] });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// DELETE /inventory/:table/:id
const remove = async (req, res) => {
  const { table, id } = req.params;
  try {
    await assertInventoryTable(table);
    const { rowCount } = await engPool.query(
      `DELETE FROM "${table}" WHERE id = $1`, [Number(id)]
    );
    if (!rowCount) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

module.exports = { list, create, update, remove };
