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

// GET /inventory-lookup?machine=<machine_name|machine_group>&tooling_no=<no>
// Returns the inventory row for a specific tooling_no from the machine's inventory
// table — exact match first, then "xxxx-xx" prefix fallback (same family-prefix rule
// the SDS/T-Select coupling uses). Powers the SDS dim-compare modal, which shows the
// factory tool's dimensions next to T-Select #1/#2. `row: null` = not found (no error).
const lookup = async (req, res) => {
  const machine = (req.query.machine || '').trim();
  const toolingNo = (req.query.tooling_no || '').trim();
  try {
    if (!machine || !toolingNo) {
      return res.status(400).json({ success: false, error: 'machine and tooling_no are required' });
    }
    // Resolve the machine (or its group display name) to its inventory table.
    const mr = await engPool.query(
      `SELECT inventory_table FROM tooling_machine
        WHERE (machine_name = $1 OR machine_group = $1) AND inventory_table IS NOT NULL
        LIMIT 1`,
      [machine]
    );
    const table = mr.rows[0]?.inventory_table;
    if (!table) return res.json({ success: true, table: null, row: null });
    await assertInventoryTable(table);

    // Guard: the standard inventory tables key tools by a "tooling_no" column.
    const colCheck = await engPool.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 AND column_name='tooling_no'`,
      [table]
    );
    if (!colCheck.rows.length) return res.json({ success: true, table, row: null });

    let q = await engPool.query(`SELECT * FROM "${table}" WHERE tooling_no = $1 LIMIT 1`, [toolingNo]);
    if (!q.rows.length) {
      const parts = toolingNo.split('-');
      const prefix = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : toolingNo;
      q = await engPool.query(
        `SELECT * FROM "${table}" WHERE tooling_no LIKE $1 ORDER BY tooling_no LIMIT 1`,
        [`${prefix}-%`]
      );
    }
    res.json({ success: true, table, row: q.rows[0] || null });
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

module.exports = { list, lookup, create, update, remove };
