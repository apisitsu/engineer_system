-- ย้ายสูตรเครื่อง KS03A ลงตาราง mtc_formulas
DELETE FROM mtc_formulas WHERE machine_name = 'KS03A';

INSERT INTO mtc_formulas (machine_name, tool_category, param_key, formula, description) VALUES
('KS03A', 'CPX SHOE', 'cpx_A', 'round(wAft + 0.14, 3)', 'Dimension A'),
('KS03A', 'CPX SHOE', 'cpx_C', 'round(wAft - 0.5, 3)', 'Dimension C'),
('KS03A', 'CPX SHOE', 'cpx_D', 'round((odAft * 0.1) + 15.88, 3)', 'Dimension D'),
('KS03A', 'ROLLER SHOE', 'rs_A', 'ceil((15.88 + (0.1 * (odAft + odAftTolPlus))) * 100) / 100', 'Dimension A'),
('KS03A', 'ROLLER SHOE', 'rs_C', 'round(wAft + wAftTolPlus + 0.2, 2)', 'Dimension C'),
('KS03A', 'CHUTE', 'chute_A', 'round((odAft + odAftTolPlus + 0.2) * 10) / 10', 'Dimension A'),
('KS03A', 'CHUTE', 'chute_B', 'round((wAft + wAftTolPlus + 0.15) * 10) / 10', 'Dimension B'),
('KS03A', 'FRONT PLATE', 'fp_A', 'round((idAft - idTolMinus) + 0.15, 3)', 'Dimension A'),
('KS03A', 'MASTER RING', 'mr_A', 'odAft + odAftTolPlus', 'Dimension A'),
('KS03A', 'PLUG GAUGE', 'pg_A', 'idAft', 'Dimension A'),
('KS03A', 'LOADER', 'ld_A_target', 'round(wAft - 1, 1)', 'Target Dimension A');
