'use strict';

function calculateToolingParams(part) {
  const jawA = part.process === 'ID->OD' ? part.odBf : part.odAft;
  const jawB = jawA - 0.4;

  const normalBaseC = 18.5 + (part.wAft / 2) + 3;
  const specialBaseC = 18.5 + part.wAft - 2;
  let baseC;
  if ((part.type.includes('NORMAL') || part.type.includes('OTHER')) && !part.yBall.includes('Y')) {
    baseC = normalBaseC;
  } else {
    baseC = specialBaseC;
  }

  const ID_part = part.idAft + part.idTolPlus;
  const bpAA = parseFloat((ID_part + 0.3).toFixed(2));
  const bpBB = Math.ceil((bpAA + 1.0) * 10) / 10;

  const chuteCalcA = parseFloat((part.odAft + 0.2).toFixed(2));
  const chuteCalcB = parseFloat((part.wAft + 0.1).toFixed(2));
  const tempChuteC = chuteCalcB + 5;
  const chuteCalcC = Math.ceil(tempChuteC / 5) * 5;
  const chuteCalcD = parseFloat((12 + (chuteCalcA / 2)).toFixed(2));

  const carrierCalcA = parseFloat((part.odAft + 0.5).toFixed(2));
  const carrierCalcB = parseFloat((404 - carrierCalcA).toFixed(2));
  const carrierCalcC = parseFloat(((400 + carrierCalcA - carrierCalcB) / 2).toFixed(2));

  const wVal = part.wAft * 0.55;
  let maxCarrierD = null;
  if (wVal <= 2.5) maxCarrierD = 2.5;
  else if (wVal <= 3.0) maxCarrierD = 3.0;
  else if (wVal <= 4.0) maxCarrierD = 4.0;
  else if (wVal <= 4.5) maxCarrierD = 4.5;
  else if (wVal <= 5.0) maxCarrierD = 5.0;
  else if (wVal <= 6.0) maxCarrierD = 6.0;
  else if (wVal <= 7.0) maxCarrierD = 7.0;
  else if (wVal <= 8.0) maxCarrierD = 8.0;
  else if (wVal <= 9.0) maxCarrierD = 9.0;
  else if (wVal <= 10.0) maxCarrierD = 10.0;
  else if (wVal <= 12.0) maxCarrierD = 12.0;
  else maxCarrierD = Math.round(wVal);

  const odMin = part.odBf - part.odBfTolMinus;
  const odMax = part.odBf + part.odBfTolPlus;
  const tsgW_Amin = parseFloat((odMax + 0.1).toFixed(2));
  const tsgW_Amax = parseFloat((odMin + 1.0).toFixed(2));
  const wRounded = Math.ceil(part.wAft * 10) / 10;
  const tsgW_Emin = parseFloat((wRounded * 0.6).toFixed(2));
  const tsgW_Emax = parseFloat((wRounded * 0.9).toFixed(2));

  return {
    jawA, jawB, baseC, ID_part, bpAA, bpBB,
    chuteCalcA, chuteCalcB, chuteCalcC, chuteCalcD,
    carrierCalcA, carrierCalcB, carrierCalcC, maxCarrierD,
    tsgW_Amin, tsgW_Amax, tsgW_Emin, tsgW_Emax
  };
}

function calculateSD(part) {
  const SD = part.yBall === 'Y' ? part.sd : part.sdAft;
  if (!SD || isNaN(SD) || SD <= 0) return null;
  return SD;
}

