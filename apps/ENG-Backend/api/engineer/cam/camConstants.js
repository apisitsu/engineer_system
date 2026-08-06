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

/**
 * The shelf the common library lives on.
 *
 * Every row sits on exactly one shelf: an operator's own empno, or this. The
 * value has to be something no empno can ever be, or one unlucky employee would
 * find their private work published — empnos here are alphanumeric ('LC043'),
 * so the leading tilde settles it. Spelled once, here, because a typo in a
 * second copy would create a *second* shared library that looks empty.
 */
const SHARED_SHELF = '~shared';

module.exports = { TABLES, KINDS, SHARED_SHELF };
