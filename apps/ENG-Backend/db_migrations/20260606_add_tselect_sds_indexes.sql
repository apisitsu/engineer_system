-- ============================================================================
-- Tooling Select ↔ SDS — supporting indexes (engPool / eng_system)
-- ----------------------------------------------------------------------------
-- Idempotent (CREATE INDEX IF NOT EXISTS). Safe to run multiple times.
-- Covers the hot lookup paths confirmed in code:
--   searchService.search()  → spec by cn, formula/limit/rule by machine
--   sdsV2PdfController       → sds_machine_tool by (machine_type, process_code)
--   sdsV2ReportController    → sds_parameter grouped by (cn, machine_type_name)
--
-- Run AFTER reviewing 20260606_tselect_sds_diagnostics.sql (some of these may
-- already be covered by a PK / UNIQUE constraint — a redundant index is low
-- harm but check first to keep the schema tidy).
-- ============================================================================

-- Tooling Select spec lookup: WHERE cn = $1
CREATE INDEX IF NOT EXISTS idx_tooling_spec_process_cn
  ON tooling_spec_process (cn);

-- Formula fetch: WHERE machine_id = $1 (DISTINCT tooling_name) and per-tooling compute
CREATE INDEX IF NOT EXISTS idx_tooling_formula_machine_tooling
  ON tooling_formula (machine_id, tooling_name);

-- Search rules: WHERE machine_id = $1 AND tooling_name = $2
CREATE INDEX IF NOT EXISTS idx_tooling_search_rule_machine_tooling
  ON tooling_search_rule (machine_id, tooling_name);

-- Machine eligibility limits: WHERE machine_id = $1
CREATE INDEX IF NOT EXISTS idx_tooling_machine_limit_machine
  ON tooling_machine_limit (machine_id);

-- SDS PDF tool whitelist: WHERE machine_type = $1 AND process_code = $2
CREATE INDEX IF NOT EXISTS idx_sds_machine_tool_type_process
  ON sds_machine_tool (machine_type, process_code);

-- SDS coverage report: GROUP BY cn, machine_type_name WHERE cn IS NOT NULL
CREATE INDEX IF NOT EXISTS idx_sds_parameter_cn_machine
  ON sds_parameter (cn, machine_type_name);

-- SDS excel mapping lookup by machine type
CREATE INDEX IF NOT EXISTS idx_sds_excel_mapping_machine
  ON sds_excel_mapping (machine_type_name);