function calculateKS400B_Params(part) {
  const OD_turning = part.odBf || 0;
  const W = part.wAft || 0;
  const ID = part.idAft || 0;
  const SD = calculateSD(part);

  if (OD_turning > 32 || W > 30) return { error: 'Part size is out of KS400B machine limits' };
  if (SD === null) return { error: 'Cannot calculate SD: W >= OD', od_turning: part.odBf, w_aft: part.wAft };

  const wd_type = SD < 19.5 ? 'TYPE1' : 'TYPE2';
  const wd_A = Math.ceil((SD - 0.5) * 2) / 2;
  const wd_B = Math.floor((ID - 0.8) * 2) / 2;
  const wd_C = wd_A < 13 ? 32 : 36;
  const wd_D = SD < 13.5 ? 24 : 30;
  const wd_E = 23;
  const wd_F = 8;

  const sb_A = parseFloat((20 + (OD_turning / 3)).toFixed(2));
  const sb_B = parseFloat((W + 0.3).toFixed(2));
  const sb_C = parseFloat((OD_turning * (5 / 6)).toFixed(2));
  const sb_D = parseFloat((30 - (OD_turning / 2)).toFixed(2));
  const sb_E = parseFloat((30 + (OD_turning / 4)).toFixed(2));
  const sb_hasR = OD_turning >= 30;

  const lc_E = Math.floor(OD_turning / 6);
  const lc_A = Math.ceil(197 - (OD_turning / 2) + lc_E);
  const lc_B = Math.ceil(W + 6);
  const lc_C = parseFloat((W + 0.2).toFixed(2));
  const lc_D = Math.ceil(parseFloat((OD_turning + 0.2).toFixed(3)) * 10) / 10;
  const lc_F = lc_C;

  let pa_A;
  if (ID < 20) pa_A = parseFloat((ID * 0.7).toFixed(2));
  else pa_A = parseFloat((ID - 4.0).toFixed(2));

  let pa_type, pa_E;
  if (SD <= 8.5) { pa_type = 'TYPE1'; pa_E = parseFloat((pa_A / 2).toFixed(2)); }
  else if (ID <= 11.4) { pa_type = 'TYPE2'; pa_E = 4; }
  else { pa_type = 'TYPE3'; pa_E = parseFloat((pa_A / 2).toFixed(2)); }

  const pa_B = parseFloat((SD - 0.5).toFixed(2));
  let pa_C;
  if (W <= 5) pa_C = 7;
  else pa_C = parseFloat((W * 0.9).toFixed(2));
  const pa_D = ID < 4 ? 0.5 : 1.0;
  const pa_F = 48;

  let pb_A;
  if (ID < 20) pb_A = parseFloat((ID - 0.7).toFixed(2));
  else pb_A = parseFloat((ID - 1.0).toFixed(2));
  const pb_B = pa_B, pb_C = pa_C, pb_D = pa_D, pb_E = pa_E, pb_F = 70;

  return {
    SD: SD.toFixed(3),
    wd_type, wd_A, wd_B, wd_C, wd_D, wd_E, wd_F,
    sb_A, sb_B, sb_C, sb_D, sb_E, sb_hasR,
    lc_A, lc_B, lc_C, lc_D, lc_E, lc_F,
    pa_type, pa_A, pa_B, pa_C, pa_D, pa_E, pa_F,
    pb_A, pb_B, pb_C, pb_D, pb_E, pb_F, pb_type: pa_type,
    od_turning: OD_turning, w_aft: W
  };
}

