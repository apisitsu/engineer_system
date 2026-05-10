'use strict';

const { TABLES } = require('../mtcConstants');

/**
 * Static display config for all known tooling machines.
 * key        — matches calc context key used by dynamic rules
 * label      — human-readable machine label shown in UI
 * table      — inventory DB table (TABLES constant)
 * tfMachine  — machine name used in tooling_formula rows
 * machineFilter — optional SQL filter on the Machine column (null = no filter)
 */
const MACHINE_TABLE_CONFIG = [
  {
    key: 'ksb22g',
    label: 'KS-B22G',
    table: TABLES.TOOLING_KSB22G,
    tfMachine: 'KS-B22G',
    machineFilter: 'KS-B22G',
  },
  {
    key: 'ksb80',
    label: 'KS-B80',
    table: TABLES.TOOLING_KSB80,
    tfMachine: 'KS-B80',
    machineFilter: 'KS-B80',
  },
  {
    key: 'tsg300znc',
    label: 'TSG-300ZNC',
    table: TABLES.TOOLING_TSG300,
    tfMachine: 'TSG-300ZNC',
    machineFilter: 'NOT_W',
  },
  {
    key: 'tsg300w',
    label: 'TSG300W',
    table: TABLES.TOOLING_TSG300,
    tfMachine: 'TSG300W',
    machineFilter: 'W',
  },
  {
    key: 'ks03a',
    label: 'KS-03A',
    table: TABLES.TOOLING_KS03A,
    tfMachine: 'KS-03A',
    machineFilter: null,
  },
  {
    key: 'ksb22rd',
    label: 'KS-B22RD',
    table: TABLES.TOOLING_KS03A,
    tfMachine: 'KS-B22RD',
    machineFilter: null,
  },
  {
    key: 'ks400b',
    label: 'KS400B',
    table: TABLES.TOOLING_KS400B,
    tfMachine: 'KS400B',
    machineFilter: 'KS400B',
  },
  {
    key: 'ks500rd',
    label: 'KS500RD',
    table: TABLES.TOOLING_KS500RD,
    tfMachine: 'KS500RD',
    machineFilter: 'KS500RD',
  },
  {
    key: 'ks400b5',
    label: 'KS400B5',
    table: TABLES.TOOLING_KS400B5,
    tfMachine: 'KS-400B5',
    machineFilter: 'KS400B5',
  },
  {
    key: 'ks400b6',
    label: 'KS400B6',
    table: TABLES.TOOLING_KS400B6,
    tfMachine: 'KS400B6',
    machineFilter: 'KS400B6',
  },
];

module.exports = { MACHINE_TABLE_CONFIG };
