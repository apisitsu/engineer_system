'use strict';

/**
 * Lot Status Tracker — HTTP layer.
 *
 *   GET /api/mtc/lot-track/search?q=UD00      → lot-no autocomplete (maqdb only)
 *   GET /api/mtc/lot-track/:lotNo?control_no=&source=
 *        → full roadmap, or { ambiguous, candidates } when lot_no maps to
 *          several control numbers and none was given.
 *
 * Read-only. `verifyToken` is applied at the router mount in server.js.
 */

const { maqPool } = require('../../../../instance/maq_db');
const { getLotStatus } = require('./lotTrackService');

async function searchLots(req, res) {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ results: [] });
  try {
    const { rows } = await maqPool.query(
      `SELECT lot_no, control_no, parts_no, gnk,
              to_char(entry_date, 'YYYY-MM-DD') AS entry_date,
              btrim(coalesce(remark1,'')) AS remark
         FROM lpb.pc_lot
        WHERE lot_no ILIKE $1 || '%'
        ORDER BY update_time DESC NULLS LAST
        LIMIT 25`,
      [q],
    );
    res.json({
      results: rows.map((r) => ({
        lotNo: r.lot_no,
        controlNo: r.control_no,
        partsNo: r.parts_no,
        gnk: r.gnk,
        entryDate: r.entry_date,
        remark: r.remark || null,
      })),
    });
  } catch (err) {
    console.error('[lot-track] search failed:', err.message);
    res.status(500).json({ error: 'search_failed', detail: err.message });
  }
}

async function getLot(req, res) {
  const lotNo = String(req.params.lotNo || '').trim();
  if (!lotNo) return res.status(400).json({ error: 'lot_no is required' });
  try {
    const data = await getLotStatus(lotNo, {
      controlNo: req.query.control_no,
      source: req.query.source,
    });
    if (!data.found) return res.status(404).json({ error: 'lot_not_found', lotNo });
    res.json(data);
  } catch (err) {
    console.error(`[lot-track] getLot ${lotNo} failed:`, err.message);
    res.status(500).json({ error: 'lot_track_failed', detail: err.message });
  }
}

module.exports = { searchLots, getLot };
