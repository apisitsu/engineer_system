'use strict';

const express = require('express');
const router = express.Router();
const { findFixtures } = require('../tooling/fixtureLogic');

// POST /api/tooling-select/search
router.post('/search', async (req, res) => {
  const { cnNumber } = req.body;
  if (!cnNumber || !String(cnNumber).trim()) {
    return res.status(400).json({ success: false, error: 'cnNumber is required' });
  }
  const result = await findFixtures(cnNumber);
  if (!result.success) {
    return res.status(404).json(result);
  }
  res.json(result);
});

module.exports = router;
