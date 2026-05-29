'use strict';

const searchService = require('../services/searchService');

const search = async (req, res) => {
  const { cn } = req.body;
  if (!cn?.toString().trim()) {
    return res.status(400).json({ success: false, error: 'cn (CN number) is required' });
  }
  try {
    const result = await searchService.search(cn.toString().trim());
    if (!result.success) return res.status(404).json(result);
    res.json(result);
  } catch (err) {
    console.error('tsv2 search error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

module.exports = { search };
