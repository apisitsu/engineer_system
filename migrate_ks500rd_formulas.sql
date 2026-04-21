-- Migrate KS500RD formulas to mtc_formulas table
-- tool_category = code key (lp / wd / fs); param_key uses abbreviated prefix
-- Adapter (adaptDynamicKS500RD) maps: lp.lp_A → lp.A, wd.wd_A → wd.A, fs.fs_No → fs.No
-- Context vars: idAft, wAft, odAft, sdCalc

DELETE FROM mtc_formulas WHERE machine_name = 'KS500RD';

INSERT INTO mtc_formulas (machine_name, tool_category, param_key, formula, description) VALUES

-- LOADING PINTLE (lp)
('KS500RD', 'lp', 'lp_A', 'floor((idAft - 1.0) * 10) / 10',                                                      'LP dim A'),
('KS500RD', 'lp', 'lp_B', 'floor((idAft + 3.0) * 10) / 10',                                                      'LP dim B'),
('KS500RD', 'lp', 'lp_C', 'wAft <= 20 ? round(wAft * 0.6, 1) : 12',                                              'LP dim C'),
('KS500RD', 'lp', 'lp_D', 'idAft > 14.0 ? (idAft > 14.5 ? (idAft > 24.5 ? 17.5 : 9.5) : 9.0) : 0',             'LP dim D'),
('KS500RD', 'lp', 'lp_E', 'idAft < 24.5 ? 5.5 : 11',                                                             'LP dim E'),
('KS500RD', 'lp', 'lp_F', 'floor((idAft - 4.5) * 10) / 10',                                                      'LP dim F'),
('KS500RD', 'lp', 'lp_G', 'idAft < 24.5 ? 9 : 20',                                                               'LP dim G'),
('KS500RD', 'lp', 'lp_H', 'round((idAft - 0.8) * 10) / 10',                                                      'LP dim H'),

-- WORK DRIVER (wd) — wd_A must precede wd_B
('KS500RD', 'wd', 'wd_A', 'round(sdCalc - 0.2, 2)',                                                               'WD dim A'),
('KS500RD', 'wd', 'wd_B', 'round(wd_A - 7.0, 2)',                                                                 'WD dim B'),

-- FRONT SHOE (fs) — part number lookup by W range
('KS500RD', 'fs', 'fs_No',
  'wAft >= 46 ? "4033-03-0006" : (wAft >= 37 ? "4033-03-0005" : (wAft >= 28 ? "4033-03-0004" : (wAft >= 21 ? "4033-03-0003" : (wAft >= 19 ? "4033-03-0002" : "4033-03-0001"))))',
  'Front Shoe part number');
