'use strict';

/**
 * Table names for the CAD/CAM domain. Never hardcode a table name in a query —
 * same rule as `mtcConstants.TABLES`.
 */
const TABLES = {
  CAM_SAVED_WORK: 'cam_saved_work',
  CAM_STD_MATERIAL: 'cam_std_material',
  CAM_STD_VC: 'cam_std_vc',
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

/**
 * The operations a standard cutting-speed range is kept for. Spelled once: the
 * migration's CHECK constraint, the service's validation and the client's
 * `engine/cam/stdVc.js` all use these same words.
 */
const STD_OPERATIONS = ['turning', 'milling', 'drilling', 'reaming', 'tap', 'parting', 'grooving', 'centre'];

/**
 * 'draft' until somebody with the authority has checked the figures against the
 * tool maker's data and signed them off. The client labels every proposal it
 * makes from a draft row, so a number nobody has verified never reads as one.
 */
const STD_STATUSES = ['draft', 'approved'];

module.exports = { TABLES, KINDS, SHARED_SHELF, STD_OPERATIONS, STD_STATUSES };
