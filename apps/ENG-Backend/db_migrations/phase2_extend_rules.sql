-- Phase 2: Extend mtc_selection_rules for Dynamic Rule Engine
-- Run this script once against the eng_system database

-- 1. Add new columns to support complex formula resolution
ALTER TABLE mtc_selection_rules
  ADD COLUMN IF NOT EXISTS calc_context  TEXT,        -- e.g. 'ks400b', 'ks03a', 'ks500rd'
  ADD COLUMN IF NOT EXISTS dims          JSONB DEFAULT '[]',  -- array of dimension matching rules
  ADD COLUMN IF NOT EXISTS result_fields JSONB DEFAULT '[]',  -- which dim columns to show in result
  ADD COLUMN IF NOT EXISTS machine_ok_condition TEXT;  -- JS-evaluatable flag key, e.g. 'ks400bOK'

-- 2. dims JSONB schema (each element):
-- {
--   "calc_key":     "wd_A",           -- key inside calc_context object (nested: "rollerShoe.A")
--   "tool_field":   "dim_a",          -- column name in tooling table to compare against
--   "tol_plus":     1.01,             -- upper tolerance
--   "tol_minus":    1.01,             -- lower tolerance
--   "sort_priority": 1,               -- 1 = primary sort, 2 = secondary, etc.
--   "penalty_over": 10000             -- add to diff score if outside tolerance (optional)
-- }

-- 3. result_fields schema (each element):
-- { "tool_field": "dim_a", "label": "A (OD)" }

-- Verify columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'mtc_selection_rules'
ORDER BY ordinal_position;
