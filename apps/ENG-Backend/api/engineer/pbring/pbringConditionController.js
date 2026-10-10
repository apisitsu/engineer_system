'use strict';

/**
 * PB Ring SDS tool-condition HTTP layer — thin, mirrors pbringController.js's
 * own shape. Mounted under /api/engineer/pbring/condition.
 */

const svc = require('./pbringConditionService');
const { PbringError } = require('./pbringCostService');

function fail(res, err, where) {
  const status = err instanceof PbringError ? err.status : 500;
  if (status >= 500) console.error(`[pbring:condition] ${where} failed:`, err.message);
  res.status(status).json({ result: 'false', message: err.message });
}

async function getRows(req, res) {
  try {
    const { cn, machine_type_name: machineTypeName, process_code: processCode } = req.query;
    if (!cn || !machineTypeName || !processCode) {
      return res.status(400).json({ result: 'false', message: 'cn, machine_type_name and process_code are required' });
    }
    res.json({ result: 'true', rows: await svc.getConditionRows(cn, machineTypeName, processCode) });
  } catch (err) {
    fail(res, err, 'getRows');
  }
}

async function putRow(req, res) {
  try {
    res.json({ result: 'true', row: await svc.upsertConditionRow(req.body || {}, req.user?.empno) });
  } catch (err) {
    fail(res, err, 'putRow');
  }
}

async function deleteRow(req, res) {
  try {
    const ok = await svc.deleteConditionRow(req.params.id);
    if (!ok) return res.status(404).json({ result: 'false', message: 'Row not found' });
    res.json({ result: 'true' });
  } catch (err) {
    fail(res, err, 'deleteRow');
  }
}

async function getHistory(req, res) {
  try {
    const { machine_type_name: machineTypeName, process_code: processCode } = req.query;
    if (!machineTypeName || !processCode) {
      return res.status(400).json({ result: 'false', message: 'machine_type_name and process_code are required' });
    }
    res.json({ result: 'true', rows: await svc.getConditionHistoryTemplate(machineTypeName, processCode) });
  } catch (err) {
    fail(res, err, 'getHistory');
  }
}

async function postFromHistory(req, res) {
  try {
    const result = await svc.createConditionFromHistory(req.body || {}, req.user?.empno);
    res.json({ result: 'true', ...result });
  } catch (err) {
    fail(res, err, 'postFromHistory');
  }
}

module.exports = { getRows, putRow, deleteRow, getHistory, postFromHistory };
