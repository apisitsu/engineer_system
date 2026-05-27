-- Migration: Add PILOT PIN formulas & update PLUG(A)/(B) formulas for KS-400B1/B2/B7
-- Machines: id=7 (KS-400B1), id=8 (KS-400B2), id=9 (KS-400B7)
-- Sources: formula_reference.md section 8 (PILOT PIN 4931-03)
-- Note: PLUG A 4664-21 and PLUG B 4664-22 specs were verified equivalent to 4664-06/4664-07
--       for tooling search (dim_a/dim_b within ±0.5 tol); only differ in length (F dim).
--       Sections 9 & 10 removed from formula_reference.md — 4664-06/07 remain canonical.

BEGIN;

-- ════════════════════════════════════════════════════════════════
-- 1. PLUG(A) — update B and E formulas to match 4664-21 spec
-- ════════════════════════════════════════════════════════════════

-- B: SD-0.5 for TYPE1 (SD≤8) and TYPE3 (SD≥9); 8 for TYPE2 (8<SD<9)
UPDATE tooling_formula
   SET formula_expr = 'if(SD <= 8, SD - 0.5, if(SD < 9, 8, SD - 0.5))'
 WHERE machine_id IN (7,8,9)
   AND tooling_name = 'PLUG(A)'
   AND output_key   = 'B'
   AND formula_expr = 'SD - 0.5';

-- E: always A/2 (remove old TYPE2 = 4 branch)
UPDATE tooling_formula
   SET formula_expr = 'A / 2'
 WHERE machine_id IN (7,8,9)
   AND tooling_name = 'PLUG(A)'
   AND output_key   = 'E'
   AND formula_expr = 'if(SD <= 8.5, A / 2, if(idAft_min <= 11.4, 4, A / 2))';

-- ════════════════════════════════════════════════════════════════
-- 2. PLUG(B) — update A formula and remove D, E, F rows (4664-22 spec)
-- ════════════════════════════════════════════════════════════════

-- A: ID_min - 1 (simplified from piecewise old formula)
UPDATE tooling_formula
   SET formula_expr = 'idAft_min - 1'
 WHERE machine_id IN (7,8,9)
   AND tooling_name = 'PLUG(B)'
   AND output_key   = 'A'
   AND formula_expr = 'if(idAft_min < 20, idAft_min - 0.7, idAft_min - 1.0)';

-- C: W≤5 → 6 (per 4664-22 spec range 5~6); W>5 → W×0.9
UPDATE tooling_formula
   SET formula_expr = 'if(wAft_min <= 5, 6, roundN(wAft_min * 0.9, 1))'
 WHERE machine_id IN (7,8,9)
   AND tooling_name = 'PLUG(B)'
   AND output_key   = 'C'
   AND formula_expr = 'if(wAft_min <= 5, 7, roundN(wAft_min * 0.9, 1))';

-- Remove D, E, F — 4664-22 spec only defines A, B, C
DELETE FROM tooling_formula
 WHERE machine_id IN (7,8,9)
   AND tooling_name = 'PLUG(B)'
   AND output_key IN ('D','E','F');

-- ════════════════════════════════════════════════════════════════
-- 3. PILOT PIN (4931-03) — insert formula rows for all three machines
--    Input: ID = idBf_min (Before Grind, MIN),  W = wAft (After Grind, Nominal)
--    Type:  TYPE1 → ID<5, TYPE2 → 5≤ID<10, TYPE3 → 10≤ID<31
-- ════════════════════════════════════════════════════════════════

INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, condition_expr, sort_order)
VALUES
  -- machine_id = 7 (KS-400B1)
  (7, 'PILOT PIN', 'A', 'idBf_min - 1',     NULL,              10),
  (7, 'PILOT PIN', 'B', 'W + 3.5',           NULL,              20),
  (7, 'PILOT PIN', 'C', 'idBf_min - 1',      'idBf_min < 5',    30),
  (7, 'PILOT PIN', 'C', 'idBf_min - 1.5',    'idBf_min < 10',   40),
  (7, 'PILOT PIN', 'C', 'idBf_min - 2',      NULL,              50),
  (7, 'PILOT PIN', 'D', 'W',                 'idBf_min < 31',   60),
  (7, 'PILOT PIN', 'E', '6',                 'idBf_min < 5',    70),
  (7, 'PILOT PIN', 'E', '9',                 'idBf_min < 10',   80),
  (7, 'PILOT PIN', 'F', 'B + 5',             NULL,              90),

  -- machine_id = 8 (KS-400B2)
  (8, 'PILOT PIN', 'A', 'idBf_min - 1',     NULL,              10),
  (8, 'PILOT PIN', 'B', 'W + 3.5',           NULL,              20),
  (8, 'PILOT PIN', 'C', 'idBf_min - 1',      'idBf_min < 5',    30),
  (8, 'PILOT PIN', 'C', 'idBf_min - 1.5',    'idBf_min < 10',   40),
  (8, 'PILOT PIN', 'C', 'idBf_min - 2',      NULL,              50),
  (8, 'PILOT PIN', 'D', 'W',                 'idBf_min < 31',   60),
  (8, 'PILOT PIN', 'E', '6',                 'idBf_min < 5',    70),
  (8, 'PILOT PIN', 'E', '9',                 'idBf_min < 10',   80),
  (8, 'PILOT PIN', 'F', 'B + 5',             NULL,              90),

  -- machine_id = 9 (KS-400B7)
  (9, 'PILOT PIN', 'A', 'idBf_min - 1',     NULL,              10),
  (9, 'PILOT PIN', 'B', 'W + 3.5',           NULL,              20),
  (9, 'PILOT PIN', 'C', 'idBf_min - 1',      'idBf_min < 5',    30),
  (9, 'PILOT PIN', 'C', 'idBf_min - 1.5',    'idBf_min < 10',   40),
  (9, 'PILOT PIN', 'C', 'idBf_min - 2',      NULL,              50),
  (9, 'PILOT PIN', 'D', 'W',                 'idBf_min < 31',   60),
  (9, 'PILOT PIN', 'E', '6',                 'idBf_min < 5',    70),
  (9, 'PILOT PIN', 'E', '9',                 'idBf_min < 10',   80),
  (9, 'PILOT PIN', 'F', 'B + 5',             NULL,              90);

-- ════════════════════════════════════════════════════════════════
-- 4. PILOT PIN — search rules (maps to tooling_ks400b inventory)
--    dim_a ≈ pin body diameter (A = idBf_min - 1)
--    dim_b ≈ nominal length    (B = W + 3.5)
-- ════════════════════════════════════════════════════════════════

INSERT INTO tooling_search_rule (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus, sort_priority, label, inventory_tooling_filter)
VALUES
  (7, 'PILOT PIN', 'A', 'dim_a', 0.5, 0.5, 0, 'Pin Dia A', 'PILOT PIN'),
  (7, 'PILOT PIN', 'B', 'dim_b', 1.0, 1.0, 1, 'Length B',  NULL),

  (8, 'PILOT PIN', 'A', 'dim_a', 0.5, 0.5, 0, 'Pin Dia A', 'PILOT PIN'),
  (8, 'PILOT PIN', 'B', 'dim_b', 1.0, 1.0, 1, 'Length B',  NULL),

  (9, 'PILOT PIN', 'A', 'dim_a', 0.5, 0.5, 0, 'Pin Dia A', 'PILOT PIN'),
  (9, 'PILOT PIN', 'B', 'dim_b', 1.0, 1.0, 1, 'Length B',  NULL);

COMMIT;
