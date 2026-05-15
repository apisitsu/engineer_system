-- Migration: Add missing KS-400B5 formula rows for full DB-driven calculation
-- Existing rows cover: WORK CLAMP (A,B), SHAFT (A,C), WORK CHUTE (A,B),
-- WORK LOADER (A,D), WORK CHUCK (A), WORK HOLDER (A,B), CHUCK JAW (A),
-- CHUTE GUIDE (A,B), STOPPER (A,B), MASTER RING (A,B)

-- WORK CLAMP.C  (= B + 9 = round(58 - wAft))
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-400B5', 'WORK CLAMP', 'C', 'round(58 - wAft)', 'expression', 'round', 0, 'C = B + 9'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-400B5' AND tooling_name = 'WORK CLAMP' AND parameter_name = 'C');

-- WORK CLAMP.D  (constant 14)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-400B5', 'WORK CLAMP', 'D', '14', 'expression', NULL, 0, 'D = constant 14'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-400B5' AND tooling_name = 'WORK CLAMP' AND parameter_name = 'D');

-- WORK CLAMP.E  (constant 5)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-400B5', 'WORK CLAMP', 'E', '5', 'expression', NULL, 0, 'E = constant 5'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-400B5' AND tooling_name = 'WORK CLAMP' AND parameter_name = 'E');

-- SHAFT.B  (W <= 12 → 8, else 10)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-400B5', 'SHAFT', 'B', 'wAft <= 12 ? 8 : 10', 'expression', NULL, 0, 'B = W<=12 → 8, else 10'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-400B5' AND tooling_name = 'SHAFT' AND parameter_name = 'B');

-- WORK CHUTE.C
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-400B5', 'WORK CHUTE', 'C', 'round(odBf_max / 2 + 27.55, 3)', 'expression', NULL, 3, 'C = OD_bf_max/2 + 27.55'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-400B5' AND tooling_name = 'WORK CHUTE' AND parameter_name = 'C');

-- WORK CHUTE.D
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-400B5', 'WORK CHUTE', 'D', 'wAft <= 20 ? 30 : 37', 'expression', NULL, 0, 'D = W<=20 → 30, else 37'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-400B5' AND tooling_name = 'WORK CHUTE' AND parameter_name = 'D');

-- WORK LOADER.B
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-400B5', 'WORK LOADER', 'B', 'round(odBf / 2 + 10, 1)', 'expression', NULL, 1, 'B = OD_bf/2 + 10'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-400B5' AND tooling_name = 'WORK LOADER' AND parameter_name = 'B');

-- WORK LOADER.C
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-400B5', 'WORK LOADER', 'C', 'round(odBf / 2 + 27.5, 1)', 'expression', NULL, 1, 'C = OD_bf/2 + 27.5'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-400B5' AND tooling_name = 'WORK LOADER' AND parameter_name = 'C');

-- WORK LOADER.E  (geometry: sqrt(max(0, odBf^2 - sd^2)))
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-400B5', 'WORK LOADER', 'E',
  'round(max(1, ((wBf > 0 ? wBf : wAft) - sqrt(max(0, odBf * odBf - sd * sd))) / 2 - 1), 1)',
  'expression', NULL, 1, 'E = geometry; max(1, (W-chord)/2-1)'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-400B5' AND tooling_name = 'WORK LOADER' AND parameter_name = 'E');

-- WORK LOADER.F
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-400B5', 'WORK LOADER', 'F', 'floor(sd + 0.5, 1)', 'expression', 'floor', 1, 'F = floor(SD + 0.5, 1)'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-400B5' AND tooling_name = 'WORK LOADER' AND parameter_name = 'F');

-- WORK LOADER.G
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-400B5', 'WORK LOADER', 'G', 'round(81.5 + round(odBf / 2 + 10, 1), 1)', 'expression', NULL, 1, 'G = 81.5 + B'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-400B5' AND tooling_name = 'WORK LOADER' AND parameter_name = 'G');

-- CHUCK JAW.B  (A - 0.8 = round(idAft_max + 0.5, 2) - 0.8 = round(idAft_max - 0.3, 2))
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-400B5', 'CHUCK JAW', 'B', 'round(idAft_max - 0.3, 2)', 'expression', NULL, 2, 'B = A - 0.8'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-400B5' AND tooling_name = 'CHUCK JAW' AND parameter_name = 'B');

-- CHUCK JAW.C
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-400B5', 'CHUCK JAW', 'C', 'ceil(36 + wAft * 0.67, 1)', 'expression', 'ceil', 1, 'C = ceil(36 + W*0.67, 1)'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-400B5' AND tooling_name = 'CHUCK JAW' AND parameter_name = 'C');

-- CHUCK JAW.D  (cj_Z - 0.03 = idAft_min - 0.03)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-400B5', 'CHUCK JAW', 'D', 'round(idAft_min - 0.03, 2)', 'expression', NULL, 2, 'D = ID_min - 0.03'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-400B5' AND tooling_name = 'CHUCK JAW' AND parameter_name = 'D');

-- CHUTE GUIDE.C  (= shaft_C = round(idBf_min - 0.5, 1))
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-400B5', 'CHUTE GUIDE', 'C', 'round(idBf_min - 0.5, 1)', 'expression', NULL, 1, 'C = shaft_C = IDbf_min - 0.5'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-400B5' AND tooling_name = 'CHUTE GUIDE' AND parameter_name = 'C');

-- CHUTE GUIDE.D  (= shaft_A = round(sd - 0.5, 1))
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-400B5', 'CHUTE GUIDE', 'D', 'round(sd - 0.5, 1)', 'expression', NULL, 1, 'D = shaft_A = SD - 0.5'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-400B5' AND tooling_name = 'CHUTE GUIDE' AND parameter_name = 'D');

-- CHUTE GUIDE.E  (shaft_A/2 + shaft_C/2 + 3)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-400B5', 'CHUTE GUIDE', 'E',
  'round(round(sd - 0.5, 1) / 2 + round(idBf_min - 0.5, 1) / 2 + 3)',
  'expression', 'round', 0, 'E = shaft_A/2 + shaft_C/2 + 3'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-400B5' AND tooling_name = 'CHUTE GUIDE' AND parameter_name = 'E');

-- MASTER RING.C  (= wBf or wAft)
INSERT INTO tooling_formula (machine_name, tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision, remark)
SELECT 'KS-400B5', 'MASTER RING', 'C', 'round(wBf > 0 ? wBf : wAft, 2)', 'expression', NULL, 2, 'C = W_bf or W_aft'
WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_name = 'KS-400B5' AND tooling_name = 'MASTER RING' AND parameter_name = 'C');
