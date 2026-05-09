-- Migration: Add missing KS-03A formula rows for full DB-driven calculation
-- Run after existing KS-03A rows are in place (CPX SHOE A/C/D, ROLLER SHOE A/B/C,
-- CHUTE COVER A/E, FRONT PLATE A/B/C, SETTING GAUGE B, MASTER RING A/B,
-- PLUG GAUGE A, LOADER A_target/A_min/A_max/B/F, PRESSURE ROTOR A)

-- ROLLER SHOE.D
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-03A', 'ROLLER SHOE', 'D', 'round(odAft_max + 1.0, 1)', 'expression', 'round', 1, 'D = OD_max + 1.0'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-03A' AND tooling_name = 'ROLLER SHOE' AND parameter_name = 'D');

-- CHUTE COVER.B
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-03A', 'CHUTE COVER', 'B', 'round(wAft_max + 0.15, 1)', 'expression', 'round', 1, 'B = W_max + 0.15'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-03A' AND tooling_name = 'CHUTE COVER' AND parameter_name = 'B');

-- CHUTE COVER.C
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-03A', 'CHUTE COVER', 'C',
  'wAft_max <= 8.35 ? 13 : wAft_max <= 13.35 ? 18 : wAft_max <= 19.35 ? 24 : wAft_max <= 25.35 ? 30 : 36',
  'expression', NULL, 0, 'C = W_max breakpoints 8.35/13.35/19.35/25.35'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-03A' AND tooling_name = 'CHUTE COVER' AND parameter_name = 'C');

-- CHUTE COVER.D
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-03A', 'CHUTE COVER', 'D', 'round(wAft_max - 1)', 'expression', 'round', 0, 'D = round(W_max - 1)'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-03A' AND tooling_name = 'CHUTE COVER' AND parameter_name = 'D');

-- CHUTE COVER.F  (self-contained: floor(C - B - 1))
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-03A', 'CHUTE COVER', 'F',
  'floor((wAft_max <= 8.35 ? 13 : wAft_max <= 13.35 ? 18 : wAft_max <= 19.35 ? 24 : wAft_max <= 25.35 ? 30 : 36) - round(wAft_max + 0.15, 1) - 1)',
  'expression', 'floor', 0, 'F = floor(C - B - 1)'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-03A' AND tooling_name = 'CHUTE COVER' AND parameter_name = 'F');

-- CHUTE COVER.G (raw value; adapter caps at 55.8 and nulls when E < 1.5)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-03A', 'CHUTE COVER', 'G',
  'round(odAft_max < 19.05 ? (20.88 - 1.1 * odAft_max) + 42 : (34.88 - 1.1 * odAft_max) + 52, 1)',
  'expression', 'round', 1, 'G = E+42 (T1) or E+52 (T2); adapter caps 55.8, null if E<1.5'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-03A' AND tooling_name = 'CHUTE COVER' AND parameter_name = 'G');

-- CHUTE COVER.H (adapter nulls when E < 1.5)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-03A', 'CHUTE COVER', 'H',
  'round(odAft_max < 19.05 ? (20.88 - 1.1 * odAft_max) + 226.6 : (34.88 - 1.1 * odAft_max) + 212.6, 1)',
  'expression', 'round', 1, 'H = E+226.6 (T1) or E+212.6 (T2); adapter nulls if E<1.5'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-03A' AND tooling_name = 'CHUTE COVER' AND parameter_name = 'H');

-- FRONT PLATE.D
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-03A', 'FRONT PLATE', 'D',
  'SD < 10.5 ? 11 : SD < 17.5 ? 18 : SD < 21.5 ? 22 : 32',
  'expression', NULL, 0, 'D = SD breakpoints 10.5/17.5/21.5'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-03A' AND tooling_name = 'FRONT PLATE' AND parameter_name = 'D');

-- FRONT PLATE.E
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-03A', 'FRONT PLATE', 'E', 'SD < 17.5 ? 1.6 : 2.6', 'expression', NULL, 1, 'E = SD<17.5 → 1.6 else 2.6'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-03A' AND tooling_name = 'FRONT PLATE' AND parameter_name = 'E');

-- FRONT PLATE.F
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-03A', 'FRONT PLATE', 'F',
  'SD < 10.5 ? 7.94 : SD < 17.5 ? 14.3 : SD < 21.5 ? 19.05 : 28.55',
  'expression', NULL, 2, 'F = SD breakpoints 10.5/17.5/21.5'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-03A' AND tooling_name = 'FRONT PLATE' AND parameter_name = 'F');

-- FRONT PLATE.G  (cpx_D + OD_max/2 - 1; cpx_D = odAft*0.1+15.88)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-03A', 'FRONT PLATE', 'G',
  'round(odAft * 0.1 + 15.88 + odAft_max / 2 - 1, 3)',
  'expression', NULL, 3, 'G = cpx_D + OD_max/2 - 1'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-03A' AND tooling_name = 'FRONT PLATE' AND parameter_name = 'G');

-- FRONT PLATE.H  (12.7 + chute_A - 9 = 3.7 + round(OD_max+0.2,1))
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-03A', 'FRONT PLATE', 'H',
  'round(3.7 + round(odAft_max + 0.2, 1), 3)',
  'expression', NULL, 3, 'H = 12.7 + chute_A - 9'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-03A' AND tooling_name = 'FRONT PLATE' AND parameter_name = 'H');

