'use strict';

/**
 * Table names for the CAD/CAM domain. Never hardcode a table name in a query —
 * same rule as `mtcConstants.TABLES`.
 */
const TABLES = {
  CAM_SAVED_WORK: 'cam_saved_work',
};

/** What `kind` a saved record may be — mirrors `engine/savedWork.js` on the client. */
const KINDS = ['project', 'program'];

module.exports = { TABLES, KINDS };
