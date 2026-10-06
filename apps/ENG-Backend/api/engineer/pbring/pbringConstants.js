'use strict';

/**
 * Table names + shared enums for the PB Ring tooling domain. Never hardcode a
 * table name in a query — same rule as `mtcConstants.TABLES`/`camConstants.TABLES`.
 *
 * Everything here is independent of the live SDS pipeline / Tooling Select —
 * `MACHINE_ALIAS`/`machineKey` are PB Ring's own machine-name normalization
 * (ported from the standalone prototype), never applied to or checked against
 * `sds_machine_type_code` / `tooling_machine`.
 */

const TABLES = {
  TOOLING: 'pbring_tooling',
  COST_PENDING: 'pbring_cost_pending',
  APPROVER: 'pbring_approver',
  SDS_PARAM: 'pbring_sds_param',
  SDS_CONDITION: 'pbring_sds_condition',
};

const STATUS = [
  'Received', 'Wait Receive', 'Wait Request Quotation', 'Wait DWG Tooling (BBBU)',
  'Wait DWG Tooling (ROD THAI)', 'Wait DWG Tooling (ROD KZW)', 'UNUSED', 'Unknown',
];

// `part_name` as imported from the prototype's Excel data — verified 2,043/2,043
// rows are exactly one of these two (no blanks, no other spelling).
const RING_TYPES = ['Outer ring', 'Inner ring'];

const COST_SOURCE = ['manual', 'maqdb'];
const COST_PENDING_STATUS = ['pending', 'approved', 'rejected'];

// PB Ring-only write exclusion, on top of `isMtcTeam` (group==='MTC'). Named
// per-person, not a `user_group` edit — that column gates the whole MTC module,
// and these two should only lose PB Ring write access. 2026-10-05, per request.
const WRITE_DENYLIST = ['L6121', 'LE216'];

/** Status-card sentinel: "Received" but PO / unit price / receive date is missing. */
const RECEIVED_BUT_INCOMPLETE = '__RU__';

/** Filter-card sentinel: a maqdb-detected cost update is waiting on `pbring_cost_pending`. */
const COST_ALERT = '__COST_FOUND__';

// Status-card sentinel: no `po_no` recorded yet, across every status (not just
// Received, unlike RECEIVED_BUT_INCOMPLETE) — UNUSED tool_code never counts,
// same exclusion `missing()`/`detectMissingCost()` already apply. This is the
// raw candidate pool `detectMissingCost()` scans; COST_ALERT is the subset of
// it that matched something in maqdb — the two numbers are expected to differ.
const NO_PO = '__NOPO__';

// Status-card sentinel: no `tool_code` entered at all yet (NULL/blank) —
// an earlier-stage gap than NO_PO. A row added via "Add new HW" starts with
// no tool_code, and `detectMissingCost()`'s maqdb match can't even attempt
// one until it has a code to look up — this surfaces that backlog directly.
// UNUSED is a real (non-blank) tool_code value meaning "this slot needs no
// tool", so it never counts here, same exclusion as NO_PO/missing().
const NO_TOOL_CODE = '__NOTOOL__';

// Status-card sentinel for the frontend's "Waiting" aggregate card — matches
// any row whose status is one of these five, so selecting the card actually
// filters to their union (not just expand its own sub-card row in the UI).
const WAITING = '__WAITING__';
const WAITING_STATUSES = [
  'Wait Receive', 'Wait Request Quotation', 'Wait DWG Tooling (BBBU)',
  'Wait DWG Tooling (ROD THAI)', 'Wait DWG Tooling (ROD KZW)',
];

// Ported verbatim from tooling_manager.html so mc_key stays consistent with the
// values already written by the one-time import migration.
const MACHINE_ALIAS = {
  KVD300CRII: 'KVD300', KVD350C: 'KVD350', NISSINHIGRIND1D: 'HIGRIND1D',
  QUICKTURNSMART200M: 'QTSMART200M', KSB80PB: 'KSB80',
};
const normalizeKey = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const machineKey = (s) => { const k = normalizeKey(s); return MACHINE_ALIAS[k] || k; };

module.exports = {
  TABLES, STATUS, RING_TYPES, COST_SOURCE, COST_PENDING_STATUS, RECEIVED_BUT_INCOMPLETE, COST_ALERT, NO_PO,
  NO_TOOL_CODE, WAITING, WAITING_STATUSES, WRITE_DENYLIST, MACHINE_ALIAS, machineKey,
};
