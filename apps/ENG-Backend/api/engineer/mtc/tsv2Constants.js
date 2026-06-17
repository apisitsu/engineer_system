'use strict';

const TSV2_TABLES = {
  MACHINE:     'tooling_machine',
  LIMIT:       'tooling_machine_limit',
  FORMULA:     'tooling_formula',
  SEARCH_RULE: 'tooling_search_rule',
  FORMULA_ERROR_LOG: 'mtc_formula_error_log',
  // Read-only references to existing tables
  SPEC_PROCESS: 'tooling_spec_process',
};

module.exports = { TSV2_TABLES };
