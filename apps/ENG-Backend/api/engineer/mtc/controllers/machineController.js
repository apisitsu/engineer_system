'use strict';

const { engPool } = require('../../../../instance/eng_db');
const { TSV2_TABLES } = require('../tsv2Constants');

const list = async (req, res) => {
  try {
    const { rows } = await engPool.query(
      `SELECT * FROM ${TSV2_TABLES.MACHINE} ORDER BY machine_name ASC`
    );
    res.json({ success: true, machines: rows });
  } catch (err) {
    console.error('tsv2 machine list error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

const create = async (req, res) => {
  const { machine_name, label, inventory_table, inventory_machine_filter, enabled } = req.body;
  if (!machine_name?.trim()) {
    return res.status(400).json({ success: false, error: 'machine_name is required' });
  }
  try {
    const { rows } = await engPool.query(
      `INSERT INTO ${TSV2_TABLES.MACHINE}
         (machine_name, label, inventory_table, inventory_machine_filter, enabled)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [machine_name.trim(), label || null, inventory_table || null,
       inventory_machine_filter || null, enabled !== false]
    );
    res.json({ success: true, machine: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'machine_name already exists' });
    }
    console.error('tsv2 machine create error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

const update = async (req, res) => {
  const { id } = req.params;
  const { machine_name, label, inventory_table, inventory_machine_filter, enabled } = req.body;
  try {
    const { rows } = await engPool.query(
      `UPDATE ${TSV2_TABLES.MACHINE}
          SET machine_name = COALESCE($1, machine_name),
              label = $2,
              inventory_table = $3,
              inventory_machine_filter = $4,
              enabled = COALESCE($5, enabled),
              updated_at = NOW()
        WHERE id = $6 RETURNING *`,
      [machine_name?.trim() || null, label || null, inventory_table || null,
       inventory_machine_filter || null, enabled, Number(id)]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, machine: rows[0] });
  } catch (err) {
    console.error('tsv2 machine update error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

const remove = async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await engPool.query(
      `DELETE FROM ${TSV2_TABLES.MACHINE} WHERE id = $1`, [Number(id)]
    );
    if (!rowCount) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('tsv2 machine delete error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

// GET /api/tooling-select-v2/inventory-tables — list available inventory tables for dropdown
const getInventoryTables = async (req, res) => {
  try {
    const { rows } = await engPool.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name LIKE 'tooling_%'
        ORDER BY table_name ASC`
    );
    res.json({ success: true, tables: rows.map(r => r.table_name) });
  } catch (err) {
    console.error('tsv2 inventory-tables error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

module.exports = { list, create, update, remove, getInventoryTables };
