-- Migration: Create mtc_machine_config table
-- Phase 1: DB-driven machine eligibility conditions (replaces hardcoded computeOkFlags)
-- Phase 2: use_dynamic_rules flag enables migration from legacy SQL to mtc_selection_rules

CREATE TABLE IF NOT EXISTS mtc_machine_config (
  id                 SERIAL       PRIMARY KEY,
  machine_key        VARCHAR(50)  UNIQUE NOT NULL,
  machine_name       VARCHAR(100) NOT NULL,
  display_name       VARCHAR(100),
  ok_flag_key        VARCHAR(100),
  conditions         JSONB        NOT NULL DEFAULT '[]',
  use_dynamic_rules  BOOLEAN      NOT NULL DEFAULT false,
  is_active          BOOLEAN      NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE mtc_machine_config IS
  'Per-machine eligibility rules for tooling selection. conditions[] is evaluated against calc and partData at search time.';
COMMENT ON COLUMN mtc_machine_config.machine_key IS
  'Normalized key used in code flags (ksb22g → ksb22gOK). Must match okFlags key prefix.';
COMMENT ON COLUMN mtc_machine_config.ok_flag_key IS
  'Explicit okFlags key override, e.g. "ksb22gOK". Defaults to machine_key + "OK" if null.';
COMMENT ON COLUMN mtc_machine_config.conditions IS
  'Array of {key, source, op, value, label}. source: "calc" | "partData". op: <=|>=|<|>|=.';
COMMENT ON COLUMN mtc_machine_config.use_dynamic_rules IS
  'When true, fetchToolingRows skips legacy SQL for this machine; mtc_selection_rules engine handles it instead.';

-- Seed: Current hardcoded conditions from machineQueryService.computeOkFlags
INSERT INTO mtc_machine_config (machine_key, machine_name, display_name, ok_flag_key, conditions) VALUES

('ksb22g', 'KS-B22G', 'KS-B22G', 'ksb22gOK', '[
  {"key": "jawA",  "source": "calc",     "op": "<=", "value": 38,  "label": "Jaw A (max 38)"},
  {"key": "idAft", "source": "partData", "op": ">=", "value": 4.8, "label": "ID After (min 4.8)"},
  {"key": "idAft", "source": "partData", "op": "<",  "value": 16,  "label": "ID After (max 16)"},
  {"key": "wAft",  "source": "partData", "op": ">=", "value": 14,  "label": "Width After (min 14)"}
]'),

('ksb80', 'KS-B80', 'KS-B80', 'ksb80OK', '[
  {"key": "jawA",  "source": "calc",     "op": ">",  "value": 15,  "label": "Jaw A (min 15)"},
  {"key": "jawA",  "source": "calc",     "op": "<=", "value": 70,  "label": "Jaw A (max 70)"},
  {"key": "idAft", "source": "partData", "op": ">=", "value": 7.9, "label": "ID After (min 7.9)"},
  {"key": "wAft",  "source": "partData", "op": ">=", "value": 14,  "label": "Width After (min 14)"}
]'),

('ks03a', 'KS-03A', 'KS-03A', 'ks03aOK', '[
  {"key": "odAft", "source": "partData", "op": "<=", "value": 33, "label": "OD After (max 33)"}
]'),

('ks400b',  'KS400B',   'KS-400B',  'ks400bOK',  '[]'),
('ks500rd', 'KS500RD',  'KS-500RD', 'ks500rdOK', '[]'),
('ks400b5', 'KS-400B5', 'KS-400B5', 'ks400b5OK', '[]'),
('ks400b6', 'KS400B6',  'KS-400B6', 'ks400b6OK', '[]')

ON CONFLICT (machine_key) DO NOTHING;
