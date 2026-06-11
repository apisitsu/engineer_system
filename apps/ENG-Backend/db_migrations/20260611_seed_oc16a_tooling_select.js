'use strict';
/**
 * Seed OC-16A (Centerless Grinding) into Tooling Select V2.
 *
 * Source: 20200212_TOOLING LIST_CENTERLESS-GRINDING-JIG.xlsx
 *
 * OC-16A is a CATEGORICAL / DIMENSIONAL LOOKUP machine (no generative formula
 * engine). Two tooling types are dimension-driven:
 *
 *   RACE PUSHER (4560-18): pushes the work through the grinding gap.
 *     DIM A (col E) = pusher OD. Rule: pusher OD must be < work OD
 *     (design A = OD − 0.5). Formula: A = OD (od_aft, finished work OD).
 *     Search: dim_a BETWEEN (OD−1.0) AND (OD+0), closest match.
 *     77 rows imported (OD 5–78.5); deprecated row 4560-18-1011 excluded.
 *
 *   SET PIN (4560-21): centerless SETTING GAUGE pin — its diameter equals the
 *     work OUTER diameter (used to set the regulating-wheel gap), NOT the bore.
 *     DIM A (col C) = pin dia (rounded to 3rd decimal). Formula: A = OD before grind
 *     = if(odBf>0, odBf, OD). (Was wrongly A = ID; e.g. CN 614033 od_bf=14.47 →
 *     correct pin 4560-21-0044 dim_a=14.42, but id_aft=11.15 gave the wrong pin.)
 *     Search: dim_a within ±0.15 of work OD. 218 rows imported; two deprecated
 *     entries excluded (4560-21-0154: "use 0015", 4560-21-0163: "prohibited").
 *
 * COLLAR / PIN / ARBOR: categorical only (no clean dimension driver). Documented
 * as SDS-only — not seeded into T-Select.
 *
 * SDS coupling: sds_machine_type_code already has 'OC-16A' (code 560).
 * T-Select machine_name='OC-16A' matches it exactly.
 *
 * Idempotent. Run: node db_migrations/20260611_seed_oc16a_tooling_select.js
 */

const { engPool } = require('../instance/eng_db');

const MACHINE = {
  machine_name: 'OC-16A',
  label: 'OC-16A',
  inventory_table: 'tooling_oc16a',
  inventory_machine_filter: null,
  machine_group: null,
};

// Broad limits covering the full pusher/pin inventory range.
const LIMITS = [
  { input_var: 'OD', min_value: 3,  max_value: 85, min_inclusive: true, max_inclusive: true },
];

const FORMULAS = {
  'RACE PUSHER': [{ key: 'A', expr: 'OD' }],                      // OD = od_aft (finished work OD)
  'SET PIN':     [{ key: 'A', expr: 'if(odBf > 0, odBf, OD)' }],  // setting-gauge pin dia = work OD (before grind, od_aft fallback)
};

// [output_key, inventory_col, tol_plus, tol_minus, is_match_dim, label]
const RULES = {
  // Asymmetric: pusher OD must be ≤ work OD (design rule A = OD − 0.5).
  // tol_plus=0 prevents returning a pusher larger than the work; tol_minus=1.0 allows
  // up to 1.0mm smaller. WHERE dim_a BETWEEN (OD−1.0) AND OD.
  // Extra inventory cols (dim_b/c/d/e/f) are returned via SELECT * and need no rule entry —
  // adding them with the same output_key='A' violates the UNIQUE(machine_id,tooling_name,output_key) constraint.
  'RACE PUSHER': [
    ['A', 'dim_a', 0, 1.0, true, 'Pusher OD (A)'],
  ],
  // SET PIN: tight symmetric tolerance around bore ID.
  'SET PIN': [
    ['A', 'dim_a', 0.15, 0.15, true, 'Pin dia (A)'],
  ],
};

