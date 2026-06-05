'use strict';

const { engPool } = require('../../../../instance/eng_db');
const { TSV2_TABLES } = require('../tsv2Constants');

const list = async (req, res) => {
  const { machineId } = req.params;
  const { tooling_name } = req.query;
  try {
    let query, params;
    if (tooling_name?.trim()) {
      query = `SELECT * FROM ${TSV2_TABLES.SEARCH_RULE}
                WHERE machine_id = $1 AND tooling_name = $2
                ORDER BY sort_priority ASC, id ASC`;
      params = [Number(machineId), tooling_name.trim()];
    } else {
      query = `SELECT * FROM ${TSV2_TABLES.SEARCH_RULE}
                WHERE machine_id = $1
                ORDER BY tooling_name ASC, sort_priority ASC, id ASC`;
      params = [Number(machineId)];
    }
    const { rows } = await engPool.query(query, params);
    res.json({ success: true, rules: rows });
  } catch (err) {
    console.error('tsv2 searchRule list error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

const create = async (req, res) => {
  const { machineId } = req.params;
  const { tooling_name, output_key, inventory_column, tol_plus, tol_minus, sort_priority, label, inventory_tooling_filter, inventory_table_override, is_match_dim } = req.body;
  if (!tooling_name?.trim() || !output_key?.trim() || !inventory_column?.trim()) {
    return res.status(400).json({ success: false, error: 'tooling_name, output_key, inventory_column are required' });
  }
  try {
    const { rows } = await engPool.query(
      `INSERT INTO ${TSV2_TABLES.SEARCH_RULE}
         (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus, sort_priority, label, inventory_tooling_filter, inventory_table_override, is_match_dim)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (machine_id, tooling_name, output_key) DO UPDATE
         SET inventory_column          = EXCLUDED.inventory_column,
             tol_plus                  = EXCLUDED.tol_plus,
             tol_minus                 = EXCLUDED.tol_minus,
             sort_priority             = EXCLUDED.sort_priority,
             label                     = EXCLUDED.label,
             inventory_tooling_filter  = EXCLUDED.inventory_tooling_filter,
             inventory_table_override  = EXCLUDED.inventory_table_override,
             is_match_dim              = EXCLUDED.is_match_dim
       RETURNING *`,
      [Number(machineId), tooling_name.trim(), output_key.trim().toUpperCase(),
       inventory_column.trim(),
       tol_plus !== '' && tol_plus !== null && tol_plus !== undefined ? Number(tol_plus) : null,
       tol_minus !== '' && tol_minus !== null && tol_minus !== undefined ? Number(tol_minus) : null,
       sort_priority ?? 0, label || null,
       inventory_tooling_filter?.trim() || null,
       inventory_table_override?.trim() || null,
       is_match_dim === false ? false : true]
    );
    res.json({ success: true, rule: rows[0] });
  } catch (err) {
    console.error('tsv2 searchRule create error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

const update = async (req, res) => {
  const { id } = req.params;
  const { inventory_column, tol_plus, tol_minus, sort_priority, label, inventory_tooling_filter, inventory_table_override, is_match_dim } = req.body;
  try {
    const tolPlus  = tol_plus  !== '' && tol_plus  != null ? Number(tol_plus)  : null;
    const tolMinus = tol_minus !== '' && tol_minus != null ? Number(tol_minus) : null;
    const { rows } = await engPool.query(
      `UPDATE ${TSV2_TABLES.SEARCH_RULE}
          SET inventory_column          = COALESCE($1, inventory_column),
              tol_plus                  = $2,
              tol_minus                 = $3,
              sort_priority             = COALESCE($4, sort_priority),
              label                     = $5,
              inventory_tooling_filter  = $6,
              inventory_table_override  = $7,
              is_match_dim              = COALESCE($8, is_match_dim)
        WHERE id = $9 RETURNING *`,
      [inventory_column?.trim() || null, tolPlus, tolMinus,
       sort_priority ?? null, label || null,
       inventory_tooling_filter?.trim() || null,
       inventory_table_override?.trim() || null,
       typeof is_match_dim === 'boolean' ? is_match_dim : null,
       Number(id)]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, rule: rows[0] });
  } catch (err) {
    console.error('tsv2 searchRule update error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

const remove = async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await engPool.query(
      `DELETE FROM ${TSV2_TABLES.SEARCH_RULE} WHERE id = $1`, [Number(id)]
    );
    if (!rowCount) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('tsv2 searchRule delete error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

// GET /api/tooling-select-v2/columns/:table — list columns from inventory table
const getColumns = async (req, res) => {
  const table = req.params.table;
  // Sanitise: only alphanumeric + underscore
  if (!/^[a-z0-9_]+$/i.test(table)) {
    return res.status(400).json({ success: false, error: 'Invalid table name' });
  }
  try {
    const { rows } = await engPool.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position ASC`,
      [table]
    );
    res.json({ success: true, columns: rows.map(r => r.column_name) });
  } catch (err) {
    console.error('tsv2 columns error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

module.exports = { list, create, update, remove, getColumns };