function calculateKS03A_Params(part) {
  const OD_nom = part.odAft || 0;
  const OD_max = part.odAft + part.odAftTolPlus;
  const W_nom = part.wAft || 0;
  const W_max = part.wAft + part.wAftTolPlus;
  const ID_nom = part.idAft || 0;
  const ID_min = part.idAft - part.idTolMinus;
  const ID_max = part.idAft + part.idTolPlus;
  const SD = calculateSD(part) || 0;
  const typeStr = String(part.type || '').toUpperCase();
  const yBallStr = String(part.yBall || '').toUpperCase();
  const isABR = typeStr.includes('ABR') || yBallStr === 'Y' || yBallStr === 'B';

  if (OD_nom > 33) return { error: 'OD > 33, Cannot use KS-03A' };

  let cpx_Type = OD_nom <= 15 ? 'TYPE1' : (OD_nom <= 20 ? 'TYPE2' : (OD_nom <= 30 ? 'TYPE3' : 'TYPE4'));
  const cpx_A = parseFloat((W_nom + 0.14).toFixed(3));
  const cpx_C = parseFloat((W_nom - 0.5).toFixed(3));
  const cpx_D = parseFloat(((OD_nom * 0.1) + 15.88).toFixed(3));
  let cpx_V = '-';
  if (isABR) cpx_V = 'Check Dwg';
  else if (cpx_C < 6) cpx_V = cpx_C.toFixed(3);
  else if (cpx_C < 8) cpx_V = '4.000';
  else cpx_V = '5.000';

  let rs_Type = 'TYPE3';
  if (W_max >= 7.0 && W_max < 12.3) rs_Type = 'TYPE1';
  else if (W_max >= 12.3 && W_max < 29.0) rs_Type = 'TYPE2';
  const rs_A = Math.ceil((15.88 + (0.1 * OD_max)) * 100) / 100;
  let temp_B = 68.26 - (0.5 * OD_max);
  if (OD_max < 13) temp_B += 0.1;
  else if (OD_max < 17) temp_B += 0.3;
  else if (OD_max < 22) temp_B += 0.5;
  else temp_B += 0.8;
  const rs_B = Math.ceil(temp_B * 100) / 100;
  const rs_C = parseFloat((W_max + 0.2).toFixed(2));
  const rs_D = Math.round((OD_max + 1.0) * 10) / 10;

  const chute_Type = OD_max < 19.05 ? 'TYPE1' : 'TYPE2';
  const chute_A = Math.round((OD_max + 0.2) * 10) / 10;
  const chute_B = Math.round((W_max + 0.15) * 10) / 10;
  let chute_C = 0;
  if (W_max <= 8.35) chute_C = 13;
  else if (W_max <= 13.35) chute_C = 18;
  else if (W_max <= 19.35) chute_C = 24;
  else if (W_max <= 25.35) chute_C = 30;
  else chute_C = 36;
  const chute_D = Math.round(W_max - 1);
  let chute_E = chute_Type === 'TYPE1' ? Math.round((20.88 - (1.1 * OD_max)) * 10) / 10 : Math.round((34.88 - (1.1 * OD_max)) * 10) / 10;
  if (chute_E < 1.5) chute_E = null;
  const chute_F = Math.floor(chute_C - chute_B - 1);
  let chute_G = null, chute_H = null;
  if (chute_E !== null) {
    chute_G = chute_Type === 'TYPE1' ? chute_E + 42 : chute_E + 52;
    if (chute_G > 55.8) chute_G = 55.8;
    chute_H = chute_Type === 'TYPE1' ? chute_E + 226.6 : chute_E + 212.6;
  }

  const fp_Type = OD_max < 19.05 ? 'TYPE1' : 'TYPE2';
  const fp_A = parseFloat((ID_min + 0.15).toFixed(3));
  const fp_B = fp_Type === 'TYPE1' ? 36.96 : 50.96;
  const fp_C = fp_Type === 'TYPE1' ? 15 : (OD_max < 30 ? 40 : 30);
  let fp_D = SD < 10.5 ? 11 : (SD < 17.5 ? 18 : (SD < 21.5 ? 22 : 32));
  let fp_E = SD < 17.5 ? 1.6 : 2.6;
  let fp_F = SD < 10.5 ? 7.94 : (SD < 17.5 ? 14.3 : (SD < 21.5 ? 19.05 : 28.55));
  const fp_G = parseFloat((cpx_D + (OD_max / 2) - 1).toFixed(3));
  const fp_H = parseFloat((12.7 + chute_A - 9).toFixed(3));
  const fp_J = parseFloat((fp_H + 9).toFixed(3));

  let sg_Type = fp_A < 10 ? 'TYPE1' : (fp_A < 19 ? 'TYPE2' : 'TYPE3');
  const sg_A = fp_A;
  const sg_B = sg_Type === 'TYPE1' ? parseFloat((W_nom + 63).toFixed(3)) : parseFloat((W_nom + 67).toFixed(3));
  const sg_C = sg_Type === 'TYPE1' ? 14 : (sg_Type === 'TYPE2' ? 20 : 22);
  const sg_D = sg_Type === 'TYPE1' ? 12 : 16;
  const sg_M = sg_Type === 'TYPE1' ? 'M6x1.0' : 'M8x1.25';

  const mr_A = OD_max;
  const mr_B = fp_A;
  const mr_C = W_nom;

  const pg_Type = sg_Type;
  const pg_T = parseFloat((ID_max - ID_min).toFixed(3));
  const pg_Tc = parseFloat(((ID_max + ID_min) / 2).toFixed(3));
  const pg_A = ID_nom;
  const abs_pg_B = pg_T <= 0.012 ? (ID_min + 0.005) : (pg_Tc - 0.001);
  const abs_pg_C = pg_T <= 0.012 ? (ID_min + 0.03) : (pg_Tc - 0.003);
  const pg_B = parseFloat((abs_pg_B - pg_A).toFixed(3));
  const pg_C = parseFloat((abs_pg_C - pg_A).toFixed(3));
  const pg_D = pg_Type === 'TYPE1' ? null : parseFloat((pg_A - 4).toFixed(3));
  const pg_E = pg_Type === 'TYPE1' ? null : parseFloat((pg_A - 2).toFixed(3));
  const pg_F = pg_Type === 'TYPE1' ? 14 : (pg_Type === 'TYPE2' ? 20 : 22);

  const ld_A_target = parseFloat((W_nom - 1).toFixed(1));
  const ld_A_max = parseFloat(W_nom.toFixed(2));
  const ld_A_min = parseFloat((W_nom * 0.6).toFixed(2));
  const ld_B = Math.floor(OD_nom * 100) / 100;
  const ld_C = Math.floor((OD_nom / 2 + 0.5) * 100) / 100;
  let ld_D = 0;
  if (OD_nom <= 12.7) ld_D = 12.7;
  else if (OD_nom <= 15.9) ld_D = 15.9;
  else if (OD_nom <= 19.1) ld_D = 19.1;
  else if (OD_nom <= 23.8) ld_D = 23.8;
  else ld_D = 28.0;
  const ld_E = OD_nom <= 15 ? 25 : 30;
  const ld_F = Math.ceil(OD_nom * 10) / 10;

  const pr_A = parseFloat((fp_A + 0.05).toFixed(3));
  let pr_Type = 'TYPE3';
  if (pr_A <= 10) pr_Type = 'TYPE1';
  else if (pr_A <= 16.25) pr_Type = 'TYPE2';

  return {
    error: null,
    cpxShoe: { Type: cpx_Type, A: cpx_A, C: cpx_C, D: cpx_D, V: cpx_V },
    rollerShoe: { Type: rs_Type, A: rs_A, B: rs_B, C: rs_C, D: rs_D },
    chute: { Type: chute_Type, A: chute_A, B: chute_B, C: chute_C, D: chute_D, E: chute_E, F: chute_F, G: chute_G, H: chute_H },
    fp: { Type: fp_Type, A: fp_A, B: fp_B, C: fp_C, D: fp_D, E: fp_E, F: fp_F, G: fp_G, H: fp_H, J: fp_J },
    sg: { Type: sg_Type, A: sg_A, B: sg_B, C: sg_C, D: sg_D, M: sg_M },
    mr: { A: mr_A, B: mr_B, C: mr_C },
    pg: { Type: pg_Type, A: pg_A, B: pg_B, C: pg_C, D: pg_D, E: pg_E, F: pg_F },
    ld: { A_target: ld_A_target, A_min: ld_A_min, A_max: ld_A_max, B: ld_B, C: ld_C, D: ld_D, E: ld_E, F: ld_F },
    pr: { Type: pr_Type, A: pr_A }
  };
}

