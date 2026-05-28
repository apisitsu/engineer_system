'use strict';

const express = require('express');
const router  = express.Router();
const { isAdmin } = require('../../../middleware/mtcAuth');

const machineCtrl     = require('./controllers/machineController');
const limitCtrl       = require('./controllers/limitController');
const formulaCtrl     = require('./controllers/formulaController');
const searchRuleCtrl  = require('./controllers/searchRuleController');
const searchCtrl      = require('./controllers/searchController');
const { router: specCtrl, syncNewCns } = require('./controllers/specController');
const inventoryCtrl   = require('./controllers/inventoryController');

// ── Search ─────────────────────────────────────────────────────────────────
router.post('/search', searchCtrl.search);

// ── Formula test (no machine context needed) ────────────────────────────────
router.post('/formula/test', formulaCtrl.test);

// ── Machines ────────────────────────────────────────────────────────────────
router.get('/machines',                       machineCtrl.list);
router.post('/machines',        isAdmin,       machineCtrl.create);
router.put('/machines/:id',     isAdmin,       machineCtrl.update);
router.delete('/machines/:id',  isAdmin,       machineCtrl.remove);

// ── Inventory helpers ───────────────────────────────────────────────────────
router.get('/inventory-tables',                    machineCtrl.getInventoryTables);
router.get('/columns/:table',                      searchRuleCtrl.getColumns);

// ── Machine Limits ──────────────────────────────────────────────────────────
router.get('/machines/:machineId/limits',           limitCtrl.list);
router.post('/machines/:machineId/limits', isAdmin, limitCtrl.create);
router.put('/limits/:id',       isAdmin,            limitCtrl.update);
router.delete('/limits/:id',    isAdmin,            limitCtrl.remove);

// ── Formulas ────────────────────────────────────────────────────────────────
router.get('/machines/:machineId/formulas',             formulaCtrl.list);
router.get('/machines/:machineId/toolings',             formulaCtrl.listToolings);
router.post('/machines/:machineId/formulas', isAdmin,   formulaCtrl.create);
router.put('/formulas/:id',      isAdmin,               formulaCtrl.update);
router.delete('/formulas/:id',   isAdmin,               formulaCtrl.remove);

// ── Search Rules ────────────────────────────────────────────────────────────
router.get('/machines/:machineId/search-rules',              searchRuleCtrl.list);
router.post('/machines/:machineId/search-rules', isAdmin,    searchRuleCtrl.create);
router.put('/search-rules/:id',     isAdmin,                 searchRuleCtrl.update);
router.delete('/search-rules/:id',  isAdmin,                 searchRuleCtrl.remove);

// ── Inventory (Tool List) ────────────────────────────────────────────────────
router.get('/inventory/:table',         inventoryCtrl.list);
router.post('/inventory/:table',        isAdmin, inventoryCtrl.create);
router.put('/inventory/:table/:id',     isAdmin, inventoryCtrl.update);
router.delete('/inventory/:table/:id',  isAdmin, inventoryCtrl.remove);

// ── Spec (Part Management) ──────────────────────────────────────────────────
router.use('/spec', specCtrl);

module.exports = { router, syncNewCns };
