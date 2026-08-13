'use strict';

/**
 * CAD/CAM saved work — HTTP layer. Validation and shaping only; every query and
 * every ownership rule is in `camService.js`.
 *
 * Who the caller is comes from the **signed token**, never from the body. That
 * is the whole reason a private shelf is private: `owner` and `empno` below are
 * read off `req.user`, so there is no field a request could set to save onto
 * somebody else's shelf or to delete their work.
 */

const camService = require('./camService');
const { KINDS } = require('./camConstants');
const { isAdminUser } = require('../../../middleware/mtcAuth');

/** Who is asking, in the shape the service's rules want. */
function caller(req) {
  return {
    empno: req.user?.empno ?? null,
    name: req.user?.name ?? null,
    isAdmin: isAdminUser(req.user),
  };
}

/**
 * Report a failure.
 *
 * A `LibraryError` carries a status and a sentence written for the operator —
 * "The shared library already has “OP10” from Somchai" is the whole point of
 * refusing, so it must reach the panel intact. Anything else is a bug and
 * becomes a 500 with its message logged rather than explained.
 */
function fail(res, err, where) {
  const status = err instanceof camService.LibraryError ? err.status : 500;
  if (status >= 500) console.error(`[cam] ${where} failed:`, err.message);
  res.status(status).json({ result: 'false', message: err.message });
}

/** GET /api/engineer/cam/library — my shelf and the shared one (meta only). */
async function listLibrary(req, res) {
  try {
    const { empno, isAdmin } = caller(req);
    res.json({ result: 'true', items: await camService.listMeta({ empno, isAdmin }) });
  } catch (err) {
    fail(res, err, 'listLibrary');
  }
}

/** GET /api/engineer/cam/library/:id — one payload. */
async function getLibraryItem(req, res) {
  try {
    const { empno } = caller(req);
    const data = await camService.getData(req.params.id, { empno });
    if (data === undefined) {
      return res.status(404).json({ result: 'false', message: 'Not found' });
    }
    res.json({ result: 'true', data });
  } catch (err) {
    fail(res, err, 'getLibraryItem');
  }
}

/** PUT /api/engineer/cam/library — upsert { meta, data } onto my own shelf. */
async function putLibraryItem(req, res) {
  try {
    const { meta, data } = req.body || {};
    // `key` is what "saving over a name replaces it" is made of, so a missing
    // one is not something to paper over with a generated id.
    if (!meta || typeof meta.key !== 'string' || !meta.key.trim()) {
      return res.status(400).json({ result: 'false', message: 'meta.key is required' });
    }
    if (meta.kind && !KINDS.includes(meta.kind)) {
      return res.status(400).json({ result: 'false', message: `kind must be one of ${KINDS.join(', ')}` });
    }
    const { empno, name } = caller(req);
    const item = await camService.putRecord({ meta, data, owner: { empno, name } });
    res.json({ result: 'true', meta: item });
  } catch (err) {
    fail(res, err, 'putLibraryItem');
  }
}

/** POST /api/engineer/cam/library/:id/share — publish my item to everyone. */
async function shareLibraryItem(req, res) {
  try {
    res.json({ result: 'true', meta: await camService.share(req.params.id, caller(req)) });
  } catch (err) {
    fail(res, err, 'shareLibraryItem');
  }
}

/** POST /api/engineer/cam/library/:id/unshare — take it back off the shared shelf. */
async function unshareLibraryItem(req, res) {
  try {
    res.json({ result: 'true', meta: await camService.unshare(req.params.id, caller(req)) });
  } catch (err) {
    fail(res, err, 'unshareLibraryItem');
  }
}

/** DELETE /api/engineer/cam/library/:id */
async function deleteLibraryItem(req, res) {
  try {
    res.json({ result: 'true', id: await camService.deleteRecord(req.params.id, caller(req)) });
  } catch (err) {
    fail(res, err, 'deleteLibraryItem');
  }
}

/** DELETE /api/engineer/cam/library — empty it. Admin only (see the route). */
async function clearLibrary(req, res) {
  try {
    await camService.clearAll();
    res.json({ result: 'true' });
  } catch (err) {
    fail(res, err, 'clearLibrary');
  }
}

module.exports = {
  listLibrary,
  getLibraryItem,
  putLibraryItem,
  shareLibraryItem,
  unshareLibraryItem,
  deleteLibraryItem,
  clearLibrary,
};
