'use strict';

const express   = require('express');
const { pool: rodpcPool } = require('../../../../instance/instance');
const { maqPool }         = require('../../../../instance/maq_db');
const { search }          = require('../services/SdsOrchestrator');

const router = express.Router();

router.get('/search', async (req, res) => {
  const { cn } = req.query;
  if (!cn?.trim()) return res.status(400).json({ error: 'cn is required' });
  try {
    const data = await search(cn, maqPool, rodpcPool);
    if (data.success === false) {
      return res.status(500).json({ error: data.error });
    }
    res.json(data);
  } catch (err) {
    console.error('[SDS v2] search error:', err.message);
    const status = err.message.startsWith('Unknown CN') || err.message.startsWith('Cannot convert') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

module.exports = router;
