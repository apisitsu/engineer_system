-- Migration: Add missing KS400B6 formula rows for full DB-driven calculation
-- Existing rows cover: WORK DRIVER (A,B,C), LOADING CHUTE (A,C,D), PLUG (A,B),
-- WORK GUIDE (A,C), WORK PUSHER (A,B,C), STOCKER CHUTE (A,B,C),
-- FRONT SHOE (A,B,D), REAR SHOE (A,B,C), PILOT PIN (A,B,C)

-- WORK DRIVER.D  (constant 39)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS400B6', 'WORK DRIVER', 'D', '39', 'expression', NULL, 0, 'D = constant 39'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS400B6' AND tooling_name = 'WORK DRIVER' AND parameter_name = 'D');

-- WORK DRIVER.E  (constant 45)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS400B6', 'WORK DRIVER', 'E', '45', 'expression', NULL, 0, 'E = constant 45'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS400B6' AND tooling_name = 'WORK DRIVER' AND parameter_name = 'E');

-- LOADING CHUTE.B  (W_max breakpoints 10/20/30)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS400B6', 'LOADING CHUTE', 'B',
  'wAft_max <= 10 ? 20 : wAft_max <= 20 ? 30 : wAft_max <= 30 ? 40 : 50',
  'expression', NULL, 0, 'B = W_max breakpoints 10/20/30'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS400B6' AND tooling_name = 'LOADING CHUTE' AND parameter_name = 'B');

-- PLUG.C  (SD > 8 and < 9 → 8, else SD - 0.5)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS400B6', 'PLUG', 'C',
  'SD > 8 and SD < 9 ? 8 : round(SD - 0.5, 2)',
  'expression', NULL, 2, 'C = SD range: >8&<9→8, else SD-0.5'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS400B6' AND tooling_name = 'PLUG' AND parameter_name = 'C');

-- PLUG.D  (plug_A = idBf_min - 1; plug_A <= 9 → 0.5, else 1)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS400B6', 'PLUG', 'D',
  'idBf_min <= 10 ? 0.5 : 1',
  'expression', NULL, 1, 'D = plug_A<=9 → 0.5, else 1 (plug_A = idBf_min-1)'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS400B6' AND tooling_name = 'PLUG' AND parameter_name = 'D');

-- WORK GUIDE.B  (isInner: 45-SD/2; outer: 45-SD/2-1)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS400B6', 'WORK GUIDE', 'B',
  'round(45 - SD / 2 - (isInner ? 0 : 1), 1)',
  'expression', NULL, 1, 'B = 45-SD/2 (inner) or 45-SD/2-1 (outer)'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS400B6' AND tooling_name = 'WORK GUIDE' AND parameter_name = 'B');

-- WORK GUIDE.D  (isInner: (OD_bf_max - SD)/2 + 0.2; outer: 0)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS400B6', 'WORK GUIDE', 'D',
  'isInner ? round((odBf_max - SD) / 2 + 0.2, 1) : 0',
  'expression', NULL, 1, 'D = (OD_max-SD)/2+0.2 if inner, else 0 (null)'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS400B6' AND tooling_name = 'WORK GUIDE' AND parameter_name = 'D');

-- WORK GUIDE.E  (wg_E = wg_A / 2 = round(wAft) / 2)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS400B6', 'WORK GUIDE', 'E', 'round(wAft) / 2', 'expression', NULL, 1, 'E = round(W) / 2'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS400B6' AND tooling_name = 'WORK GUIDE' AND parameter_name = 'E');

-- STOCKER CHUTE.D  (SD breakpoints: <=6→2, <=8→4, <=10→6, else→8)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS400B6', 'STOCKER CHUTE', 'D',
  'SD <= 6 ? 2 : SD <= 8 ? 4 : SD <= 10 ? 6 : 8',
  'expression', NULL, 0, 'D = SD breakpoints 6/8/10'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS400B6' AND tooling_name = 'STOCKER CHUTE' AND parameter_name = 'D');

