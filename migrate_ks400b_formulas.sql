-- Migrate KS400B formulas to mtc_formulas table
-- tool_category = NULL → flat key in FormulaService output
-- param_key matches exact key in calculateKS400B_Params() return object
-- Context vars: odBf, wAft, idAft, sdCalc (pre-computed), odBfTolPlus, odBfTolMinus

DELETE FROM mtc_formulas WHERE machine_name = 'KS400B';

INSERT INTO mtc_formulas (machine_name, tool_category, param_key, formula, description) VALUES

-- WORK DRIVER (wd_*)
('KS400B', NULL, 'wd_A',    'ceil((sdCalc - 0.5) * 2) / 2',                         'Work Driver A'),
('KS400B', NULL, 'wd_B',    'floor((idAft - 0.8) * 2) / 2',                         'Work Driver B'),
('KS400B', NULL, 'wd_C',    'wd_A < 13 ? 32 : 36',                                  'Work Driver C'),
('KS400B', NULL, 'wd_D',    'sdCalc < 13.5 ? 24 : 30',                              'Work Driver D'),
('KS400B', NULL, 'wd_E',    '23',                                                     'Work Driver E'),
('KS400B', NULL, 'wd_F',    '8',                                                      'Work Driver F'),
('KS400B', NULL, 'wd_type', 'sdCalc < 19.5 ? "TYPE1" : "TYPE2"',                    'Work Driver Type'),

-- SUPPORT BLOCK (sb_*)
('KS400B', NULL, 'sb_A',    'round(20 + (odBf / 3), 2)',                             'Support Block A'),
('KS400B', NULL, 'sb_B',    'round(wAft + 0.3, 2)',                                  'Support Block B'),
('KS400B', NULL, 'sb_C',    'round(odBf * 5 / 6, 2)',                                'Support Block C'),
('KS400B', NULL, 'sb_D',    'round(30 - (odBf / 2), 2)',                             'Support Block D'),
('KS400B', NULL, 'sb_E',    'round(30 + (odBf / 4), 2)',                             'Support Block E'),
('KS400B', NULL, 'sb_hasR', 'odBf >= 30',                                            'Support Block has R'),

-- LOADING CHUTE (lc_*) — lc_E must precede lc_A
('KS400B', NULL, 'lc_E',    'floor(odBf / 6)',                                        'Loading Chute E'),
('KS400B', NULL, 'lc_A',    'ceil(197 - (odBf / 2) + lc_E)',                         'Loading Chute A'),
('KS400B', NULL, 'lc_B',    'ceil(wAft + 6)',                                         'Loading Chute B'),
('KS400B', NULL, 'lc_C',    'round(wAft + 0.2, 2)',                                   'Loading Chute C'),
('KS400B', NULL, 'lc_D',    'ceil(odBf + 0.2, 1)',                                    'Loading Chute D'),
('KS400B', NULL, 'lc_F',    'lc_C',                                                   'Loading Chute F (= C)'),

-- PLUG A (pa_*) — pa_A must precede pa_E; pa_type must precede pb_type
('KS400B', NULL, 'pa_A',    'idAft < 20 ? round(idAft * 0.7, 2) : round(idAft - 4.0, 2)',  'Plug A, dim A'),
('KS400B', NULL, 'pa_B',    'round(sdCalc - 0.5, 2)',                                 'Plug A, dim B'),
('KS400B', NULL, 'pa_C',    'wAft <= 5 ? 7 : round(wAft * 0.9, 2)',                  'Plug A, dim C'),
('KS400B', NULL, 'pa_D',    'idAft < 4 ? 0.5 : 1.0',                                 'Plug A, dim D'),
('KS400B', NULL, 'pa_type', 'sdCalc <= 8.5 ? "TYPE1" : (idAft <= 11.4 ? "TYPE2" : "TYPE3")',  'Plug A Type'),
('KS400B', NULL, 'pa_E',    'sdCalc <= 8.5 ? round(pa_A / 2, 2) : (idAft <= 11.4 ? 4 : round(pa_A / 2, 2))',  'Plug A, dim E'),
('KS400B', NULL, 'pa_F',    '48',                                                     'Plug A, dim F'),

-- PLUG B (pb_*) — references pa_* from context
('KS400B', NULL, 'pb_A',    'idAft < 20 ? round(idAft - 0.7, 2) : round(idAft - 1.0, 2)',  'Plug B, dim A'),
('KS400B', NULL, 'pb_B',    'pa_B',                                                   'Plug B, dim B'),
('KS400B', NULL, 'pb_C',    'pa_C',                                                   'Plug B, dim C'),
('KS400B', NULL, 'pb_D',    'pa_D',                                                   'Plug B, dim D'),
('KS400B', NULL, 'pb_E',    'pa_E',                                                   'Plug B, dim E'),
('KS400B', NULL, 'pb_F',    '70',                                                     'Plug B, dim F'),
('KS400B', NULL, 'pb_type', 'pa_type',                                                'Plug B Type'),

-- Limit reference keys (used in searchFunctions guard checks)
('KS400B', NULL, 'od_turning', 'odBf',                                               'OD turning reference'),
('KS400B', NULL, 'w_aft',      'wAft',                                               'W aft reference');