// ── RACE PUSHER inventory rows ────────────────────────────────────────────────
// Source: RACE PUSHER sheet rows 26–103 (col A=DWG, E=OD, F=ID, G=C'BORE,
// H=notch depth, I=chamfer, J=material note, K=notch width, L=notch pos).
// NULL for '-' values. Row 4560-18-1011 excluded (deprecated: "Merged into -1032").
// [tooling_no, dim_a(OD), dim_b(ID), dim_c(C'BORE), dim_d(notch), dim_e(chamfer), dim_f(note)]
const RACE_PUSHER_ROWS = [
  ['4560-18-1001', 5,    3,    null, null, null, 'パイプ'],
  ['4560-18-1002', 6,    4,    null, null, null, 'パイプ'],
  ['4560-18-1055', 6.5,  4,    4,    null, 0.5,  'バー'],
  ['4560-18-1003', 7,    5,    1.5,  null, 0.2,  'バー'],
  ['4560-18-1078', 7,    5,    1.5,  2,    0.2,  'バー'],
  ['4560-18-1052', 7.7,  4,    4,    3,    0.5,  'バー'],
  ['4560-18-1004', 8,    6,    null, null, null, 'パイプ'],
  ['4560-18-1005', 9,    7,    2,    null, 0.2,  'バー'],
  ['4560-18-1006', 10,   7,    null, null, null, 'パイプ'],
  ['4560-18-1007', 11,   8,    3,    5.5,  0.2,  'バー'],
  ['4560-18-1008', 11.5, 9,    3,    5.5,  0.2,  'バー'],
  ['4560-18-1033', 12.5, 10,   5,    4,    0.2,  'バー'],
  ['4560-18-1009', 13,   10,   3,    4,    0.2,  'バー'],
  ['4560-18-1037', 13.5, 11,   5,    4,    0.5,  'バー'],
  ['4560-18-1010', 14,   11,   5,    4,    0.2,  'バー'],
  // 4560-18-1011 EXCLUDED (deprecated: "Do not use, Merged into -1032")
  ['4560-18-1032', 15,   13,   6,    5,    0.2,  'バー'],
  ['4560-18-1012', 16,   13.5, 6,    5,    0.2,  'バー'],
  ['4560-18-1064', 16.5, 12,   6,    5,    0.2,  'バー'],
  ['4560-18-1013', 17,   14,   10,   5,    0.2,  'バー'],
  ['4560-18-1014', 18,   15,   7,    5,    0.2,  'バー'],
  ['4560-18-1061', 18.5, 16,   5,    5,    0.2,  'バー'],
  ['4560-18-1015', 19,   16,   8,    6,    0.2,  'バー'],
  ['4560-18-1016', 20,   17,   8,    6,    0.2,  'バー'],
  ['4560-18-1017', 21,   18,   9,    6,    0.2,  'バー'],
  ['4560-18-1018', 22,   19,   10,   7,    0.2,  'バー'],
  ['4560-18-1019', 23,   20,   10,   7,    0.2,  'バー'],
  ['4560-18-1035', 23.5, 20,   10,   7,    0.2,  'バー'],
  ['4560-18-1020', 24,   21,   10,   7,    0.2,  'バー'],
  ['4560-18-1021', 25,   21,   10,   8,    0.2,  'バー'],
  ['4560-18-1044', 25,   21,   null, 8,    null, 'パイプ'],
  ['4560-18-1022', 25.5, 22,   11,   8,    0.2,  'バー'],
  ['4560-18-1062', 26.5, 22.5, 5,    8,    0.5,  'バー'],
  ['4560-18-1023', 27,   23,   11,   8,    0.2,  'バー'],
  ['4560-18-1024', 28,   24,   12,   8,    0.2,  'バー'],
  ['4560-18-1050', 28,   25,   null, 8,    0.5,  'パイプ'],
  ['4560-18-1025', 29,   25,   12,   9,    0.2,  'バー'],
  ['4560-18-1026', 30,   26,   13,   9,    0.2,  'バー'],
  ['4560-18-1027', 31,   27,   13,   9,    0.2,  'バー'],
  ['4560-18-1074', 31.5, 24,   5,    5,    0.2,  'バー'],
  ['4560-18-1028', 32,   28,   14,   10,   0.2,  'バー'],
  ['4560-18-1045', 32,   26,   null, 10,   0.2,  'パイプ'],
  ['4560-18-1029', 33,   29,   14,   10,   0.2,  'バー'],
  ['4560-18-1030', 34,   30,   15,   10,   0.2,  'バー'],
  ['4560-18-1039', 34,   29,   null, 10,   1,    'パイプ'],
  ['4560-18-1046', 34.8, 31,   3,    10,   0.2,  'バー'],
  ['4560-18-1031', 35,   31,   15,   11,   0.2,  'バー'],
  ['4560-18-1069', 36,   32,   5,    5,    0.2,  'バー'],
  ['4560-18-1036', 36.5, 29,   14,   11,   0.5,  'バー'],
  ['4560-18-1066', 37.5, 30,   6,    16,   0.2,  'バー'],
  ['4560-18-1051', 38,   34,   null, 11,   0.5,  'パイプ'],
  ['4560-18-1038', 39,   32,   null, 11,   1,    'パイプ'],
  ['4560-18-1063', 40,   36,   null, 12,   0.5,  'パイプ'],
  ['4560-18-1075', 40.5, 30,   5,    5,    0.2,  'バー'],
  ['4560-18-1034', 41,   35,   17,   12,   0.2,  'バー'],
  ['4560-18-1067', 42,   36,   5,    12,   0.2,  'バー'],
  ['4560-18-1040', 44,   39,   null, 13,   1,    'パイプ'],
  ['4560-18-1056', 45,   41,   null, 10,   0.5,  'パイプ'],
  ['4560-18-1072', 46.5, 38.5, 5,    27,   0.5,  'バー'],
  ['4560-18-1047', 49,   40,   null, 15,   1,    'パイプ'],
  ['4560-18-1041', 50,   40,   null, 15,   1,    'パイプ'],
  ['4560-18-1049', 51,   45,   null, 15,   1,    'パイプ'],
  ['4560-18-1073', 51,   42,   5,    29,   0.5,  'バー'],
  ['4560-18-1042', 53,   45,   null, 16,   1,    'パイプ'],
  ['4560-18-1059', 54,   49,   5,    10,   0.2,  'パイプ'],
  ['4560-18-1057', 55,   45,   null, 10,   0.5,  'パイプ'],
  ['4560-18-1065', 56,   51,   5,    31,   0.2,  'バー'],
  ['4560-18-1077', 56,   50,   null, 10,   0.2,  'パイプ'],
  ['4560-18-1048', 59,   50,   null, 18,   2.5,  'パイプ'],
  ['4560-18-1068', 61,   53,   5,    34,   0.5,  'バー'],
  ['4560-18-1043', 63,   55,   null, 19,   1,    'パイプ'],
  ['4560-18-1058', 65,   61,   10,   10,   0.5,  'パイプ'],
  ['4560-18-1060', 66,   60,   5,    36,   0.5,  'バー'],
  ['4560-18-1071', 68,   59,   5,    37,   0.5,  'バー'],
  ['4560-18-1053', 68.5, 60,   null, 10,   0.5,  'パイプ'],
  ['4560-18-1070', 72.5, 63,   5,    39,   0.5,  'バー'],
  ['4560-18-1054', 75,   65,   null, 10,   0.5,  'パイプ'],
  ['4560-18-1076', 78.5, 70,   null, 10,   0.5,  'パイプ'],
];

