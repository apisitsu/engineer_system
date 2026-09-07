'use strict';

/**
 * Lot Status Tracker — HTTP layer.
 *
 *   GET    /api/mtc/lot-track/search?q=UD00               → lot-no autocomplete (maqdb only)
 *   GET    /api/mtc/lot-track/saved                       → the user's saved tracks
 *   POST   /api/mtc/lot-track/saved   { name, lots }      → create a saved track
 *   PUT    /api/mtc/lot-track/saved/:id { name?, lots? }  → rename / re-point (owner only)
 *   DELETE /api/mtc/lot-track/saved/:id                   → delete (owner only)
 *   GET    /api/mtc/lot-track/:lotNo?control_no=&source=
 *        → full roadmap, or { ambiguous, candidates } when lot_no maps to
 *          several control numbers and none was given.
 *
 * The roadmap reads are read-only; the /saved routes write per-user rows.
 * `verifyToken` is applied at the router mount in server.js.
 */

const { maqPool } = require('../../../../instance/maq_db');
const { getLotStatus } = require('./lotTrackService');
const savedStore = require('./savedStore');

const empnoOf = (req) => String(req.user?.empno || req.user?.id || '').trim();

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

// ── saved tracks (per user) ─────────────────────────────────────────────────
async function listSaved(req, res) {
  const empno = empnoOf(req);
  if (!empno) return res.status(401).json({ error: 'no_user' });
  try {
    res.json({ tracks: await savedStore.listSaved(empno) });
  } catch (err) {
    console.error('[lot-track] listSaved failed:', err.message);
    res.status(500).json({ error: 'saved_list_failed', detail: err.message });
  }
}

async function createSaved(req, res) {
  const empno = empnoOf(req);
  if (!empno) return res.status(401).json({ error: 'no_user' });
  const { name, lots } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
  if (!Array.isArray(lots) || lots.length === 0) return res.status(400).json({ error: 'lots must be a non-empty array' });
  try {
    res.status(201).json({ track: await savedStore.createSaved(empno, name, lots) });
  } catch (err) {
    console.error('[lot-track] createSaved failed:', err.message);
    res.status(500).json({ error: 'saved_create_failed', detail: err.message });
  }
}

async function updateSaved(req, res) {
  const empno = empnoOf(req);
  if (!empno) return res.status(401).json({ error: 'no_user' });
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad id' });
  const { name, lots } = req.body || {};
  if (name == null && lots == null) return res.status(400).json({ error: 'nothing to update' });
  if (lots != null && (!Array.isArray(lots) || lots.length === 0)) return res.status(400).json({ error: 'lots must be a non-empty array' });
  try {
    const track = await savedStore.updateSaved(empno, id, { name, lots });
    if (!track) return res.status(404).json({ error: 'not_found' });
    res.json({ track });
  } catch (err) {
    console.error('[lot-track] updateSaved failed:', err.message);
    res.status(500).json({ error: 'saved_update_failed', detail: err.message });
  }
}

async function deleteSaved(req, res) {
  const empno = empnoOf(req);
  if (!empno) return res.status(401).json({ error: 'no_user' });
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad id' });
  try {
    const ok = await savedStore.deleteSaved(empno, id);
    if (!ok) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[lot-track] deleteSaved failed:', err.message);
    res.status(500).json({ error: 'saved_delete_failed', detail: err.message });
  }
}

module.exports = { searchLots, getLot, listSaved, createSaved, updateSaved, deleteSaved };