-- FRONT PLATE.J  (fp_H + 9 = 12.7 + round(OD_max+0.2,1))
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-03A', 'FRONT PLATE', 'J',
  'round(12.7 + round(odAft_max + 0.2, 1), 3)',
  'expression', NULL, 3, 'J = fp_H + 9'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-03A' AND tooling_name = 'FRONT PLATE' AND parameter_name = 'J');

-- SETTING GAUGE.A  (= fp_A = idAft_min + 0.15)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-03A', 'SETTING GAUGE', 'A', 'round(idAft_min + 0.15, 3)', 'expression', NULL, 3, 'A = ID_min + 0.15 (= fp_A)'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-03A' AND tooling_name = 'SETTING GAUGE' AND parameter_name = 'A');

-- SETTING GAUGE.C  (TYPE1→14, TYPE2→20, TYPE3→22)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-03A', 'SETTING GAUGE', 'C',
  '(idAft_min + 0.15) < 10 ? 14 : (idAft_min + 0.15) < 19 ? 20 : 22',
  'expression', NULL, 0, 'C = TYPE1→14, TYPE2→20, TYPE3→22'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-03A' AND tooling_name = 'SETTING GAUGE' AND parameter_name = 'C');

-- SETTING GAUGE.D  (TYPE1→12, else→16)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-03A', 'SETTING GAUGE', 'D',
  '(idAft_min + 0.15) < 10 ? 12 : 16',
  'expression', NULL, 0, 'D = TYPE1→12, else 16'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-03A' AND tooling_name = 'SETTING GAUGE' AND parameter_name = 'D');

-- MASTER RING.C  (= W_nom = wAft)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-03A', 'MASTER RING', 'C', 'round(wAft, 2)', 'expression', NULL, 2, 'C = W nominal'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-03A' AND tooling_name = 'MASTER RING' AND parameter_name = 'C');

-- PLUG GAUGE.B  (tight tol: idAft_min+0.005; else: Tc-0.001 — both relative to idAft)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-03A', 'PLUG GAUGE', 'B',
  '(idAft_max - idAft_min) <= 0.012 ? round(idAft_min + 0.005 - idAft, 3) : round((idAft_max + idAft_min) / 2 - 0.001 - idAft, 3)',
  'expression', NULL, 3, 'B: tight tol → min+0.005, else Tc-0.001 (delta from idAft)'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-03A' AND tooling_name = 'PLUG GAUGE' AND parameter_name = 'B');

-- PLUG GAUGE.C
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-03A', 'PLUG GAUGE', 'C',
  '(idAft_max - idAft_min) <= 0.012 ? round(idAft_min + 0.03 - idAft, 3) : round((idAft_max + idAft_min) / 2 - 0.003 - idAft, 3)',
  'expression', NULL, 3, 'C: tight tol → min+0.03, else Tc-0.003 (delta from idAft)'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-03A' AND tooling_name = 'PLUG GAUGE' AND parameter_name = 'C');

-- PLUG GAUGE.D  (null/0 when TYPE1, else idAft - 4)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-03A', 'PLUG GAUGE', 'D',
  '(idAft_min + 0.15) < 10 ? 0 : round(idAft - 4, 3)',
  'expression', NULL, 3, 'D = 0 if TYPE1 (fp_A<10), else idAft-4'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-03A' AND tooling_name = 'PLUG GAUGE' AND parameter_name = 'D');

-- PLUG GAUGE.E  (null/0 when TYPE1, else idAft - 2)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-03A', 'PLUG GAUGE', 'E',
  '(idAft_min + 0.15) < 10 ? 0 : round(idAft - 2, 3)',
  'expression', NULL, 3, 'E = 0 if TYPE1, else idAft-2'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-03A' AND tooling_name = 'PLUG GAUGE' AND parameter_name = 'E');

-- PLUG GAUGE.F  (TYPE1→14, TYPE2→20, TYPE3→22)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-03A', 'PLUG GAUGE', 'F',
  '(idAft_min + 0.15) < 10 ? 14 : (idAft_min + 0.15) < 19 ? 20 : 22',
  'expression', NULL, 0, 'F = TYPE1→14, TYPE2→20, TYPE3→22'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-03A' AND tooling_name = 'PLUG GAUGE' AND parameter_name = 'F');

-- LOADER.C
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-03A', 'LOADER', 'C', 'floor(odAft / 2 + 0.5, 2)', 'expression', 'floor', 2, 'C = floor(OD/2 + 0.5, 2)'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-03A' AND tooling_name = 'LOADER' AND parameter_name = 'C');

-- LOADER.D
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-03A', 'LOADER', 'D',
  'odAft <= 12.7 ? 12.7 : odAft <= 15.9 ? 15.9 : odAft <= 19.1 ? 19.1 : odAft <= 23.8 ? 23.8 : 28.0',
  'expression', NULL, 1, 'D = OD lookup for ring size'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-03A' AND tooling_name = 'LOADER' AND parameter_name = 'D');

-- LOADER.E
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-03A', 'LOADER', 'E', 'odAft <= 15 ? 25 : 30', 'expression', NULL, 0, 'E = OD<=15 → 25, else 30'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-03A' AND tooling_name = 'LOADER' AND parameter_name = 'E');
