-- ============================================================================
-- Tooling Select ↔ SDS — diagnostics (READ-ONLY, run manually)
-- ----------------------------------------------------------------------------
-- Purpose: surface the consistency risks identified in the pipeline audit
--   (doc/tselect-sds-pipeline-audit.md). Nothing here mutates data.
--
-- Sections A–C run against engPool (eng_system). Section D (dimension drift)
-- crosses two databases (engPool vs maqPool/lpb) and therefore CANNOT be a
-- single SQL — see the note + per-pool template at the bottom.
-- ============================================================================


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ A. INDEX PRESENCE — are the hot-path indexes in place?                      │
-- └──────────────────────────────────────────────────────────────────────────┘
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'tooling_spec_process', 'tooling_formula', 'tooling_search_rule',
    'tooling_machine_limit', 'sds_machine_tool', 'sds_parameter', 'sds_excel_mapping'
  )
ORDER BY tablename, indexname;


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ B. MACHINE-NAME CONSISTENCY (no FK exists — string equality is the join)    │
-- │    Any row returned = an orphaned machine name that will silently drop      │
-- │    data (wrong/empty PDF, miscounted coverage).                             │
-- └──────────────────────────────────────────────────────────────────────────┘

-- B1. sds_machine_tool.machine_type with no matching machine type code
SELECT DISTINCT mt.machine_type
FROM sds_machine_tool mt
LEFT JOIN sds_machine_type_code c ON c.machine_type_name = mt.machine_type
WHERE c.machine_type_name IS NULL;

-- B2. sds_parameter.machine_type_name with no matching machine type code
SELECT DISTINCT p.machine_type_name
FROM sds_parameter p
LEFT JOIN sds_machine_type_code c ON c.machine_type_name = p.machine_type_name
WHERE c.machine_type_name IS NULL
  AND p.machine_type_name IS NOT NULL;

-- B3. sds_excel_mapping.machine_type_name with no matching machine type code
--     (machine_type_name IS NULL = intentional shared layout → excluded)
SELECT DISTINCT m.machine_type_name
FROM sds_excel_mapping m
LEFT JOIN sds_machine_type_code c ON c.machine_type_name = m.machine_type_name
WHERE c.machine_type_name IS NULL
  AND m.machine_type_name IS NOT NULL;

-- B4. T-Select machine names (tooling_machine) vs SDS machine type names.
--     These legitimately DIFFER (T-Select labels grouped machines by
--     machine_group; SDS stores the representative machine_type_name), so this
--     is for manual review — confirm every T-Select name resolves to an SDS
--     name either directly or via machine_group.
SELECT tm.machine_name,
       tm.machine_group,
       c.machine_type_name AS sds_direct_match,
       cg.machine_group    AS sds_group_match
FROM tooling_machine tm
LEFT JOIN sds_machine_type_code c  ON c.machine_type_name = tm.machine_name
LEFT JOIN sds_machine_type_code cg ON cg.machine_group   = tm.machine_group
WHERE tm.enabled = true
ORDER BY tm.machine_name;


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ C. T-SELECT SPEC DATA-QUALITY (feeds the formula engine & direction gate)   │
-- └──────────────────────────────────────────────────────────────────────────┘

-- C1. Specs missing grinding direction → direction gate cannot reject false
--     positives for these (they fall back to "accept").
SELECT
  COUNT(*)                                                        AS total_specs,
  COUNT(*) FILTER (WHERE process IS NULL OR btrim(process) = '')  AS missing_direction,
  COUNT(*) FILTER (WHERE process NOT IN ('OD->ID','ID->OD')
                     AND process IS NOT NULL
                     AND btrim(process) <> '')                    AS nonstandard_direction,
  COUNT(*) FILTER (WHERE type IS NULL OR btrim(type) = '')        AS missing_type
FROM tooling_spec_process;

-- C2. Non-standard direction strings (e.g. 'OD=>ID') that break the gate/flags
SELECT process, COUNT(*) AS n
FROM tooling_spec_process
WHERE process IS NOT NULL AND btrim(process) <> ''
  AND process NOT IN ('OD->ID','ID->OD')
GROUP BY process
ORDER BY n DESC;

-- C3. tooling_formula referencing a tooling_name that has NO search rule
--     (formula computes but nothing maps it to inventory → tool never returned)
SELECT f.machine_id, f.tooling_name
FROM (SELECT DISTINCT machine_id, tooling_name FROM tooling_formula) f
LEFT JOIN (SELECT DISTINCT machine_id, tooling_name FROM tooling_search_rule) r
  ON r.machine_id = f.machine_id AND r.tooling_name = f.tooling_name
WHERE r.tooling_name IS NULL
ORDER BY f.machine_id, f.tooling_name;


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ D. DIMENSION DRIFT — tooling_spec_process (engPool) vs lpb.* (maqPool)      │
-- └──────────────────────────────────────────────────────────────────────────┘
-- These live in DIFFERENT databases, so a single cross-join is not possible.
-- Options:
--   1) Use the app: GET /api/tooling-select/spec/factory-preview/:cn compares
--      the spec row against live factory dims for one CN.
--   2) Build a drift-audit endpoint that bulk-fetches both sides and diffs
--      od_aft/id_aft/w_aft (see audit doc, recommendation #5).
--   3) Manual spot-check — run each half in its own connection:
--
--   -- engPool (eng_system):
--   --   SELECT cn, od_aft, id_aft, w_aft FROM tooling_spec_process WHERE cn = '250235';
--   -- maqPool (maqdb / lpb) — convert cn 250235 → C25-00235 first:
--   --   SELECT control_no, od, id, width FROM lpb.eng_race  WHERE control_no = 'C25-00235';
--   --   SELECT control_no, ball_dia, in_dia, width FROM lpb.eng_ball WHERE control_no = 'C31-...';
--   --   (factory after-dim columns differ per part table:
--   --      race=od/id/width · ball=ball_dia/in_dia/width · sleeve=od/id/(no width))
--   App equivalent (engPool): GET /api/tooling-select/spec/drift-audit?tol=0.005


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ E. INVENTORY tool-number COLUMN STANDARDIZATION                             │
-- │    Canonical column is `tooling_no`. As of 2026-06-06 every tooling_*       │
-- │    inventory table already uses it. Any row returned here = a NEW table     │
-- │    that broke the convention → matchNo() will return null for it silently.  │
-- └──────────────────────────────────────────────────────────────────────────┘
SELECT t.table_name
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_name LIKE 'tooling_%'
  AND t.table_name NOT IN (   -- non-inventory tooling_* tables
    'tooling_formula', 'tooling_formula1', 'tooling_machine', 'tooling_machine_limit',
    'tooling_search_rule', 'tooling_spec_process', 'tooling_template_b'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = t.table_name
      AND c.column_name = 'tooling_no'
  )
ORDER BY t.table_name;