function calculateKS500RD_Params(part) {
  const ID = part.idAft || 0;
  const W = part.wAft || 0;
  const OD = part.odAft || 0;
  if (ID < 14 || ID > 38.125 || OD < 26 || OD > 59.531 || W < 23.5 || W > 51.15) {
    return { error: 'Part size is out of KS500RD machine limits' };
  }
  const SD = calculateSD(part);
  if (SD === null) return { error: 'SD not found' };

  const lp_A = Math.floor((ID - 1.0) * 10) / 10;
  const lp_B = Math.floor((ID + 3.0) * 10) / 10;
  const lp_C = W <= 20 ? parseFloat((W * 0.6).toFixed(1)) : 12;
  let lp_D = 0;
  if (ID > 14.0 && ID <= 14.5) lp_D = 9.0;
  else if (ID > 14.5 && ID <= 24.5) lp_D = 9.5;
  else if (ID > 24.5) lp_D = 17.5;
  const lp_E = ID < 24.5 ? 5.5 : 11;
  const lp_F = Math.floor((ID - 4.5) * 10) / 10;
  const lp_G = ID < 24.5 ? 9 : 20;
  const lp_H = Math.round((ID - 0.8) * 10) / 10;

  const wd_A = parseFloat((SD - 0.2).toFixed(2));
  const wd_B = parseFloat((wd_A - 7.0).toFixed(2));

  let fs_No = '';
  if (W >= 0 && W < 19) fs_No = '4033-03-0001';
  else if (W >= 19 && W < 21) fs_No = '4033-03-0002';
  else if (W >= 21 && W < 28) fs_No = '4033-03-0003';
  else if (W >= 28 && W < 37) fs_No = '4033-03-0004';
  else if (W >= 37 && W < 46) fs_No = '4033-03-0005';
  else if (W >= 46 && W < 100) fs_No = '4033-03-0006';
  else fs_No = 'Out of Range';

  return {
    error: null,
    lp: { A: lp_A, B: lp_B, C: lp_C, D: lp_D, E: lp_E, F: lp_F, G: lp_G, H: lp_H },
    wd: { A: wd_A, B: wd_B },
    fs: { No: fs_No }
  };
}

