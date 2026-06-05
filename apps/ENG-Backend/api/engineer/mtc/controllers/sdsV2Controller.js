'use strict';

const express   = require('express');
const { pool: rodpcPool } = require('../../../../instance/instance');
const { maqPool }         = require('../../../../instance/maq_db');
const { engPool }         = require('../../../../instance/eng_db');
const { search }          = require('../services/SdsOrchestrator');

const router = express.Router();

// Fire-and-forget access log — never blocks the main response
function logAccess(cn, machine_type_name, access_type, req) {
  const accessed_by = req.user?.empno || req.user?.name || null;
  engPool.query(
    `INSERT INTO sds_access_log (cn, machine_type_name, access_type, accessed_by) VALUES ($1,$2,$3,$4)`,
    [cn, machine_type_name || null, access_type, accessed_by]
  ).catch(() => {});
}

router.get('/search', async (req, res) => {
  const { cn } = req.query;
  if (!cn?.trim()) return res.status(400).json({ error: 'cn is required' });
  try {
    const data = await search(cn, maqPool, rodpcPool);
    if (data.success === false) {
      return res.status(500).json({ error: data.error });
    }
    logAccess(cn.trim().toUpperCase(), null, 'VIEW', req);
    res.json(data);
  } catch (err) {
    console.error('[SDS v2] search error:', err.message);
    const status = err.message.startsWith('Unknown CN') || err.message.startsWith('Cannot convert') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

module.exports = router;
