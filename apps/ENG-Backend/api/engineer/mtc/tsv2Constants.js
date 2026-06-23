'use strict';

const TSV2_TABLES = {
  MACHINE:     'tooling_machine',
  LIMIT:       'tooling_machine_limit',
  FORMULA:     'tooling_formula',
  SEARCH_RULE: 'tooling_search_rule',
  FORMULA_ERROR_LOG: 'mtc_formula_error_log',
  // Part No → tool lookup for fixtures chosen by workpiece part number (品番) instead of a
  // dimensional formula (e.g. ROTARY DRESSER 4800-42 on KS-400B5/B6). Consumed by the SDS PDF.
  PARTNO_MAP: 'tooling_partno_map',
  // Read-only references to existing tables
  SPEC_PROCESS: 'tooling_spec_process',
};

module.exports = { TSV2_TABLES };