// ── SET PIN inventory rows ────────────────────────────────────────────────────
// Source: SET PIN sheet rows 24–243 (col A=DWG, C=pin dia A, D=length B, F=part class).
// Two deprecated entries excluded:
//   4560-21-0154 (pin_dia=16.77) → note: "0015を使用" (use 0015 instead)
//   4560-21-0163 (pin_dia=26.1)  → note: "使用禁止→0011を使用" (prohibited)
// [tooling_no, dim_a(pin_dia), dim_b(length), dim_f(part_class)]
const SET_PIN_ROWS = [
  ['4560-21-0132', 7.05,   30, 'SLEEVE'],
  ['4560-21-0124', 7.98,   30, 'SLEEVE'],
  ['4560-21-0137', 8.05,   30, 'SLEEVE'],
  ['4560-21-0045', 8.06,   30, 'SLEEVE'],
  ['4560-21-0141', 9.1,    30, 'SPH'],
  ['4560-21-0070', 9.53,   30, 'SLEEVE'],
  ['4560-21-0042', 9.65,   30, 'SLEEVE'],
  ['4560-21-0073', 9.74,   30, 'SLEEVE'],
  ['4560-21-0054', 9.93,   30, 'SLEEVE'],
  ['4560-21-0153', 10.05,  30, 'SLEEVE'],
  ['4560-21-0038', 10.1,   30, 'SPH'],
  ['4560-21-0062', 10.14,  30, 'SLEEVE'],
  ['4560-21-0146', 10.6,   30, 'SPH'],
  ['4560-21-0147', 10.75,  30, 'SPH'],
  ['4560-21-0176', 10.77,  30, 'SLEEVE'],
  ['4560-21-0066', 11.12,  30, 'SLEEVE'],
  ['4560-21-0050', 11.24,  30, 'SLEEVE'],
  ['4560-21-0151', 11.47,  30, 'SLEEVE'],
  ['4560-21-0069', 11.5,   30, 'BALL'],
  ['4560-21-0164', 11.73,  30, 'SLEEVE'],
  ['4560-21-0142', 12.05,  30, 'SLEEVE'],
  ['4560-21-0008', 12.1,   30, 'SPH'],
  ['4560-21-0094', 12.77,  30, 'SLEEVE'],
  ['4560-21-0043', 12.83,  30, 'SLEEVE'],
  ['4560-21-0047', 14.1,   30, 'SPH'],
  ['4560-21-0014', 14.39,  30, 'SPH'],
  ['4560-21-0044', 14.42,  30, 'SLEEVE'],
  ['4560-21-0030', 14.6,   30, 'SPH'],
  ['4560-21-0149', 14.64,  30, 'SPH'],
  ['4560-21-0165', 14.9,   30, 'SPH'],
  ['4560-21-0035', 15.1,   30, 'SPH'],
  ['4560-21-0074', 15.87,  30, 'SLEEVE'],
  ['4560-21-0007', 15.98,  30, 'SPH'],
  ['4560-21-0217', 16,     40, 'SLEEVE'],
  ['4560-21-0046', 16.01,  30, 'SLEEVE'],
  ['4560-21-0157', 16.05,  30, 'SLEEVE'],
  ['4560-21-0025', 16.1,   30, 'SPH'],
  ['4560-21-0055', 16.23,  30, 'SLEEVE'],
  ['4560-21-0133', 16.23,  30, 'SPH'],
  ['4560-21-0115', 16.48,  30, 'SPH'],
  ['4560-21-0009', 16.6,   30, 'SPH'],
  ['4560-21-0117', 16.64,  30, 'SPH'],
  ['4560-21-0015', 16.77,  30, 'SPH'],
  // 4560-21-0154 EXCLUDED (pin_dia=16.77, deprecated: "use 0015")
  ['4560-21-0111', 17.02,  30, 'SPH'],
  ['4560-21-0170', 17.12,  30, 'SLEEVE'],
  ['4560-21-0168', 17.145, 30, 'INNER RACE(PB)'],
  ['4560-21-0110', 17.28,  30, 'SPH'],
  ['4560-21-0071', 17.46,  30, 'SLEEVE'],
  ['4560-21-0068', 17.54,  30, 'SLEEVE'],
  ['4560-21-0002', 17.56,  30, 'SPH'],
  ['4560-21-0049', 17.6,   30, 'SPH'],
  ['4560-21-0118', 17.82,  30, 'SLEEVE'],
  ['4560-21-0027', 18.1,   30, 'SPH'],
  ['4560-21-0052', 18.5,   30, 'RACE'],
  ['4560-21-0189', 18.77,  30, 'INNER RACE(PB)'],
  ['4560-21-0022', 18.9,   30, 'SPH'],
  ['4560-21-0031', 19.1,   30, 'SPH'],
  ['4560-21-0001', 19.15,  30, 'SPH'],
  ['4560-21-0101', 19.2,   30, 'SLEEVE'],
  ['4560-21-0218', 19.33,  30, 'INNER RACE(PB)'],
  ['4560-21-0212', 19.64,  30, 'INNER RACE(PB)'],
  ['4560-21-0089', 19.94,  30, 'SPH'],
  ['4560-21-0145', 20.1,   30, 'SLEEVE'],
  ['4560-21-0173', 20.5,   30, 'INNER RACE(PB)'],
  ['4560-21-0067', 20.71,  30, 'SLEEVE'],
  ['4560-21-0012', 20.74,  30, 'SPH'],
  ['4560-21-0063', 20.77,  30, 'SLEEVE'],
  ['4560-21-0188', 20.81,  30, 'SLEEVE'],
  ['4560-21-0186', 20.9,   30, 'INNER RACE(PB)'],
  ['4560-21-0193', 20.96,  30, 'INNER RACE(PB)'],
  ['4560-21-0109', 20.99,  30, 'SPH'],
  ['4560-21-0013', 21.1,   30, 'SPH'],
  ['4560-21-0123', 21.25,  30, 'SPH'],
  ['4560-21-0091', 21.58,  12, 'SPH'],
  ['4560-21-0028', 22.1,   30, 'SPH'],
  ['4560-21-0048', 22.15,  30, 'RACE'],
  ['4560-21-0088', 22.32,  30, 'SPH'],
  ['4560-21-0105', 22.38,  30, 'SLEEVE'],
  ['4560-21-0056', 22.9,   30, 'RACE'],
  ['4560-21-0023', 23.11,  30, 'SPH'],
  ['4560-21-0016', 23.12,  30, 'SPH'],
  ['4560-21-0172', 23.37,  30, 'SPH'],
  ['4560-21-0216', 23.42,  30, 'INNER RACE(PB)'],
  ['4560-21-0166', 23.63,  30, 'SPH'],
  ['4560-21-0017', 23.91,  30, 'SPH'],
  ['4560-21-0036', 23.95,  30, 'SLEEVE'],
  ['4560-21-0010', 24.1,   30, 'SPH'],
  ['4560-21-0090', 24.71,  30, 'SPH'],
  ['4560-21-0032', 25.1,   30, 'SPH'],
  ['4560-21-0103', 25.2,   30, 'SPH'],
  ['4560-21-0060', 25.41,  30, 'RACE'],
  ['4560-21-0116', 25.47,  30, 'SPH'],
  ['4560-21-0003', 25.5,   30, 'SPH'],
  ['4560-21-0156', 25.55,  30, 'SPH'],
  ['4560-21-0201', 25.72,  30, 'SPH'],
  ['4560-21-0100', 25.75,  30, 'SPH'],
  ['4560-21-0113', 26.01,  30, 'SPH'],
  ['4560-21-0011', 26.1,   30, 'SPH'],
  // 4560-21-0163 EXCLUDED (pin_dia=26.1, prohibited: "使用禁止→0011を使用")
  ['4560-21-0072', 27.1,   30, 'SLEEVE'],
  ['4560-21-0120', 27.14,  30, 'SLEEVE'],
  ['4560-21-0197', 27.17,  30, 'SLEEVE'],
  ['4560-21-0210', 27.28,  30, 'INNER RACE(PB)'],
  ['4560-21-0033', 27.6,   30, 'SPH'],
  ['4560-21-0202', 27.79,  30, 'RACE'],
  ['4560-21-0018', 27.88,  30, 'SPH'],
  ['4560-21-0112', 27.93,  30, 'SPH'],
  ['4560-21-0024', 28.1,   30, 'SPH'],
  ['4560-21-0051', 28.15,  30, 'RACE'],
  ['4560-21-0169', 28.19,  30, 'OUTER RACE(PB)'],
  ['4560-21-0039', 28.4,   30, 'SLEEVE FLANGE'],
  ['4560-21-0215', 28.45,  30, 'INNER RACE(PB)'],
  ['4560-21-0131', 28.62,  30, 'RACE'],
  ['4560-21-0019', 28.68,  30, 'SPH'],
  ['4560-21-0211', 28.75,  30, 'OUTER RACE(PB)'],
  ['4560-21-0034', 29.1,   30, 'SPH'],
  ['4560-21-0026', 30.1,   30, 'SPH'],
  ['4560-21-0020', 30.26,  30, 'SPH'],
  ['4560-21-0064', 30.32,  30, 'SLEEVE'],
  ['4560-21-0194', 30.48,  30, 'OUTER RACE(PB)'],
  ['4560-21-0084', 30.52,  16, 'SPH'],
  ['4560-21-0102', 30.77,  30, 'SPH'],
  ['4560-21-0158', 31.05,  30, 'SPH'],
  ['4560-21-0086', 31.06,  30, 'SPH'],
  ['4560-21-0114', 31.11,  30, 'SPH'],
  ['4560-21-0040', 31.6,   30, 'SLEEVE FLANGE'],
  ['4560-21-0057', 31.76,  30, 'RACE'],
  ['4560-21-0179', 32.11,  30, 'OUTER RACE(PB)'],
  ['4560-21-0195', 32.31,  30, 'INNER RACE(PB)'],
  ['4560-21-0200', 32.49,  30, 'INNER RACE(PB)'],
  ['4560-21-0192', 32.67,  30, 'INNER RACE(PB)'],
  ['4560-21-0021', 33.1,   30, 'SPH'],
  ['4560-21-0087', 33.39,  30, 'SLEEVE'],
  ['4560-21-0108', 33.44,  30, 'SPH'],
  ['4560-21-0065', 33.5,   30, 'SLEEVE'],
  ['4560-21-0029', 34.15,  30, 'SPH'],
  ['4560-21-0092', 34.23,  30, 'SPH'],
  ['4560-21-0041', 34.7,   30, 'SLEEVE FLANGE'],
  ['4560-21-0037', 35.02,  30, 'SPH'],
  ['4560-21-0005', 35.03,  30, 'SPH'],
  ['4560-21-0122', 35.1,   30, 'SPH'],
  ['4560-21-0006', 35.18,  30, 'SPH'],
  ['4560-21-0144', 35.28,  30, 'SPH'],
  ['4560-21-0143', 35.54,  30, 'SPH'],
  ['4560-21-0085', 36.1,   19, 'SPH'],
  ['4560-21-0059', 36.52,  30, 'RACE'],
  ['4560-21-0004', 36.61,  30, 'SPH'],
  ['4560-21-0148', 36.67,  30, 'SLEEVE'],
  ['4560-21-0181', 36.67,  30, 'SLEEVE'],
  ['4560-21-0130', 36.87,  30, 'SPH'],
  ['4560-21-0155', 37.12,  30, 'SPH'],
  ['4560-21-0098', 37.46,  30, 'SPH'],
  ['4560-21-0174', 37.84,  30, 'INNER RACE(PB)'],
  ['4560-21-0061', 38.11,  30, 'RACE'],
  ['4560-21-0190-02', 38.27, 30, 'INNER RACE(PB)'],
  ['4560-21-0180', 38.35,  30, 'SLEEVE'],
  ['4560-21-0190-01', 38.41, 30, 'INNER RACE(PB)'],
  ['4560-21-0058', 39.66,  30, 'RACE'],
  ['4560-21-0053', 39.79,  30, 'SPH'],
  ['4560-21-0075', 39.85,  30, 'SLEEVE'],
  ['4560-21-0127', 40.04,  30, 'SPH'],
  ['4560-21-0119', 40.1,   30, 'SPH'],
  ['4560-21-0128', 40.3,   30, 'SPH'],
  ['4560-21-0167', 41.1,   30, 'SPH'],
  ['4560-21-0095', 41.28,  30, 'RACE'],
  ['4560-21-0196', 41.36,  30, 'OUTER RACE(PB)'],
  ['4560-21-0107', 41.38,  30, 'SPH'],
  ['4560-21-0213', 41.48,  30, 'OUTER RACE(PB)'],
  ['4560-21-0171', 41.77,  30, 'SPH'],
  ['4560-21-0083', 42,     16, 'RACE'],
  ['4560-21-0162', 42.127, 30, 'INNER RACE(PB)'],
  ['4560-21-0161', 42.27,  30, 'INNER RACE(PB)'],
  ['4560-21-0129', 42.87,  30, 'RACE'],
  ['4560-21-0175', 42.95,  30, 'RACE'],
  ['4560-21-0080', 44.55,  26, 'SPH'],
  ['4560-21-0121', 44.61,  30, 'SLEEVE'],
  ['4560-21-0214', 44.8,   30, 'SPH'],
  ['4560-21-0203', 45.06,  30, 'SPH'],
  ['4560-21-0079', 45.1,   25, 'SPH'],
  ['4560-21-0096', 46.14,  30, 'SPH'],
  ['4560-21-0081', 47.05,  18, 'RACE'],
  ['4560-21-0140', 47.1,   30, 'SPH'],
  ['4560-21-0185', 47.35,  30, 'INNER RACE(PB)'],
  ['4560-21-0191', 47.86,  30, 'INNER RACE(PB)'],
  ['4560-21-0104', 49.22,  30, 'RACE'],
  ['4560-21-0078', 50.1,   28, 'SPH'],
  ['4560-21-0077', 50.9,   28, 'SPH'],
  ['4560-21-0106', 50.96,  30, 'SLEEVE'],
  ['4560-21-0150', 51.1,   30, 'SPH'],
  ['4560-21-0099', 51.8,   30, 'SPH'],
  ['4560-21-0187', 52.21,  30, 'OUTER RACE(PB)'],
  ['4560-21-0136', 53.25,  30, 'SPH'],
  ['4560-21-0097', 53.28,  30, 'SPH'],
  ['4560-21-0076', 54.1,   43, 'SPH'],
  ['4560-21-0160', 55.04,  35, 'OUTER RACE(PB)'],
  ['4560-21-0177-02', 55.04, 30, 'OUTER RACE(PB)'],
  ['4560-21-0139', 55.1,   30, 'SPH'],
  ['4560-21-0177-01', 55.15, 30, 'OUTER RACE(PB)'],
  ['4560-21-0159', 55.2,   35, 'OUTER RACE(PB)'],
  ['4560-21-0207', 56.56,  34, 'SLEEVE'],
  ['4560-21-0206', 56.86,  34, 'SLEEVE'],
  ['4560-21-0134', 57.41,  30, 'SLEEVE'],
  ['4560-21-0135', 57.65,  30, 'SLEEVE'],
  ['4560-21-0209', 59.39,  35, 'SLEEVE'],
  ['4560-21-0082', 59.6,   35, 'SPH'],
  ['4560-21-0093', 59.63,  36, 'SPH'],
  ['4560-21-0208', 59.69,  35, 'SLEEVE'],
  ['4560-21-0178', 62.06,  30, 'OUTER RACE(PB)'],
  ['4560-21-0152', 66.49,  30, 'SLEEVE'],
  ['4560-21-0138', 68.1,   30, 'SPH'],
  ['4560-21-0184', 68.73,  30, 'INNER RACE(PB)'],
  ['4560-21-0125', 69.95,  30, 'RACE'],
  ['4560-21-0183', 72.81,  30, 'INNER RACE(PB)'],
  ['4560-21-0182', 73.01,  30, 'INNER RACE(PB)'],
  ['4560-21-0199', 75.76,  45, 'SLEEVE'],
  ['4560-21-0198', 76.06,  45, 'SLEEVE'],
  ['4560-21-0126', 76.3,   30, 'RACE'],
  ['4560-21-0205', 79.03,  45, 'SLEEVE'],
  ['4560-21-0204', 79.33,  45, 'SLEEVE'],
];

