-- SDS V2: Template cell config + Tooling images + Grinding images
-- Run against: eng_system (engPool)
-- Date: 2026-04-18

-- ============================================================
-- 1. SDS V2 Template Fixed-Cell Configuration
--    One row per cell mapping. Editable when template changes.
--    data_source uses dot-notation from /api/sds/v2/search response
--    e.g. 'cn', 'parts_no', 'dimension.od', 'production.model'
-- ============================================================
CREATE TABLE IF NOT EXISTS sds_v2_template_config (
  id            SERIAL       PRIMARY KEY,
  param_key     VARCHAR(100) NOT NULL UNIQUE,
  cell_address  VARCHAR(10)  NOT NULL,
  sheet_name    VARCHAR(100) NOT NULL DEFAULT 'Sheet1',
  label         VARCHAR(200),
  data_source   VARCHAR(300) NOT NULL,
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  sort_order    INT          NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  sds_v2_template_config              IS 'Fixed-cell mapping for the single SDS V2 Excel template';
COMMENT ON COLUMN sds_v2_template_config.param_key    IS 'Unique identifier for this cell slot, e.g. cn, parts_no, od';
COMMENT ON COLUMN sds_v2_template_config.cell_address IS 'Excel cell address, e.g. B3, D12';
COMMENT ON COLUMN sds_v2_template_config.data_source  IS 'Dot-notation path into /api/sds/v2/search JSON, e.g. dimension.od';

-- ============================================================
-- 2. Tooling Images
--    One image per tool_dwg_no (UNIQUE constraint).
--    image_data stores the raw bytes; serve as base64 or via
--    GET /api/sds/v2/tooling-image/:tool_dwg_no
-- ============================================================
CREATE TABLE IF NOT EXISTS sds_v2_tooling_image (
  id           SERIAL        PRIMARY KEY,
  tool_dwg_no  VARCHAR(100)  NOT NULL UNIQUE,
  image_data   BYTEA         NOT NULL,
  mime_type    VARCHAR(50)   NOT NULL DEFAULT 'image/jpeg',
  file_name    VARCHAR(255),
  description  TEXT,
  created_by   VARCHAR(100),
  updated_by   VARCHAR(100),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  sds_v2_tooling_image             IS 'Tooling drawing images keyed by tool_dwg_no from lpb.eng_r_pi_tool';
COMMENT ON COLUMN sds_v2_tooling_image.tool_dwg_no IS 'Matches tool_dwg_no in lpb.eng_r_pi_tool and lpb.eng_tooling';

CREATE INDEX IF NOT EXISTS idx_tooling_image_dwg_no
  ON sds_v2_tooling_image(tool_dwg_no);

-- ============================================================
-- 3. Grinding Process Images
--    Keyed by the first 2 characters of the CN string.
--    CN prefix → part type mapping (from PART_TYPE_MAP):
--      C1 → BODY   (C11–C19)
--      C2 → RACE   (C21–C29)
--      C3 → BALL   (C31–C39)
--      C5 → BODY   (C51–C59)
--      C6 → SLEEVE (C61–C69)
--      A4 → SPHERICAL (A41–A49)
--    Optional process_code allows per-process-type illustrations
--    (e.g. BALL + IDG = different diagram than BALL + FG).
--    When process_code IS NULL the image is the default for that part type.
-- ============================================================
CREATE TABLE IF NOT EXISTS sds_v2_grinding_image (
  id            SERIAL        PRIMARY KEY,
  cn_prefix     VARCHAR(3)    NOT NULL,
  process_code  VARCHAR(20),
  label         VARCHAR(200)  NOT NULL,
  image_data    BYTEA         NOT NULL,
  mime_type     VARCHAR(50)   NOT NULL DEFAULT 'image/jpeg',
  file_name     VARCHAR(255),
  description   TEXT,
  created_by    VARCHAR(100),
  updated_by    VARCHAR(100),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  sds_v2_grinding_image              IS 'Grinding process illustration images keyed by CN prefix (first 2 chars)';
COMMENT ON COLUMN sds_v2_grinding_image.cn_prefix    IS 'First 2 chars of CN: C1/C5=BODY, C2=RACE, C3=BALL, C6=SLEEVE, A4=SPHERICAL';
COMMENT ON COLUMN sds_v2_grinding_image.process_code IS 'Optional: restrict image to a specific process code; NULL = default for part type';

CREATE INDEX IF NOT EXISTS idx_grinding_image_cn_prefix
  ON sds_v2_grinding_image(cn_prefix);

-- Prevent duplicate (cn_prefix + process_code) combinations
CREATE UNIQUE INDEX IF NOT EXISTS idx_grinding_image_cn_process
  ON sds_v2_grinding_image(cn_prefix, COALESCE(process_code, ''));

-- ============================================================
-- Seed: default template cell mapping (adjust cell addresses
--       once you have the actual template in hand)
-- ============================================================
INSERT INTO sds_v2_template_config (param_key, cell_address, label, data_source, sort_order)
VALUES
  ('cn',              'B3',  'Control No',        'cn',                          1),
  ('item_no',         'D3',  'Item No',           'item_no',                     2),
  ('parts_no',        'B4',  'Parts No',          'parts_no',                    3),
  ('part_type',       'D4',  'Part Type',         'part_type',                   4),
  ('dwg_rev',         'F3',  'DWG Rev',           'dwg_rev',                     5),
  ('model',           'B5',  'Model',             'production.model',            6),
  ('customer',        'D5',  'Customer',          'production.customer',         7),
  ('cust_dwg_no',     'B6',  'Cust DWG No',       'production.cust_dwg_no',      8),
  ('material',        'B7',  'Material',          'material.material',           9),
  ('procument_spec',  'D7',  'Material Spec',     'material.procument_spec',    10),
  ('od',              'B9',  'OD',                'dimension.od',               11),
  ('id',              'D9',  'ID',                'dimension.id',               12),
  ('width',           'F9',  'Width',             'dimension.width',            13)
ON CONFLICT (param_key) DO NOTHING;
