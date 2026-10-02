'use strict';

/**
 * PB Ring tooling — HTTP layer. Thin: query-param shaping only, every query
 * lives in `pbringService.js`.
 */

const pbringService = require('./pbringService');
const pbringCostService = require('./pbringCostService');
const pbringCostDetectService = require('./pbringCostDetectService');

function fail(res, err, where) {
  const status = err instanceof pbringCostService.PbringError ? err.status : 500;
  if (status >= 500) console.error(`[pbring] ${where} failed:`, err.message);
  res.status(status).json({ result: 'false', message: err.message });
}

const str = (v) => (v == null || v === '' ? null : String(v));

async function getFilters(req, res) {
  try {
    const { hw, pc, mc, status, ring } = req.query;
    res.json({ result: 'true', ...(await pbringService.getFilters({ hw: str(hw), pc: str(pc), mc: str(mc), status: str(status), ring: str(ring) })) });
  } catch (err) {
    fail(res, err, 'getFilters');
  }
}

async function search(req, res) {
  try {
    const { hw, pc, mc, status, ring, alert } = req.query;
    res.json({ result: 'true', ...(await pbringService.search({ hw: str(hw), pc: str(pc), mc: str(mc), status: str(status), ring: str(ring), alert: str(alert) })) });
  } catch (err) {
    fail(res, err, 'search');
  }
}

async function summary(req, res) {
  try {
    res.json({ result: 'true', ...(await pbringService.summary()) });
  } catch (err) {
    fail(res, err, 'summary');
  }
}

async function cnLookup(req, res) {
  try {
    const partNo = str(req.query.part_no);
    const cn = await pbringService.lookupCnByPartNo(partNo);
    res.json({ result: 'true', cn });
  } catch (err) {
    fail(res, err, 'cnLookup');
  }
}

async function updateTooling(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ result: 'false', message: 'invalid id' });
    const row = await pbringCostService.updateTooling(id, req.body || {});
    res.json({ result: 'true', tooling: row });
  } catch (err) {
    fail(res, err, 'updateTooling');
  }
}

async function deleteTooling(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ result: 'false', message: 'invalid id' });
    await pbringCostService.deleteTooling(id);
    res.json({ result: 'true', id });
  } catch (err) {
    fail(res, err, 'deleteTooling');
  }
}

async function deleteByPartGroup(req, res) {
  try {
    const result = await pbringCostService.deleteByPartGroup(str(req.params.partGroup));
    res.json({ result: 'true', ...result });
  } catch (err) {
    fail(res, err, 'deleteByPartGroup');
  }
}

async function historyProcessCodes(req, res) {
  try {
    res.json({ result: 'true', processCode: await pbringService.getHistoryProcessCodes() });
  } catch (err) {
    fail(res, err, 'historyProcessCodes');
  }
}

async function historyMachines(req, res) {
  try {
    const pc = str(req.query.pc);
    if (!pc) return res.status(400).json({ result: 'false', message: 'pc is required' });
    res.json({ result: 'true', machine: await pbringService.getHistoryMachines(pc) });
  } catch (err) {
    fail(res, err, 'historyMachines');
  }
}

async function historyTemplate(req, res) {
  try {
    const pc = str(req.query.pc);
    const mc = str(req.query.mc);
    if (!pc || !mc) return res.status(400).json({ result: 'false', message: 'pc and mc are required' });
    res.json({ result: 'true', rows: await pbringService.getHistoryTemplate(pc, mc) });
  } catch (err) {
    fail(res, err, 'historyTemplate');
  }
}

async function createFromHistory(req, res) {
  try {
    const result = await pbringService.createToolingFromHistory(req.body || {}, req.user?.empno);
    res.json({ result: 'true', ...result });
  } catch (err) {
    fail(res, err, 'createFromHistory');
  }
}

async function detectCost(req, res) {
  try {
    res.json({ result: 'true', ...(await pbringCostDetectService.detectMissingCost()) });
  } catch (err) {
    fail(res, err, 'detectCost');
  }
}

async function listPendingCost(req, res) {
  try {
    const status = str(req.query.status) || 'pending';
    res.json({ result: 'true', pending: await pbringCostDetectService.listPending(status) });
  } catch (err) {
    fail(res, err, 'listPendingCost');
  }
}

async function approvePendingCost(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ result: 'false', message: 'invalid id' });
    const toolingId = await pbringCostDetectService.approvePending(id, req.user?.empno);
    res.json({ result: 'true', toolingId });
  } catch (err) {
    fail(res, err, 'approvePendingCost');
  }
}

async function rejectPendingCost(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ result: 'false', message: 'invalid id' });
    await pbringCostDetectService.rejectPending(id, req.user?.empno, req.body?.note);
    res.json({ result: 'true', id });
  } catch (err) {
    fail(res, err, 'rejectPendingCost');
  }
}

module.exports = {
  getFilters, search, summary, cnLookup, updateTooling, deleteTooling, deleteByPartGroup,
  historyProcessCodes, historyMachines, historyTemplate, createFromHistory,
  detectCost, listPendingCost, approvePendingCost, rejectPendingCost,
};