function calculateKS400B5_Params(part) {
  const W = part.wAft || 0;
  const V = part.odAft || 0;
  const OD_before = part.odBf || 0;
  const Y = part.sdAft || 0;
  const X = part.sd || 0;
  if (V > 35 || OD_before > 35) return { error: 'Part OD > 35, out of KS-400B5 machine limits' };

  const typeStr = String(part.type || '').toUpperCase();
  const yBallStr = String(part.yBall || '').toUpperCase();
  const isBallInner = typeStr.includes('ABR') || typeStr.includes('BALL_INNER');

  let wc_A = 0;
  if (isBallInner) wc_A = V - 0.2;
  else if (yBallStr === 'Y') wc_A = X - 0.2;
  else wc_A = Y - 1.5;
  wc_A = Math.round(wc_A * 10) / 10;
  const wc_B = Math.round(49 - W);
  const wc_C = Math.round(wc_B + 9);
  const wc_D = 14;
  const wc_E = 5;
  let wc_Type = (V < 12.2 || X < 12.2 || Y < 12.2) ? 'TYPE1' : 'TYPE2';

  const shaft_X = part.sd || 0;
  const shaft_Y = (part.idBf || 0) + (part.idBfTolMinus || 0);
  const shaft_W = part.wAft || 0;
  const shaft_A = Math.round((shaft_X - 0.5) * 10) / 10;
  const shaft_B = shaft_W <= 12 ? 8 : 10;
  const shaft_C = Math.round((shaft_Y - 0.5) * 10) / 10;
  const shaft_Type = shaft_A < 14 ? 'TYPE1' : 'TYPE2';

  const chute_max_VZ = (part.odBf || 0) + (part.odBfTolPlus || 0);
  const chute_W = part.wAft || 0;
  const chute_A = parseFloat((chute_max_VZ + 0.1).toFixed(2));
  const chute_B = parseFloat((chute_W + 0.1).toFixed(2));
  const chute_C = parseFloat(((chute_max_VZ / 2) + 27.55).toFixed(3));
  const chute_D = chute_W <= 20 ? 30 : 37;

  const wl_Z = part.odBf || 0;
  const wl_W = part.wBf || part.wAft || 0;
  const wl_X = part.sd || 0;
  const wl_A = Math.floor((wl_Z + 0.2) * 10) / 10;
  const wl_B = Math.round(((wl_Z / 2) + 10) * 10) / 10;
  const wl_C = Math.round(((wl_Z / 2) + 27.5) * 10) / 10;
  const wl_D = parseFloat(wl_W.toFixed(2));
  let wl_E = ((wl_W - Math.sqrt(Math.max(0, Math.pow(wl_Z, 2) - Math.pow(wl_X, 2)))) / 2) - 1;
  wl_E = Math.max(1, wl_E);
  wl_E = Math.round(wl_E * 10) / 10;
  const wl_F = Math.floor((wl_X + 0.5) * 10) / 10;
  const wl_G = parseFloat((81.5 + wl_B).toFixed(1));

  const chuck_V = part.odBf || 0;
  const chuck_A = Math.round((chuck_V + 1.0) * 10) / 10;

  const wh_X = part.sd || 0;
  const wh_A = Math.round((wh_X + 2) * 10) / 10;
  let wh_B = 0;
  if (wh_A >= 11.5 && wh_A < 15) wh_B = 10;
  else if (wh_A >= 15 && wh_A < 18.5) wh_B = 13;
  else if (wh_A >= 18.5 && wh_A < 20.8) wh_B = 16;
  else if (wh_A >= 20.8 && wh_A < 27.7) wh_B = 18;
  else if (wh_A >= 27.7 && wh_A < 34.6) wh_B = 24;

  const cj_Z = (part.idAft || 0) + (part.idTolMinus || 0);
  const cj_Y = (part.idAft || 0) + (part.idTolPlus || 0);
  const cj_W = part.wAft || 0;
  const cj_A = parseFloat((cj_Y + 0.5).toFixed(2));
  const cj_B = parseFloat((cj_A - 0.8).toFixed(2));
  const cj_C = Math.ceil((36 + (cj_W * 0.67)) * 10) / 10;
  const cj_D = parseFloat((cj_Z - 0.03).toFixed(2));

  const wcg_Z = (part.odBf || 0) + (part.odBfTolPlus || 0);
  const wcg_A = chute_D;
  const wcg_B = Math.round((27.45 - (wcg_Z / 2)) * 10) / 10;
  const wcg_C = shaft_C;
  const wcg_D = shaft_A;
  const wcg_E = Math.round((wcg_D / 2) + (wcg_C / 2) + 3);

  const stopper_Y = (part.idBf || 0) + (part.idBfTolPlus || 0);
  const stopper_X = part.sd || 0;
  const stopper_A = parseFloat((stopper_Y + 0.5).toFixed(2));
  let stopper_B = Math.round((stopper_X - 0.1) * 10) / 10;
  if (stopper_B < 0) stopper_B = 0;

  const mrj_Y = (part.idBf || 0) + (((part.idBfTolPlus || 0) + (part.idBfTolMinus || 0)) / 2);
  const mrj_V = (part.odBf || 0) + (((part.odBfTolPlus || 0) + (part.odBfTolMinus || 0)) / 2);
  const mrj_W = part.wBf || part.wAft || 0;
  const mrj_A = parseFloat(mrj_Y.toFixed(3));
  const mrj_B = parseFloat(mrj_V.toFixed(3));
  const mrj_C = Math.round(mrj_W * 100) / 100;

  return {
    error: null,
    workClamp: { Type: wc_Type, A: wc_A, B: wc_B, C: wc_C, D: wc_D, E: wc_E },
    shaft: { Type: shaft_Type, A: shaft_A, B: shaft_B, C: shaft_C },
    workChute: { A: chute_A, B: chute_B, C: chute_C, D: chute_D },
    workLoader: { A: wl_A, B: wl_B, C: wl_C, D: wl_D, E: wl_E, F: wl_F, G: wl_G },
    workChuck: { A: chuck_A },
    workHolder: { A: wh_A, B: wh_B },
    chuckJaw: { A: cj_A, B: cj_B, C: cj_C, D: cj_D },
    workChuteGuide: { A: wcg_A, B: wcg_B, C: wcg_C, D: wcg_D, E: wcg_E },
    stopper: { A: stopper_A, B: stopper_B },
    masterRingForJaw: { A: mrj_A, B: mrj_B, C: mrj_C }
  };
}