-- STOCKER CHUTE.E  (sc_E = round(sc_B / 2, 1))
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS400B6', 'STOCKER CHUTE', 'E',
  'round(round(wAft + 0.5, 1) / 2, 1)',
  'expression', NULL, 1, 'E = sc_B / 2'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS400B6' AND tooling_name = 'STOCKER CHUTE' AND parameter_name = 'E');

-- FRONT SHOE.C  (constant 0.15)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS400B6', 'FRONT SHOE', 'C', '0.15', 'expression', NULL, 2, 'C = constant 0.15'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS400B6' AND tooling_name = 'FRONT SHOE' AND parameter_name = 'C');

-- REAR SHOE.D  (isInner: 0; outer: rs_B < 7.5 → 30, else 0 for null)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS400B6', 'REAR SHOE', 'D',
  'isInner ? 0 : (round(wAft / 2 + 2, 2) < 7.5 ? 30 : 0)',
  'expression', NULL, 0, 'D = rs_B<7.5→30; 0=null sentinel for outer; 0 if inner'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS400B6' AND tooling_name = 'REAR SHOE' AND parameter_name = 'D');

-- PILOT PIN.D  (TYPE3: 0=null sentinel; else: floor(W-1, 1))
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS400B6', 'PILOT PIN', 'D',
  'idBf_min >= 10 ? 0 : floor(wAft - 1, 1)',
  'expression', 'floor', 1, 'D = TYPE3→0(null), else floor(W-1,1)'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS400B6' AND tooling_name = 'PILOT PIN' AND parameter_name = 'D');

-- PILOT PIN.E
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS400B6', 'PILOT PIN', 'E',
  'idBf_min < 6 ? 6 : idBf_min < 10 ? 9 : floor(idBf_min - 1.5, 1)',
  'expression', NULL, 1, 'E = T1→6, T2→9, T3→pp_C'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS400B6' AND tooling_name = 'PILOT PIN' AND parameter_name = 'E');

-- PILOT PIN.F  (pp_F = round((pp_B + 5) * 10) / 10)
-- pp_B = idBf_min < 6 ? round(W+1.5,1) : idBf_min < 10 ? round(W+2.5,1) : round(W+2.0,1)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS400B6', 'PILOT PIN', 'F',
  'round((idBf_min < 6 ? round(wAft + 1.5, 1) : idBf_min < 10 ? round(wAft + 2.5, 1) : round(wAft + 2.0, 1)) + 5, 1)',
  'expression', NULL, 1, 'F = pp_B + 5'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS400B6' AND tooling_name = 'PILOT PIN' AND parameter_name = 'F');

-- PILOT PIN.G
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS400B6', 'PILOT PIN', 'G', 'wAft < 18 ? 48 : 65', 'expression', NULL, 0, 'G = W<18→48, else 65'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS400B6' AND tooling_name = 'PILOT PIN' AND parameter_name = 'G');

-- PILOT PIN.H  (constant 2.0 = pp_POD)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS400B6', 'PILOT PIN', 'H', '2.0', 'expression', NULL, 1, 'H = pp_POD constant 2.0'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS400B6' AND tooling_name = 'PILOT PIN' AND parameter_name = 'H');

-- PILOT PIN.J  (TYPE1: 4.1, else: 4.0)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS400B6', 'PILOT PIN', 'J', 'idBf_min < 6 ? 4.1 : 4.0', 'expression', NULL, 1, 'J = T1→4.1, else 4.0'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS400B6' AND tooling_name = 'PILOT PIN' AND parameter_name = 'J');

-- PILOT PIN.K  (= J + 1)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS400B6', 'PILOT PIN', 'K', 'idBf_min < 6 ? 5.1 : 5.0', 'expression', NULL, 1, 'K = J + 1'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS400B6' AND tooling_name = 'PILOT PIN' AND parameter_name = 'K');
