-- Migrate KS400B5 formulas to mtc_formulas table
-- Param_key is globally unique within machine (abbreviated prefix convention)
-- Cross-references use param_key names directly (e.g. chute_D, shaft_A)
-- Context vars: odBf, odBfTolPlus, odBfTolMinus, idBf, idBfTolPlus, idBfTolMinus,
--   wBf, wAft, odAft, sd, sdAft, sdCalc, isBallInner, isYBall

DELETE FROM mtc_formulas WHERE machine_name = 'KS400B5';

INSERT INTO mtc_formulas (machine_name, tool_category, param_key, formula, description) VALUES

-- WORK CLAMP (wc_*) — wc_B must precede wc_C
('KS400B5', 'workClamp', 'wc_A',
  'round((isBallInner ? (odAft - 0.2) : (isYBall ? (sd - 0.2) : (sdAft - 1.5))) * 10) / 10',
  'Work Clamp A'),
('KS400B5', 'workClamp', 'wc_B',
  'round(49 - wAft)',
  'Work Clamp B'),
('KS400B5', 'workClamp', 'wc_C',
  'round(wc_B + 9)',
  'Work Clamp C'),
('KS400B5', 'workClamp', 'wc_D',    '14',    'Work Clamp D'),
('KS400B5', 'workClamp', 'wc_E',    '5',     'Work Clamp E'),
('KS400B5', 'workClamp', 'wc_Type',
  '(odAft < 12.2 || sd < 12.2 || sdAft < 12.2) ? "TYPE1" : "TYPE2"',
  'Work Clamp Type'),

-- SHAFT (shaft_*) — shaft_A and shaft_C must precede wcg_D and wcg_C
('KS400B5', 'shaft', 'shaft_A',
  'round((sd - 0.5) * 10) / 10',
  'Shaft A'),
('KS400B5', 'shaft', 'shaft_B',
  'wAft <= 12 ? 8 : 10',
  'Shaft B'),
('KS400B5', 'shaft', 'shaft_C',
  'round((idBf + idBfTolMinus - 0.5) * 10) / 10',
  'Shaft C'),
('KS400B5', 'shaft', 'shaft_Type',
  'shaft_A < 14 ? "TYPE1" : "TYPE2"',
  'Shaft Type'),

-- WORK CHUTE (chute_*) — chute_D must precede wcg_A
('KS400B5', 'workChute', 'chute_A',
  'round(odBf + odBfTolPlus + 0.1, 2)',
  'Work Chute A'),
('KS400B5', 'workChute', 'chute_B',
  'round(wAft + 0.1, 2)',
  'Work Chute B'),
('KS400B5', 'workChute', 'chute_C',
  'round((odBf + odBfTolPlus) / 2 + 27.55, 3)',
  'Work Chute C'),
('KS400B5', 'workChute', 'chute_D',
  'wAft <= 20 ? 30 : 37',
  'Work Chute D'),

-- WORK LOADER (wl_*) — wl_B must precede wl_G
('KS400B5', 'workLoader', 'wl_A',
  'floor((odBf + 0.2) * 10) / 10',
  'Work Loader A'),
('KS400B5', 'workLoader', 'wl_B',
  'round((odBf / 2 + 10) * 10) / 10',
  'Work Loader B'),
('KS400B5', 'workLoader', 'wl_C',
  'round((odBf / 2 + 27.5) * 10) / 10',
  'Work Loader C'),
('KS400B5', 'workLoader', 'wl_D',
  'round((wBf != 0 ? wBf : wAft) * 100) / 100',
  'Work Loader D'),
('KS400B5', 'workLoader', 'wl_E',
  'round(max(1, ((wBf != 0 ? wBf : wAft) - sqrt(max(0, odBf^2 - sd^2))) / 2 - 1) * 10) / 10',
  'Work Loader E'),
('KS400B5', 'workLoader', 'wl_F',
  'floor((sd + 0.5) * 10) / 10',
  'Work Loader F'),
('KS400B5', 'workLoader', 'wl_G',
  'round((81.5 + wl_B) * 10) / 10',
  'Work Loader G'),

-- WORK CHUCK
('KS400B5', 'workChuck', 'chuck_A',
  'round((odBf + 1.0) * 10) / 10',
  'Work Chuck A'),

-- WORK HOLDER (wh_*) — wh_A must precede wh_B
('KS400B5', 'workHolder', 'wh_A',
  'round((sd + 2) * 10) / 10',
  'Work Holder A'),
('KS400B5', 'workHolder', 'wh_B',
  'wh_A >= 27.7 ? 24 : (wh_A >= 20.8 ? 18 : (wh_A >= 18.5 ? 16 : (wh_A >= 15 ? 13 : (wh_A >= 11.5 ? 10 : 0))))',
  'Work Holder B'),

-- CHUCK JAW (cj_*) — cj_A must precede cj_B
('KS400B5', 'chuckJaw', 'cj_A',
  'round(idAft + idTolPlus + 0.5, 2)',
  'Chuck Jaw A'),
('KS400B5', 'chuckJaw', 'cj_B',
  'round(cj_A - 0.8, 2)',
  'Chuck Jaw B'),
('KS400B5', 'chuckJaw', 'cj_C',
  'ceil((36 + (wAft * 0.67)) * 10) / 10',
  'Chuck Jaw C'),
('KS400B5', 'chuckJaw', 'cj_D',
  'round(idAft + idTolMinus - 0.03, 2)',
  'Chuck Jaw D'),

-- WORK CHUTE GUIDE (wcg_*) — refs chute_D, shaft_A, shaft_C; wcg_C and wcg_D must precede wcg_E
('KS400B5', 'workChuteGuide', 'wcg_A',
  'chute_D',
  'Work Chute Guide A'),
('KS400B5', 'workChuteGuide', 'wcg_B',
  'round((27.45 - (odBf + odBfTolPlus) / 2) * 10) / 10',
  'Work Chute Guide B'),
('KS400B5', 'workChuteGuide', 'wcg_C',
  'shaft_C',
  'Work Chute Guide C'),
('KS400B5', 'workChuteGuide', 'wcg_D',
  'shaft_A',
  'Work Chute Guide D'),
('KS400B5', 'workChuteGuide', 'wcg_E',
  'round((wcg_D / 2) + (wcg_C / 2) + 3)',
  'Work Chute Guide E'),

-- STOPPER
('KS400B5', 'stopper', 'stopper_A',
  'round(idBf + idBfTolPlus + 0.5, 2)',
  'Stopper A'),
('KS400B5', 'stopper', 'stopper_B',
  'max(0, round((sd - 0.1) * 10) / 10)',
  'Stopper B'),

-- MASTER RING FOR JAW (mrj_*)
('KS400B5', 'masterRingForJaw', 'mrj_A',
  'round(idBf + (idBfTolPlus + idBfTolMinus) / 2, 3)',
  'Master Ring A'),
('KS400B5', 'masterRingForJaw', 'mrj_B',
  'round(odBf + (odBfTolPlus + odBfTolMinus) / 2, 3)',
  'Master Ring B'),
('KS400B5', 'masterRingForJaw', 'mrj_C',
  'round((wBf != 0 ? wBf : wAft) * 100) / 100',
  'Master Ring C');