function calculateKS400B6_Params(part) {
  const ID = part.idAft || 0;
  const SD = calculateSD(part);
  if (SD === null) return { error: 'SD not found' };

  const wd_A = Math.round((ID - 1.5) * 10) / 10;
  const wd_B = parseFloat(SD.toFixed(3));
  const wd_C = Math.round(SD + 2.5);
  const wd_D = 39;
  const wd_E = 45;

  const lc_OD_max = (part.odBf || 0) + (part.odBfTolPlus || 0);
  const lc_W_max = (part.wAft || 0) + (part.wAftTolPlus || 0);
  const lc_A = Math.round(219 - (lc_OD_max / 2));
  let lc_B = 0;
  if (lc_W_max <= 10) lc_B = 20;
  else if (lc_W_max <= 20) lc_B = 30;
  else if (lc_W_max <= 30) lc_B = 40;
  else lc_B = 50;
  const lc_C = parseFloat((lc_OD_max + 0.1).toFixed(2));
  const lc_D = Math.round((lc_W_max + 0.1) * 10) / 10;
  const isInner = String(part.type || '').toUpperCase().includes('INNER') || String(part.yBall || '').toUpperCase() === 'Y';
  const lc_F = isInner ? 'TG' : parseFloat((lc_D / 2).toFixed(1));

  const plug_ID = (part.idBf || 0) + (part.idBfTolMinus || 0);
  const plug_W = part.wAft || 0;
  const plug_A = parseFloat((plug_ID - 1).toFixed(2));
  const plug_B = parseFloat((plug_W - 1.5).toFixed(2));
  let plug_C;
  if (SD <= 8) plug_C = SD - 0.5;
  else if (SD > 8 && SD < 9) plug_C = 8;
  else plug_C = SD - 0.5;
  plug_C = parseFloat(plug_C.toFixed(2));
  const plug_D = plug_A <= 9 ? 0.5 : 1;

  const wg_W = part.wAft || 0;
  const wg_SD = calculateSD(part) || 0;
  const wg_DIA = (part.odBf || 0) + (part.odBfTolPlus || 0);
  const wg_isInner = String(part.type || '').toUpperCase().includes('INNER') || String(part.yBall || '').toUpperCase() === 'Y';
  const wg_A = Math.round(wg_W);
  const wg_C = Math.round((wg_DIA + 0.2) * 10) / 10;
  const wg_E = wg_A / 2;
  let wg_B, wg_D;
  if (wg_isInner) {
    wg_B = Math.round((45 - (wg_SD / 2)) * 10) / 10;
    wg_D = Math.round((((wg_DIA - wg_SD) / 2) + 0.2) * 10) / 10;
  } else {
    wg_B = Math.round((45 - (wg_SD / 2) - 1) * 10) / 10;
    wg_D = null;
  }

  const wp_ID = (part.idBf || 0) + (part.idBfTolMinus || 0);
  let wp_L = SD <= 20 ? 61.5 : (SD <= 32 ? 71 : 0);
  const wp_A = parseFloat(((SD + wp_ID) / 2).toFixed(2));
  const wp_B = parseFloat((wp_ID / 2).toFixed(2));
  const wp_C = Math.floor((wp_L - (wp_B / 2)) * 100) / 100;

  const sc_OD = (part.odBf || 0) + (part.odBfTolPlus || 0);
  const sc_W = part.wAft || 0;
  let stockerChuteObj = null;
  if (sc_OD <= 32 && sc_W <= 26) {
    const sc_A = Math.round((sc_OD + 0.5) * 10) / 10;
    const sc_B = Math.round((sc_W + 0.5) * 10) / 10;
    let sc_C = sc_W <= 17 ? 22 : (sc_W <= 27 ? 32 : 37);
    let sc_D = SD <= 6 ? 2 : (SD <= 8 ? 4 : (SD <= 10 ? 6 : 8));
    const sc_E = parseFloat((sc_B / 2).toFixed(1));
    let sc_F, sc_G, sc_H;
    if (sc_W <= 6) { sc_F = 'Ø2.1THRU.'; sc_G = 'M5x0.8THRU.'; sc_H = 44; }
    else if (sc_W <= 10) { sc_F = 'Ø3.1THRU.'; sc_G = 'M5x0.8THRU.'; sc_H = 44; }
    else { sc_F = 'M5x0.8THRU.'; sc_G = '-'; sc_H = '-'; }
    stockerChuteObj = { A: sc_A, B: sc_B, C: sc_C, D: sc_D, E: sc_E, F: sc_F, G: sc_G, H: sc_H };
  }

  const fs_OD = (part.odBf || 0) + (part.odBfTolPlus || 0);
  const fs_W = part.wAft || 0;
  const fs_isInner = String(part.type || '').toUpperCase().includes('INNER') || String(part.yBall || '').toUpperCase() === 'Y';
  const fs_C = 0.15;
  const fs_B = fs_OD < 10 ? 8 : 9;
  let fs_A, fs_D;
  if (fs_isInner) {
    fs_A = 'Need V';
  } else {
    fs_A = parseFloat(((fs_W / 2) + 2).toFixed(2));
  }
  if (typeof fs_A === 'number') {
    fs_D = Math.round(31 - (10 - fs_A - 1));
  } else {
    fs_D = '-';
  }

  const rs_OD = (part.odBf || 0) + (part.odBfTolPlus || 0);
  const rs_W = part.wAft || 0;
  const rs_isInner = fs_isInner;
  const rs_C = rs_OD < 10 ? 4 : 5;
  let rs_A, rs_B, rs_D;
  if (rs_isInner) {
    rs_A = 'Need X'; rs_B = 'Need Y';
  } else {
    rs_A = parseFloat(((rs_W / 2) - 2).toFixed(2));
    rs_B = parseFloat(((rs_W / 2) + 2).toFixed(2));
  }
  if (typeof rs_B === 'number') {
    rs_D = rs_B < 7.5 ? 30 : null;
  } else {
    rs_D = '-';
  }

  const pp_ID = (part.idBf || 0) + (part.idBfTolMinus || 0);
  const pp_W = part.wAft || 0;
  const pp_POD = 2.0;
  const pp_SHOD = 4.0;
  let pp_Type;
  if (pp_ID < 6) pp_Type = 'TYPE1';
  else if (pp_ID < 10) pp_Type = 'TYPE2';
  else pp_Type = 'TYPE3';
  const pp_A = Math.floor((pp_Type === 'TYPE1' ? pp_ID - 0.5 : pp_ID - 1.0) * 10) / 10;
  let pp_B_raw;
  if (pp_Type === 'TYPE1') pp_B_raw = pp_W + 1.5;
  else if (pp_Type === 'TYPE2') pp_B_raw = pp_W + 2.5;
  else pp_B_raw = pp_W + 2.0;
  const pp_B = Math.round(pp_B_raw * 10) / 10;
  const pp_C = Math.floor((pp_Type === 'TYPE1' ? pp_ID - 1.0 : pp_ID - 1.5) * 10) / 10;
  let pp_D = pp_Type !== 'TYPE3' ? Math.floor((pp_W - 1) * 10) / 10 : '-';
  let pp_E;
  if (pp_Type === 'TYPE1') pp_E = 6;
  else if (pp_Type === 'TYPE2') pp_E = 9;
  else pp_E = pp_C;
  const pp_F = parseFloat((pp_B + 5).toFixed(1));
  const pp_G = pp_W < 18 ? 48 : 65;
  const pp_H = pp_POD;
  const pp_J = pp_Type === 'TYPE1' ? parseFloat((pp_SHOD + 0.1).toFixed(1)) : pp_SHOD;
  const pp_K = pp_J + 1;
  const pp_L = pp_Type === 'TYPE1' ? 'R1' : 'R2';

  return {
    error: null,
    workDriver: { A: wd_A, B: wd_B, C: wd_C, D: wd_D, E: wd_E },
    loadingChute: { A: lc_A, B: lc_B, C: lc_C, D: lc_D, F: lc_F },
    plug: { A: plug_A, B: plug_B, C: plug_C, D: plug_D },
    workGuide: { A: wg_A, B: wg_B, C: wg_C, D: wg_D, E: wg_E },
    workPusher: { A: wp_A, B: wp_B, C: wp_C },
    stockerChute: stockerChuteObj,
    frontShoe: { A: fs_A, B: fs_B, C: fs_C, D: fs_D },
    rearShoe: { A: rs_A, B: rs_B, C: rs_C, D: rs_D },
    pilotPin: { Type: pp_Type, A: pp_A, B: pp_B, C: pp_C, D: pp_D, E: pp_E, F: pp_F, G: pp_G, H: pp_H, J: pp_J, K: pp_K, L: pp_L }
  };
}

module.exports = {
  calculateToolingParams,
  calculateSD,
  calculateKS400B_Params,
  calculateKS03A_Params,
  calculateKS500RD_Params,
  calculateKS400B5_Params,
  calculateKS400B6_Params,
};
