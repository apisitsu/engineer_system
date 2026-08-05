'use strict';

/**
 * CAD/CAM shared library — HTTP layer. Validation and shaping only; every query
 * is in `camService.js`.
 */

const camService = require('./camService');
const { KINDS } = require('./camConstants');

/** GET /api/engineer/cam/library — the list (meta only, newest first). */
async function listLibrary(req, res) {
  try {
    res.json({ result: 'true', items: await camService.listMeta() });
  } catch (err) {
    console.error('[cam] listLibrary failed:', err.message);
    res.status(500).json({ result: 'false', message: err.message });
  }
}

/** GET /api/engineer/cam/library/:key — one payload. */
async function getLibraryItem(req, res) {
  try {
    const data = await camService.getData(req.params.key);
    if (data === undefined) {
      return res.status(404).json({ result: 'false', message: 'Not found' });
    }
    res.json({ result: 'true', data });
  } catch (err) {
    console.error('[cam] getLibraryItem failed:', err.message);
    res.status(500).json({ result: 'false', message: err.message });
  }
}

/** PUT /api/engineer/cam/library — upsert { meta, data }. */
async function putLibraryItem(req, res) {
  try {
    const { meta, data } = req.body || {};
    // `key` is the primary key AND the "saving over a name replaces it" rule, so
    // a missing one is not something to paper over with a generated id.
    if (!meta || typeof meta.key !== 'string' || !meta.key.trim()) {
      return res.status(400).json({ result: 'false', message: 'meta.key is required' });
    }
    if (meta.kind && !KINDS.includes(meta.kind)) {
      return res.status(400).json({ result: 'false', message: `kind must be one of ${KINDS.join(', ')}` });
    }
    // The signed token is the only trustworthy source for who saved this — a
    // client-supplied owner would be a free-text claim.
    const owner = { empno: req.user?.empno ?? null, name: req.user?.name ?? null };
    res.json({ result: 'true', meta: await camService.putRecord({ meta, data, owner }) });
  } catch (err) {
    console.error('[cam] putLibraryItem failed:', err.message);
    res.status(500).json({ result: 'false', message: err.message });
  }
}

/** DELETE /api/engineer/cam/library/:key */
async function deleteLibraryItem(req, res) {
  try {
    res.json({ result: 'true', key: await camService.deleteRecord(req.params.key) });
  } catch (err) {
    console.error('[cam] deleteLibraryItem failed:', err.message);
    res.status(500).json({ result: 'false', message: err.message });
  }
}

/** DELETE /api/engineer/cam/library — empty it. Admin only (see the route). */
async function clearLibrary(req, res) {
  try {
    await camService.clearAll();
    res.json({ result: 'true' });
  } catch (err) {
    console.error('[cam] clearLibrary failed:', err.message);
    res.status(500).json({ result: 'false', message: err.message });
  }
}

module.exports = {
  listLibrary,
  getLibraryItem,
  putLibraryItem,
  deleteLibraryItem,
  clearLibrary,
};