async function run() {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create inventory table (shared: RACE PUSHER + SET PIN)
    await client.query(`
      CREATE TABLE IF NOT EXISTS tooling_oc16a (
        id           SERIAL PRIMARY KEY,
        tooling_name VARCHAR,
        tooling_no   VARCHAR,
        dim_a        NUMERIC,  -- pusher OD (RACE PUSHER) or pin dia (SET PIN) — match dim
        dim_b        NUMERIC,  -- pusher ID or pin length
        dim_c        NUMERIC,  -- C'BORE depth (RACE PUSHER)
        dim_d        NUMERIC,  -- notch depth (RACE PUSHER)
        dim_e        NUMERIC,  -- chamfer (RACE PUSHER)
        dim_f        TEXT      -- material note (RACE PUSHER) or part class (SET PIN)
      )
    `);
    await client.query(`DELETE FROM tooling_oc16a`);

    // Bulk insert RACE PUSHER rows
    let inv = 0;
    for (const [no, a, b, c, d, e, f] of RACE_PUSHER_ROWS) {
      await client.query(
        `INSERT INTO tooling_oc16a (tooling_name, tooling_no, dim_a, dim_b, dim_c, dim_d, dim_e, dim_f)
         VALUES ('RACE PUSHER',$1,$2,$3,$4,$5,$6,$7)`,
        [no, a, b, c, d, e, f]
      );
      inv++;
    }

    // Bulk insert SET PIN rows
    for (const [no, a, b, f] of SET_PIN_ROWS) {
      await client.query(
        `INSERT INTO tooling_oc16a (tooling_name, tooling_no, dim_a, dim_b, dim_f)
         VALUES ('SET PIN',$1,$2,$3,$4)`,
        [no, a, b, f]
      );
      inv++;
    }
    console.log(`Imported ${RACE_PUSHER_ROWS.length} RACE PUSHER + ${SET_PIN_ROWS.length} SET PIN rows (${inv} total)`);

    // 2. Machine (upsert)
    const m = await client.query(
      `INSERT INTO tooling_machine (machine_name, label, inventory_table, inventory_machine_filter, machine_group, enabled)
       VALUES ($1,$2,$3,$4,$5,true)
       ON CONFLICT (machine_name) DO UPDATE SET
         label=EXCLUDED.label, inventory_table=EXCLUDED.inventory_table,
         inventory_machine_filter=EXCLUDED.inventory_machine_filter,
         machine_group=EXCLUDED.machine_group, enabled=true, updated_at=now()
       RETURNING id`,
      [MACHINE.machine_name, MACHINE.label, MACHINE.inventory_table, MACHINE.inventory_machine_filter, MACHINE.machine_group]
    );
    const machineId = m.rows[0].id;
    console.log(`Machine OC-16A id=${machineId}`);

    // 3. Limits
    await client.query(`DELETE FROM tooling_machine_limit WHERE machine_id=$1`, [machineId]);
    let so = 0;
    for (const l of LIMITS) {
      await client.query(
        `INSERT INTO tooling_machine_limit (machine_id, input_var, min_value, max_value, min_inclusive, max_inclusive, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [machineId, l.input_var, l.min_value, l.max_value, l.min_inclusive, l.max_inclusive, so++]
      );
    }

    // 4. Formulas
    await client.query(`DELETE FROM tooling_formula WHERE machine_id=$1`, [machineId]);
    let fCount = 0;
    for (const [tooling, rows] of Object.entries(FORMULAS)) {
      let order = 0;
      for (const r of rows) {
        await client.query(
          `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, condition_expr, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [machineId, tooling, r.key, r.expr, r.cond || null, order++]
        );
        fCount++;
      }
    }

    // 5. Search rules — inventory_tooling_filter required (shared table)
    await client.query(`DELETE FROM tooling_search_rule WHERE machine_id=$1`, [machineId]);
    let rCount = 0;
    for (const [tooling, rules] of Object.entries(RULES)) {
      let prio = 0;
      for (const [key, col, tolP, tolM, matchDim, label] of rules) {
        await client.query(
          `INSERT INTO tooling_search_rule
             (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus, sort_priority, label, is_match_dim, inventory_tooling_filter)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [machineId, tooling, key, col, tolP, tolM, prio++, label, matchDim, tooling]
        );
        rCount++;
      }
    }

    await client.query('COMMIT');
    console.log(`✅ OC-16A seeded: ${LIMITS.length} limits, ${fCount} formulas, ${rCount} search rules`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ seed failed:', e.message);
    throw e;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(() => process.exit(1));
}
module.exports = { run };
