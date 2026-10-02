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

/** Status-card sentinel: "Received" but PO / unit price / receive date is missing. */
const RECEIVED_BUT_INCOMPLETE = '__RU__';

/** Filter-card sentinel: a maqdb-detected cost update is waiting on `pbring_cost_pending`. */
const COST_ALERT = '__COST_FOUND__';

// Ported verbatim from tooling_manager.html so mc_key stays consistent with the
// values already written by the one-time import migration.
const MACHINE_ALIAS = {
  KVD300CRII: 'KVD300', KVD350C: 'KVD350', NISSINHIGRIND1D: 'HIGRIND1D',
  QUICKTURNSMART200M: 'QTSMART200M', KSB80PB: 'KSB80',
};
const normalizeKey = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const machineKey = (s) => { const k = normalizeKey(s); return MACHINE_ALIAS[k] || k; };

module.exports = {
  TABLES, STATUS, RING_TYPES, COST_SOURCE, COST_PENDING_STATUS, RECEIVED_BUT_INCOMPLETE, COST_ALERT,
  MACHINE_ALIAS, machineKey,
};
