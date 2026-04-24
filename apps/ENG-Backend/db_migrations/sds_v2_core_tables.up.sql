-- =======================================================================
-- SDS V2 Core Tables Migration
-- Target DB: eng_system (engPool)
-- Date: 2026-04-18
--
-- Tables created:
--   1. sds_machine_type_code  — lookup table from machine_type_code.xlsx
--   2. sds_excel_mapping      — replaces template_excel_mapping
--   3. sds_parameter          — replaces setup_parameter_value
-- =======================================================================

-- -----------------------------------------------------------------------
-- 1. sds_machine_type_code
--    Lookup: machine code → machine name + machine-type-specific configs
--    Sourced from machine_type_code.xlsx (446 rows, prefix 0xx/5xx/6xx...)
--    grinding_area_label fills cell AN15 and changes per machine type
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sds_machine_type_code (
  id                   SERIAL        PRIMARY KEY,
  machine_type_code    VARCHAR(10)   NOT NULL UNIQUE,   -- e.g. '021', '027'
  machine_type_name    VARCHAR(200),                    -- e.g. 'KS-B80', 'KS-B22G'
  grinding_area_label  VARCHAR(100)  DEFAULT 'GRINDING AREA',  -- cell AN15
  is_active            BOOLEAN       NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  sds_machine_type_code IS 'Machine type master table from machine_type_code.xlsx (446 codes)';
COMMENT ON COLUMN sds_machine_type_code.grinding_area_label IS 'Text for cell AN15 in sds_template.xlsx — changes per machine type (e.g. ID GRINDING AREA, FACE GRINDING AREA)';

-- -----------------------------------------------------------------------
-- 2. sds_excel_mapping
--    Replaces: template_excel_mapping
--    Changes vs old table:
--      - REMOVED template_id (single template now)
--      - RENAMED sheet_name → machine_type_name
--        NULL = universal (all machine types)
--        specific name = override mapping for that machine type only
--    Purpose: tells PDF generator which cell_address to fill with which param_key
--    Lookup: machine_type_name + cell_address → param_key
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sds_excel_mapping (
  id                 SERIAL        PRIMARY KEY,
  machine_type_name  VARCHAR(200),                    -- NULL = universal
  cell_address       VARCHAR(10)   NOT NULL,          -- e.g. 'B3', 'AN15'
  param_key          VARCHAR(100)  NOT NULL,          -- e.g. 'machine_type_name', 'cn'
  description        VARCHAR(200),
  is_active          BOOLEAN       NOT NULL DEFAULT true,
  sort_order         INT           NOT NULL DEFAULT 0,
  UNIQUE (machine_type_name, cell_address)            -- NULL treated as a group
);

COMMENT ON TABLE  sds_excel_mapping IS 'Excel cell → param_key mapping for sds_template.xlsx. Replaces template_excel_mapping.';
COMMENT ON COLUMN sds_excel_mapping.machine_type_name IS 'NULL = applies to all machines. Specific name overrides NULL row for same cell_address.';
COMMENT ON COLUMN sds_excel_mapping.param_key IS 'Key used to look up value from: Search API response, sds_parameter table, or sds_machine_type_code config';

CREATE INDEX IF NOT EXISTS idx_sds_excel_mapping_machine
  ON sds_excel_mapping(machine_type_name);

-- -----------------------------------------------------------------------
-- 3. sds_parameter
--    Replaces: setup_parameter_value
--    Single table, two roles distinguished by cn:
--
--    cn = NULL  →  Machine-type section config (A16:I55)
--                  ใช้ได้กับทุก CN ที่ใช้ machine นั้น
--                  param_key format: row_{n}_label, row_{n}_unit
--                  เช่น row_16_label='FEED POSITION DATA 2'
--                       row_18_label='QUICK FEED', row_18_unit='min-1'
--
--    cn = 'C31-01234' →  Per-record manual data
--                         program_no, program_name, sds_rev,
--                         rev_1..5, ecn_no_1..5, date_1..5,
--                         description_1..5, remark_1..5,
--                         sample_no, reason_of_change
--
--    param_keys ที่ไม่เก็บ (มาจาก Search API):
--      machine_type_name, parts_no, process_code, process_name,
--      ct, cn, material, dwg_rev
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sds_parameter (
  id                 SERIAL        PRIMARY KEY,
  cn                 VARCHAR(20),                      -- NULL = machine-type config
  machine_type_name  VARCHAR(200)  NOT NULL,           -- e.g. 'KS-B22G'
  param_key          VARCHAR(100)  NOT NULL,
  param_value        TEXT,
  created_by         VARCHAR(100),
  updated_by         VARCHAR(100),
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  sds_parameter IS 'SDS parameters: cn=NULL → machine section config (A16:I55), cn=specific → per-record manual data';
COMMENT ON COLUMN sds_parameter.cn IS 'NULL = machine-type-wide config. Specific value e.g. C31-01234 = per-SDS-record.';
COMMENT ON COLUMN sds_parameter.machine_type_name IS 'Machine name e.g. KS-B22G — links to sds_machine_type_code.machine_type_name';
COMMENT ON COLUMN sds_parameter.param_key IS 'A16:I55 config: row_{n}_label / row_{n}_unit. Per-record: program_no, sds_rev, rev_1..5, ecn_no_1..5, etc.';

-- UNIQUE index รองรับ cn=NULL (NULL != NULL ใน SQL ปกติ ต้องใช้ COALESCE)
CREATE UNIQUE INDEX IF NOT EXISTS uq_sds_parameter
  ON sds_parameter(COALESCE(cn, '__machine_config__'), machine_type_name, param_key);

-- Index query machine config (cn IS NULL)
CREATE INDEX IF NOT EXISTS idx_sds_parameter_machine_config
  ON sds_parameter(machine_type_name) WHERE cn IS NULL;

-- Index query per-record data (cn IS NOT NULL)
CREATE INDEX IF NOT EXISTS idx_sds_parameter_record
  ON sds_parameter(cn, machine_type_name) WHERE cn IS NOT NULL;

-- =======================================================================
-- SEED: sds_excel_mapping — complete mapping from sds_template.xlsx
--       machine_type_name = NULL means universal (all machine types)
-- =======================================================================
INSERT INTO sds_excel_mapping (machine_type_name, cell_address, param_key, description, sort_order) VALUES

-- ---- HEADER: Data from Search API (these param_keys come from /api/sds/v2/search) ----
(NULL, 'B3',   'machine_type_name',  'MACHINE — from process_info.wc',           1),
(NULL, 'M3',   'parts_no',           'PART NO — from item data',                  2),
(NULL, 'T3',   'dwg_rev',            'REV — from cad_rev_data',                   3),
(NULL, 'Z3',   'process_code',       'PROCESS code — from process_info',           4),
(NULL, 'AC3',  'process_name',       'PROCESS name — from process master',         5),
(NULL, 'B4',   'ct',                 'CYCLE TIME — from process_info',             6),
(NULL, 'M4',   'cn',                 'C/N — control number',                       7),
(NULL, 'M5',   'material',           'MAT''L TYPE — from eng_mcode',               8),
(NULL, 'B5',   'category',           'PART CATEGORY — Ball Parts / Race Parts etc.', 9),

-- ---- HEADER: Manual entry (these param_keys come from sds_parameter table) ----
(NULL, 'Z4',   'program_no',         'PROGRAM NO — manual entry',                 10),
(NULL, 'Z5',   'program_name',       'PROGRAM NAME — manual entry',               11),
(NULL, 'AH4',  'sds_rev',            'SDS REV — default NC, manual update',       12),
(NULL, 'AN4',  'stamp_prepared',     'PREPARED signature/name',                   13),
(NULL, 'AQ4',  'stamp_checked',      'CHECKED signature/name',                    14),
(NULL, 'AT4',  'stamp_approved',     'APPROVED signature/name',                   15),

-- ---- CHANGE LOG: 5 revision rows (rows 9–13) ----
(NULL, 'A9',   'rev_1',              'Change log row 1: REV',                     20),
(NULL, 'B9',   'ecn_no_1',           'Change log row 1: ECN NO',                  21),
(NULL, 'G9',   'date_1',             'Change log row 1: DATE',                    22),
(NULL, 'J9',   'description_1',      'Change log row 1: DESCRIPTION',             23),
(NULL, 'AH9',  'remark_1',           'Change log row 1: REMARK',                  24),
(NULL, 'A10',  'rev_2',              'Change log row 2: REV',                     25),
(NULL, 'B10',  'ecn_no_2',           'Change log row 2: ECN NO',                  26),
(NULL, 'G10',  'date_2',             'Change log row 2: DATE',                    27),
(NULL, 'J10',  'description_2',      'Change log row 2: DESCRIPTION',             28),
(NULL, 'AH10', 'remark_2',           'Change log row 2: REMARK',                  29),
(NULL, 'A11',  'rev_3',              'Change log row 3: REV',                     30),
(NULL, 'B11',  'ecn_no_3',           'Change log row 3: ECN NO',                  31),
(NULL, 'G11',  'date_3',             'Change log row 3: DATE',                    32),
(NULL, 'J11',  'description_3',      'Change log row 3: DESCRIPTION',             33),
(NULL, 'AH11', 'remark_3',           'Change log row 3: REMARK',                  34),
(NULL, 'A12',  'rev_4',              'Change log row 4: REV',                     35),
(NULL, 'B12',  'ecn_no_4',           'Change log row 4: ECN NO',                  36),
(NULL, 'G12',  'date_4',             'Change log row 4: DATE',                    37),
(NULL, 'J12',  'description_4',      'Change log row 4: DESCRIPTION',             38),
(NULL, 'AH12', 'remark_4',           'Change log row 4: REMARK',                  39),
(NULL, 'A13',  'rev_5',              'Change log row 5: REV',                     40),
(NULL, 'B13',  'ecn_no_5',           'Change log row 5: ECN NO',                  41),
(NULL, 'G13',  'date_5',             'Change log row 5: DATE',                    42),
(NULL, 'J13',  'description_5',      'Change log row 5: DESCRIPTION',             43),
(NULL, 'AH13', 'remark_5',           'Change log row 5: REMARK',                  44),

-- ---- MACHINE-TYPE-SPECIFIC LABEL (cell AN15) ----
-- NULL = default fallback; add specific rows per machine type for override
(NULL, 'AN15', 'grinding_area_label','Grinding area label — from sds_machine_type_code.grinding_area_label', 50),

-- ---- TOOLING T01–T05 (rows 16–25) ----
(NULL, 'L16',  'tool_name_T01',   'T01 Tool name — from process_plan',            60),
(NULL, 'R16',  'tool_name_T02',   'T02 Tool name',                                61),
(NULL, 'X16',  'tool_name_T03',   'T03 Tool name',                                62),
(NULL, 'AD16', 'tool_name_T04',   'T04 Tool name',                                63),
(NULL, 'AJ16', 'tool_name_T05',   'T05 Tool name',                                64),
(NULL, 'K18',  'tool_image_T01',  'T01 Image — from sds_v2_tooling_image',        65),
(NULL, 'Q18',  'tool_image_T02',  'T02 Image',                                    66),
(NULL, 'W18',  'tool_image_T03',  'T03 Image',                                    67),
(NULL, 'AC18', 'tool_image_T04',  'T04 Image',                                    68),
(NULL, 'AI18', 'tool_image_T05',  'T05 Image',                                    69),
(NULL, 'M24',  'tool_dwg_no_T01', 'T01 Tooling DWG No — from process_plan',       70),
(NULL, 'S24',  'tool_dwg_no_T02', 'T02 Tooling DWG No',                           71),
(NULL, 'Y24',  'tool_dwg_no_T03', 'T03 Tooling DWG No',                           72),
(NULL, 'AE24', 'tool_dwg_no_T04', 'T04 Tooling DWG No',                           73),
(NULL, 'AK24', 'tool_dwg_no_T05', 'T05 Tooling DWG No',                           74),
(NULL, 'M25',  'maker_T01',       'T01 Maker — from sds_parameter or lpb DB',     75),
(NULL, 'S25',  'maker_T02',       'T02 Maker',                                    76),
(NULL, 'Y25',  'maker_T03',       'T03 Maker',                                    77),
(NULL, 'AE25', 'maker_T04',       'T04 Maker',                                    78),
(NULL, 'AK25', 'maker_T05',       'T05 Maker',                                    79),

-- ---- TOOLING T06–T10 (rows 26–35) ----
(NULL, 'L26',  'tool_name_T06',   'T06 Tool name',                                80),
(NULL, 'R26',  'tool_name_T07',   'T07 Tool name',                                81),
(NULL, 'X26',  'tool_name_T08',   'T08 Tool name',                                82),
(NULL, 'AD26', 'tool_name_T09',   'T09 Tool name',                                83),
(NULL, 'AJ26', 'tool_name_T10',   'T10 Tool name',                                84),
(NULL, 'K28',  'tool_image_T06',  'T06 Image',                                    85),
(NULL, 'Q28',  'tool_image_T07',  'T07 Image',                                    86),
(NULL, 'W28',  'tool_image_T08',  'T08 Image',                                    87),
(NULL, 'AC28', 'tool_image_T09',  'T09 Image',                                    88),
(NULL, 'AI28', 'tool_image_T10',  'T10 Image',                                    89),
(NULL, 'M34',  'tool_dwg_no_T06', 'T06 Tooling DWG No',                           90),
(NULL, 'S34',  'tool_dwg_no_T07', 'T07 Tooling DWG No',                           91),
(NULL, 'Y34',  'tool_dwg_no_T08', 'T08 Tooling DWG No',                           92),
(NULL, 'AE34', 'tool_dwg_no_T09', 'T09 Tooling DWG No',                           93),
(NULL, 'AK34', 'tool_dwg_no_T10', 'T10 Tooling DWG No',                           94),
(NULL, 'M35',  'maker_T06',       'T06 Maker',                                    95),
(NULL, 'S35',  'maker_T07',       'T07 Maker',                                    96),
(NULL, 'Y35',  'maker_T08',       'T08 Maker',                                    97),
(NULL, 'AE35', 'maker_T09',       'T09 Maker',                                    98),
(NULL, 'AK35', 'maker_T10',       'T10 Maker',                                    99),

-- ---- TOOLING T11–T15 (rows 36–45) ----
(NULL, 'L36',  'tool_name_T11',   'T11 Tool name',                               100),
(NULL, 'R36',  'tool_name_T12',   'T12 Tool name',                               101),
(NULL, 'X36',  'tool_name_T13',   'T13 Tool name',                               102),
(NULL, 'AD36', 'tool_name_T14',   'T14 Tool name',                               103),
(NULL, 'AJ36', 'tool_name_T15',   'T15 Tool name',                               104),
(NULL, 'K38',  'tool_image_T11',  'T11 Image',                                   105),
(NULL, 'Q38',  'tool_image_T12',  'T12 Image',                                   106),
(NULL, 'W38',  'tool_image_T13',  'T13 Image',                                   107),
(NULL, 'AC38', 'tool_image_T14',  'T14 Image',                                   108),
(NULL, 'AI38', 'tool_image_T15',  'T15 Image',                                   109),
(NULL, 'M44',  'tool_dwg_no_T11', 'T11 Tooling DWG No',                          110),
(NULL, 'S44',  'tool_dwg_no_T12', 'T12 Tooling DWG No',                          111),
(NULL, 'Y44',  'tool_dwg_no_T13', 'T13 Tooling DWG No',                          112),
(NULL, 'AE44', 'tool_dwg_no_T14', 'T14 Tooling DWG No',                          113),
(NULL, 'AK44', 'tool_dwg_no_T15', 'T15 Tooling DWG No',                          114),
(NULL, 'M45',  'maker_T11',       'T11 Maker',                                   115),
(NULL, 'S45',  'maker_T12',       'T12 Maker',                                   116),
(NULL, 'Y45',  'maker_T13',       'T13 Maker',                                   117),
(NULL, 'AE45', 'maker_T14',       'T14 Maker',                                   118),
(NULL, 'AK45', 'maker_T15',       'T15 Maker',                                   119),

-- ---- TOOLING T16–T20 (rows 46–55) ----
(NULL, 'L46',  'tool_name_T16',   'T16 Tool name',                               120),
(NULL, 'R46',  'tool_name_T17',   'T17 Tool name',                               121),
(NULL, 'X46',  'tool_name_T18',   'T18 Tool name',                               122),
(NULL, 'AD46', 'tool_name_T19',   'T19 Tool name',                               123),
(NULL, 'AJ46', 'tool_name_T20',   'T20 Tool name',                               124),
(NULL, 'K48',  'tool_image_T16',  'T16 Image',                                   125),
(NULL, 'Q48',  'tool_image_T17',  'T17 Image',                                   126),
(NULL, 'W48',  'tool_image_T18',  'T18 Image',                                   127),
(NULL, 'AC48', 'tool_image_T19',  'T19 Image',                                   128),
(NULL, 'AI48', 'tool_image_T20',  'T20 Image',                                   129),
(NULL, 'M54',  'tool_dwg_no_T16', 'T16 Tooling DWG No',                          130),
(NULL, 'S54',  'tool_dwg_no_T17', 'T17 Tooling DWG No',                          131),
(NULL, 'Y54',  'tool_dwg_no_T18', 'T18 Tooling DWG No',                          132),
(NULL, 'AE54', 'tool_dwg_no_T19', 'T19 Tooling DWG No',                          133),
(NULL, 'AK54', 'tool_dwg_no_T20', 'T20 Tooling DWG No',                          134),
(NULL, 'M55',  'maker_T16',       'T16 Maker',                                   135),
(NULL, 'S55',  'maker_T17',       'T17 Maker',                                   136),
(NULL, 'Y55',  'maker_T18',       'T18 Maker',                                   137),
(NULL, 'AE55', 'maker_T19',       'T19 Maker',                                   138),
(NULL, 'AK55', 'maker_T20',       'T20 Maker',                                   139),

-- ---- GRINDING LAYOUT IMAGE (AO26:AU45 merged area) ----
(NULL, 'AO26', 'grinding_layout_image', 'Grinding process diagram — from sds_v2_grinding_image', 150)

ON CONFLICT (machine_type_name, cell_address) DO NOTHING;

-- =======================================================================
-- NOTE: sds_machine_type_code seed data
-- Run the Node.js seed script: seed_machine_type_code.js
-- (446 rows from machine_type_code.xlsx — too large for inline SQL)
-- =======================================================================
