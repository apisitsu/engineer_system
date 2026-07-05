'use strict';

const express = require('express');
const router  = express.Router();
const { hasFeature } = require('../../../middleware/mtcAuth');
// Tooling Select admin mutations: full 'AD' admin OR a user holding the
// 'tooling_admin' feature permission (granular, non-AD). See hasFeature().
const isAdmin = hasFeature('tooling_admin');

const machineCtrl     = require('./controllers/machineController');
const limitCtrl       = require('./controllers/limitController');
const formulaCtrl     = require('./controllers/formulaController');
const searchRuleCtrl  = require('./controllers/searchRuleController');
const searchCtrl      = require('./controllers/searchController');
const { router: specCtrl, syncNewCns } = require('./controllers/specController');
const inventoryCtrl   = require('./controllers/inventoryController');
const partnoMapCtrl   = require('./controllers/partnoMapController');
const configCache     = require('./services/tsv2ConfigCache');
const tselectFallback = require('./services/tselectFallback');
const kanbanIntake    = require('./services/kanbanIntake');

// Flush the search config cache once a mutation response is sent, so admin edits
// to machines/limits/formulas/rules take effect on the very next search (the TTL
// is only a backstop). Fires on any response — a redundant flush is cheap.
// Also drop the persisted per-CN T-Select cache (config changed → results stale).
const flushConfig = (req, res, next) => {
  res.on('finish', () => { configCache.flush(); if (res.statusCode < 400) tselectFallback.clearPersisted(); });
  next();
};

// Spec mutations (POST/PUT/DELETE under /spec) also invalidate the persisted
// per-CN T-Select cache, since a spec edit changes the computed dimensions.
const flushTselectOnWrite = (req, res, next) => {
  res.on('finish', () => { if (req.method !== 'GET' && res.statusCode < 400) tselectFallback.clearPersisted(); });
  next();
};

// ── Search ─────────────────────────────────────────────────────────────────
router.post('/search', searchCtrl.search);

// ── Formula test (no machine context needed) ────────────────────────────────
router.post('/formula/test', formulaCtrl.test);
router.get('/formula/errors', isAdmin, formulaCtrl.getErrorLogs);
router.delete('/formula/errors', isAdmin, formulaCtrl.clearErrorLogs);

// ── Machines ────────────────────────────────────────────────────────────────
router.get('/machines',                       machineCtrl.list);
router.post('/machines',        isAdmin, flushConfig, machineCtrl.create);
router.put('/machines/:id',     isAdmin, flushConfig, machineCtrl.update);
router.delete('/machines/:id',  isAdmin, flushConfig, machineCtrl.remove);

// ── Inventory helpers ───────────────────────────────────────────────────────
router.get('/inventory-tables',                    machineCtrl.getInventoryTables);
router.get('/columns/:table',                      searchRuleCtrl.getColumns);

// ── Machine Limits ──────────────────────────────────────────────────────────
router.get('/machines/:machineId/limits',           limitCtrl.list);
router.post('/machines/:machineId/limits', isAdmin, flushConfig, limitCtrl.create);
router.put('/limits/:id',       isAdmin,            flushConfig, limitCtrl.update);
router.delete('/limits/:id',    isAdmin,            flushConfig, limitCtrl.remove);

// ── Formulas ────────────────────────────────────────────────────────────────
router.get('/machines/:machineId/formulas',             formulaCtrl.list);
router.get('/machines/:machineId/toolings',             formulaCtrl.listToolings);
router.post('/machines/:machineId/formulas', isAdmin,   flushConfig, formulaCtrl.create);
router.put('/formulas/:id',      isAdmin,               flushConfig, formulaCtrl.update);
router.delete('/formulas/:id',   isAdmin,               flushConfig, formulaCtrl.remove);

// ── Search Rules ────────────────────────────────────────────────────────────
router.get('/machines/:machineId/search-rules',              searchRuleCtrl.list);
router.post('/machines/:machineId/search-rules', isAdmin,    flushConfig, searchRuleCtrl.create);
router.put('/search-rules/:id',     isAdmin,                 flushConfig, searchRuleCtrl.update);
router.delete('/search-rules/:id',  isAdmin,                 flushConfig, searchRuleCtrl.remove);

// ── Inventory (Tool List) ────────────────────────────────────────────────────
// Inventory rows are queried LIVE by searchInventory (not in the config cache),
// but a search RESULT is persisted per-CN in tselect_cn_cache (6h TTL) via
// tselectFallback — consumed by the SDS coverage report + SDS PDF. So an inventory
// edit must drop that persisted cache or those consumers serve stale tool matches
// for up to 6h. flushTselectOnWrite clears it on any non-GET success.
router.get('/inventory-lookup',         inventoryCtrl.lookup); // dim lookup by tooling_no (SDS compare)
router.get('/inventory/:table',         inventoryCtrl.list);
router.post('/inventory/:table',        isAdmin, flushTselectOnWrite, inventoryCtrl.create);
router.put('/inventory/:table/:id',     isAdmin, flushTselectOnWrite, inventoryCtrl.update);
router.delete('/inventory/:table/:id',  isAdmin, flushTselectOnWrite, inventoryCtrl.remove);

// ── Part No → Tool map (formula-less fixtures, e.g. ROTARY DRESSER) ──────────
// Read fresh by the SDS PDF per render, but _applyPartnoOverrides feeds the
// persisted per-CN T-Select cache too — so a map edit must invalidate it (same
// reason as inventory above).
router.get('/partno-map',            partnoMapCtrl.list);
router.get('/partno-map/meta',       partnoMapCtrl.meta);
router.post('/partno-map',           isAdmin, flushTselectOnWrite, partnoMapCtrl.create);
router.put('/partno-map/:id',        isAdmin, flushTselectOnWrite, partnoMapCtrl.update);
router.delete('/partno-map/:id',     isAdmin, flushTselectOnWrite, partnoMapCtrl.remove);

// ── Board intake config (MTC → Kanban auto-cards) ───────────────────────────
// Per-source config (tool_request / sds_approval): target board + stage→list map
// + system user + enabled flag. Disabled/absent → the workflow hooks no-op.
router.get('/board-config/:sourceType', isAdmin, async (req, res) => {
  try { res.json({ data: await kanbanIntake.getConfig(req.params.sourceType) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/board-config/:sourceType', isAdmin, async (req, res) => {
  try { res.json({ data: await kanbanIntake.setConfig(req.params.sourceType, req.body) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Spec (Part Management) ──────────────────────────────────────────────────
router.use('/spec', flushTselectOnWrite, specCtrl);

module.exports = { router, syncNewCns };
