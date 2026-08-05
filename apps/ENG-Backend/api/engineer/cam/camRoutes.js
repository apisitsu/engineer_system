'use strict';

/**
 * CAD/CAM routes — mounted at `/api/engineer/cam` in server.js.
 *
 * `verifyToken` is applied by the global auth middleware, so these are already
 * behind a login; `req.user` is the JWT payload.
 */

const express = require('express');
const router = express.Router();

const camController = require('./camController');
const { isAdmin } = require('../../../middleware/mtcAuth');

router.get('/library', camController.listLibrary);
router.get('/library/:key', camController.getLibraryItem);
router.put('/library', camController.putLibraryItem);
router.delete('/library/:key', camController.deleteLibraryItem);

// Emptying the library now wipes work belonging to everyone, not just the
// browser doing it. Nothing in the UI triggers this — keep it that way, and keep
// it behind isAdmin so a stray call cannot clear the shop's saved setups.
router.delete('/library', isAdmin, camController.clearLibrary);

module.exports = router;
