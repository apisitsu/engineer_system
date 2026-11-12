'use strict';

/** CAD/CAM machines — HTTP layer. Validation lives in `camMachineService.clean`. */

const camMachineService = require('./camMachineService');

function fail(res, err, where) {
  const status = err instanceof camMachineService.MachineError ? err.status : 500;
  if (status >= 500) console.error(`[cam] ${where} failed:`, err.message);
  res.status(status).json({ result: 'false', message: err.message });
}

/** GET /api/engineer/cam/machines — every machine added or changed by the shop. */
async function listMachines(req, res) {
  try {
    res.json({ result: 'true', machines: await camMachineService.listAll() });
  } catch (err) {
    fail(res, err, 'listMachines');
  }
}

/** PUT /api/engineer/cam/machines/:id — add a machine, or change one. */
async function putMachine(req, res) {
  try {
    const machine = await camMachineService.upsert(req.params.id, req.body, { empno: req.user?.empno ?? null });
    res.json({ result: 'true', machine });
  } catch (err) {
    fail(res, err, 'putMachine');
  }
}

/** DELETE /api/engineer/cam/machines/:id — reset a built-in, or remove an added machine. */
async function deleteMachine(req, res) {
  try {
    await camMachineService.remove(req.params.id);
    res.json({ result: 'true' });
  } catch (err) {
    fail(res, err, 'deleteMachine');
  }
}

module.exports = { listMachines, putMachine, deleteMachine };
