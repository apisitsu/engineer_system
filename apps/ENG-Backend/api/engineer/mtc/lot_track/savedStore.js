'use strict';

/**
 * Saved Lot Status Tracker views — storage layer (engPool / eng_system).
 *
 * A saved track is `{ id, name, lots: [{lotNo, controlNo|null}], updatedAt }`,
 * owned by a user (`empno`). Length-1 `lots` is a "single" bookmark, length>1 a
 * "group" — no flag; the caller derives it.
 *
 * `shared_with` (empno[]) lets specific other users view AND update the same
 * row — collaborating on one shared track, rather than each keeping a private
 * copy that drifts out of sync (or, on CSV export, silently overwrites the
 * other's file on Drive because two private tracks sanitized to the same
 * filename). Only the owner (`empno`) can delete or reassign sharing; there is
 * no UI for granting it yet — it's set by hand per pair for now.
 *
 * The table is created lazily on first use (fail-open) so the feature works on a
 * host that has not run `db_migrations/20260907_lot_track_saved.js` or
 * `20260916_lot_track_saved_shared_with.js` yet.
 */

const { engPool } = require('../../../../instance/eng_db');

const MAX_LOTS = 30;
const MAX_NAME = 120;

let _ensured = false;
async function ensureTable() {
  if (_ensured) return;
  try {
    await engPool.query(`
      CREATE TABLE IF NOT EXISTS lot_track_saved (
        id         SERIAL PRIMARY KEY,
        empno      TEXT        NOT NULL,
        name       TEXT        NOT NULL,
        lots       JSONB       NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    await engPool.query(
      'CREATE INDEX IF NOT EXISTS lot_track_saved_empno_idx ON lot_track_saved (empno)'
    );
    await engPool.query(
      "ALTER TABLE lot_track_saved ADD COLUMN IF NOT EXISTS shared_with TEXT[] NOT NULL DEFAULT '{}'"
    );
    _ensured = true;
  } catch (e) {
    // fail-open: a later real query will surface the problem with a clearer message
    console.warn('[lot-track] ensureTable failed:', e.message);
  }
}

/** Coerce arbitrary input into `[{lotNo, controlNo|null}]`, trimmed, deduped, capped. */
function normalizeLots(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const it of raw) {
    const lotNo = String(it?.lotNo ?? it?.lot_no ?? '').trim();
    if (!lotNo) continue;
    const controlNo = String(it?.controlNo ?? it?.control_no ?? '').trim() || null;
    const k = `${lotNo.toUpperCase()}|${controlNo || ''}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ lotNo, controlNo });
    if (out.length >= MAX_LOTS) break;
  }
  return out;
}

// `viewerEmpno` is whoever asked — `owned` tells the frontend whether THEY are
// the owner (can delete / grant sharing) versus a shared collaborator (can
// view and update, per the WHERE clauses below, but not delete).
const rowToDto = (r, viewerEmpno) => ({
  id: r.id,
  name: r.name,
  lots: Array.isArray(r.lots) ? r.lots : [],
  count: Array.isArray(r.lots) ? r.lots.length : 0,
  updatedAt: r.updated_at,
  owned: r.empno === viewerEmpno,
});

async function listSaved(empno) {
  await ensureTable();
  const { rows } = await engPool.query(
    `SELECT id, empno, name, lots, updated_at
       FROM lot_track_saved
      WHERE empno = $1 OR $1 = ANY(shared_with)
      ORDER BY updated_at DESC`,
    [empno],
  );
  return rows.map((r) => rowToDto(r, empno));
}

async function createSaved(empno, name, lots) {
  await ensureTable();
  const nm = String(name || '').trim().slice(0, MAX_NAME) || 'Untitled';
  const { rows } = await engPool.query(
    `INSERT INTO lot_track_saved (empno, name, lots)
     VALUES ($1, $2, $3::jsonb)
     RETURNING id, empno, name, lots, updated_at`,
    [empno, nm, JSON.stringify(normalizeLots(lots))],
  );
  return rowToDto(rows[0], empno);
}

/**
 * Update name and/or lots. Returns the DTO, or null if `empno` is neither the
 * owner nor in `shared_with` for this row. Deleting/sharing stays owner-only —
 * only the WHERE clause here (not deleteSaved's) accepts a collaborator.
 */
async function updateSaved(empno, id, { name, lots }) {
  await ensureTable();
  const sets = ['updated_at = now()'];
  const params = [empno, id];
  if (name != null) { params.push(String(name).trim().slice(0, MAX_NAME) || 'Untitled'); sets.push(`name = $${params.length}`); }
  if (lots != null) { params.push(JSON.stringify(normalizeLots(lots))); sets.push(`lots = $${params.length}::jsonb`); }
  const { rows } = await engPool.query(
    `UPDATE lot_track_saved SET ${sets.join(', ')}
      WHERE (empno = $1 OR $1 = ANY(shared_with)) AND id = $2
      RETURNING id, empno, name, lots, updated_at`,
    params,
  );
  return rows[0] ? rowToDto(rows[0], empno) : null;
}

async function deleteSaved(empno, id) {
  await ensureTable();
  const { rowCount } = await engPool.query(
    'DELETE FROM lot_track_saved WHERE empno = $1 AND id = $2',
    [empno, id],
  );
  return rowCount > 0;
}

module.exports = { listSaved, createSaved, updateSaved, deleteSaved, normalizeLots, MAX_LOTS };
