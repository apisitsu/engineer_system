'use strict';

const TABLES = {
  TEMPLATE: 'pr_record_template',
  RECORD: 'pr_record',
  STEP: 'pr_record_step',
};

/** Where a header field's value comes from. 'manual' = typed by the engineer. */
const FIELD_SOURCES = [
  'manual',
  'lot_no', 'control_no', 'parts_no', 'drawing_rev', // pulled from the lot
  'established_date', 'record_rev', 'revised_date',  // maintained by the system
];

const STATUSES = ['draft', 'printed', 'recorded'];

/**
 * Mirrors "Form record new model.xlsx" (sheet form(RECORD)) cell for cell.
 * Header widths are the workbook's own column widths (characters). The table columns
 * (NO 5 : PROCESS 30 : REMARK 65) deliberately differ from the workbook's 6:32:99 — a process
 * is printed as "<code> <name>" and long names such as COMPONENT INSPECT(2) wrapped in the narrow
 * original column, making rows taller and pushing the form onto a second page. Header: the header block is columns A:M (88.8), the stamp boxes N:P.
 *   span   = label + value, in those units       labelW = the label's share of it
 */
const DEFAULT_LAYOUT = {
  title: 'RECORD FOR NEW MODEL / ITEM',
  subtitle: 'FOR ENGINEER ONLY',
  orientation: 'landscape',
  rowCount: 21,
  headerUnits: 88.8,
  headerPct: 72,
  sideBoxes: [
    { key: 'customer_pn', label: 'CUSTOMER P/N', w: 16 },
    { key: 'final_decided', label: 'FINAL DECIDED', w: 16 },
    { key: 'engineer_stamp', label: 'ENGINEER STAMP', w: 16 },
  ],
  headerFields: [
    { key: 'lot_no', label: 'LOT NO.', source: 'lot_no', row: 1, span: 13.3, labelW: 6.1 },
    { key: 'control_no', label: 'C/N', source: 'control_no', row: 1, span: 9.2, labelW: 3.1 },
    { key: 'parts_no', label: 'P/N', source: 'parts_no', row: 1, span: 19.4, labelW: 3 },
    { key: 'drawing_rev', label: 'DRAWING REV.', source: 'drawing_rev', row: 1, span: 46.9, labelW: 11.5 },
    { key: 'process_code', label: 'PROCESS CODE', source: 'manual', row: 2, span: 22.5, labelW: 10.6 },
    { key: 'established_date', label: 'ESTABLISHED DATE', source: 'established_date', row: 2, span: 30.9, labelW: 15.4 },
    { key: 'record_rev', label: 'RECORD REV.', source: 'record_rev', row: 2, span: 17.6, labelW: 8 },
    { key: 'revised_date', label: 'REVISED DATE', source: 'revised_date', row: 2, span: 17.8, labelW: 8.2 },
    { key: 'ref_pn', label: 'REF. P/N', source: 'manual', row: 3, span: 41.8, labelW: 6.1 },
  ],
  columns: [
    { key: 'no', label: 'NO.', width: 5, kind: 'no' },
    { key: 'process', label: 'PROCESS', width: 30, kind: 'process' },
    { key: 'remark', label: 'REMARK', width: 65, kind: 'text' },
  ],
};

module.exports = { TABLES, FIELD_SOURCES, STATUSES, DEFAULT_LAYOUT };
