'use strict';

/**
 * CAD/CAM routes — mounted at `/api/engineer/cam` in server.js.
 *
 * `verifyToken` is applied by the global auth middleware, so these are already
 * behind a login; `req.user` is the JWT payload, and it is the only thing that
 * decides whose shelf a request touches.
 *
 * Rows are addressed by **id**, not by the client's `key`: the same key is now
 * legitimately two rows (my copy and the shared copy), so a key in the URL
 * would no longer name one of them.
 *
 * Only `clearLibrary` needs a guard of its own. Everything else is one route
 * with a per-row rule — you may always delete your own work, an admin may
 * delete anybody's — and a route-level guard cannot express that, so those
 * checks live in `camService` against the row it is about to write.
 */

const express = require('express');
const router = express.Router();

const camController = require('./camController');
const camStdController = require('./camStdController');
const camMachineController = require('./camMachineController');
const { isAdmin, isEngineer } = require('../../../middleware/mtcAuth');

router.get('/library', camController.listLibrary);
router.get('/library/:id', camController.getLibraryItem);
router.put('/library', camController.putLibraryItem);
router.post('/library/:id/share', camController.shareLibraryItem);
router.post('/library/:id/unshare', camController.unshareLibraryItem);
router.delete('/library/:id', camController.deleteLibraryItem);

// Emptying the library wipes work belonging to everyone — every private shelf,
// not just the shared one. Nothing in the UI triggers this; keep it that way,
// and keep it behind isAdmin so a stray call cannot clear the shop's setups.
router.delete('/library', isAdmin, camController.clearLibrary);

// Standard cutting speeds the CAM module proposes from (see camStdService).
// Anyone logged in may read them — the operator who opens a program needs them.
// Editing is an engineer's job; marking a range 'approved' is checked in the
// controller and needs an administrator.
router.get('/std-vc', camStdController.listStdVc);
router.put('/std-vc/:key', isEngineer, camStdController.putStdVc);

// The shop's machines (see camMachineService). Everyone reads them — choosing a
// machine is part of every setup. Adding, editing and resetting is an engineer's.
router.get('/machines', camMachineController.listMachines);
router.put('/machines/:id', isEngineer, camMachineController.putMachine);
router.delete('/machines/:id', isEngineer, camMachineController.deleteMachine);

module.exports = router;
