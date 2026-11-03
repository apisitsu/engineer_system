'use strict';

/**
 * CAD/CAM standard cutting speeds — HTTP layer. Validation lives in
 * `camStdService.clean`; who may approve is decided here from the signed token.
 */

const camStdService = require('./camStdService');
const { isAdminUser } = require('../../../middleware/mtcAuth');

function fail(res, err, where) {
  const status = err instanceof camStdService.StdError ? err.status : 500;
  if (status >= 500) console.error(`[cam] ${where} failed:`, err.message);
  res.status(status).json({ result: 'false', message: err.message });
}

/** GET /api/engineer/cam/std-vc — every material and its ranges. */
async function listStdVc(req, res) {
  try {
    res.json({ result: 'true', materials: await camStdService.listAll() });
  } catch (err) {
    fail(res, err, 'listStdVc');
  }
}

/** PUT /api/engineer/cam/std-vc/:key — create or update one material. */
async function putStdVc(req, res) {
  try {
    const material = await camStdService.upsertMaterial(req.params.key, req.body, {
      empno: req.user?.empno ?? null,
      canApprove: isAdminUser(req.user),
    });
    res.json({ result: 'true', material });
  } catch (err) {
    fail(res, err, 'putStdVc');
  }
}

module.exports = { listStdVc, putStdVc };
