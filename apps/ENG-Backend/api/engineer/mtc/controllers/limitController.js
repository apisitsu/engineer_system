'use strict';

const { engPool } = require('../../../../instance/eng_db');
const { TSV2_TABLES } = require('../tsv2Constants');

const list = async (req, res) => {
  const { machineId } = req.params;
  try {
    const { rows } = await engPool.query(
      `SELECT * FROM ${TSV2_TABLES.LIMIT}
        WHERE machine_id = $1
        ORDER BY sort_order ASC, id ASC`,
      [Number(machineId)]
    );
    res.json({ success: true, limits: rows });
  } catch (err) {
    console.error('tsv2 limit list error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

const create = async (req, res) => {
  const { machineId } = req.params;
  const { input_var, min_value, max_value, min_inclusive, max_inclusive, description, sort_order } = req.body;
  if (!input_var?.trim()) {
    return res.status(400).json({ success: false, error: 'input_var is required' });
  }
  try {
    const { rows } = await engPool.query(
      `INSERT INTO ${TSV2_TABLES.LIMIT}
         (machine_id, input_var, min_value, max_value, min_inclusive, max_inclusive, description, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [Number(machineId), input_var.trim().toUpperCase(),
       min_value ?? null, max_value ?? null,
       min_inclusive !== false, max_inclusive !== false,
       description || null, sort_order ?? 0]
    );
    res.json({ success: true, limit: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: `Limit for "${input_var}" already exists on this machine` });
    }
    console.error('tsv2 limit create error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

const update = async (req, res) => {
  const { id } = req.params;
  const { min_value, max_value, min_inclusive, max_inclusive, description, sort_order } = req.body;
  try {
    const { rows } = await engPool.query(
      `UPDATE ${TSV2_TABLES.LIMIT}
          SET min_value = $1, max_value = $2,
              min_inclusive = $3, max_inclusive = $4,
              description = $5, sort_order = $6
        WHERE id = $7 RETURNING *`,
      [min_value ?? null, max_value ?? null,
       min_inclusive !== false, max_inclusive !== false,
       description || null, sort_order ?? 0, Number(id)]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, limit: rows[0] });
  } catch (err) {
    console.error('tsv2 limit update error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

const remove = async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await engPool.query(
      `DELETE FROM ${TSV2_TABLES.LIMIT} WHERE id = $1`, [Number(id)]
    );
    if (!rowCount) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('tsv2 limit delete error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

module.exports = { list, create, update, remove };
