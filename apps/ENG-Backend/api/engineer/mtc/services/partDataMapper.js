'use strict';

const { engPool } = require('../../../../instance/eng_db');
const { TABLES } = require('../mtcConstants');
const { calculateSD } = require('./calculationLogic');

// ── Machine dimension constants ────────────────────────────────────────────
// Named thresholds for each machine's adapter logic.
// Eligibility conditions (that admin can tune) live in tooling_machine_config.conditions.
// These constants cover type-selection and display logic inside the adapters.

const KS03A_PARAMS = {
  OD_MAX:               33,     // max odAft for machine eligibility
  CPX_OD_THRESHOLDS:    [15, 20, 30],  // OD_max boundaries for CPX SHOE TYPE1/2/3/4
  CPX_C_THRESHOLDS:     [6, 8],        // C value boundaries for V field selection
  RS_W_THRESHOLDS:      [7.0, 12.3, 29.0], // W_max boundaries for ROLLER SHOE TYPE1/2/3
  CHUTE_FP_OD_SPLIT:    19.05, // OD_max threshold for CHUTE COVER / FRONT PLATE TYPE1/2
  SG_A_THRESHOLDS:      [10, 19], // fp_A boundaries for SETTING GAUGE TYPE1/2/3
  PR_A_THRESHOLDS:      [10, 16.25], // pr_A boundaries for PRESSURE ROTOR TYPE1/2/3
  CHUTE_E_MIN:          1.5,   // min E value; below this, E/G/H are null (chute unusable)
  CHUTE_G_MAX:          55.8,  // cap on chute G dimension
};

const KS400B_PARAMS = {
  OD_BF_MAX:            32,    // max odBf for machine eligibility
  W_AFT_MAX:            30,    // max wAft for machine eligibility
  SD_TYPE_THRESHOLD:    19.5,  // SD < this → WORK DRIVER TYPE1
  PA_SD_THRESHOLD:      8.5,   // SD <= this → PLUG(A) TYPE1
  PA_ID_THRESHOLD:      11.4,  // idAft <= this (and SD > 8.5) → PLUG(A) TYPE2, else TYPE3
  PA_F:                 48,    // fixed PLUG(A) F dimension (physical constant)
  PB_F:                 70,    // fixed PLUG(B) F dimension (physical constant)
};

const KS500RD_PARAMS = {
  ID_MIN: 14,   ID_MAX: 38.125,
  OD_MIN: 26,   OD_MAX: 59.531,
  W_MIN:  23.5, W_MAX:  51.15,
  // W range → FRONT SHOE part number. Update if manufacturing part numbers change.
  FRONT_SHOE_MAP: [
    { maxW: 19,       no: '4033-03-0001' },
    { maxW: 21,       no: '4033-03-0002' },
    { maxW: 28,       no: '4033-03-0003' },
    { maxW: 37,       no: '4033-03-0004' },
    { maxW: 46,       no: '4033-03-0005' },
    { maxW: 100,      no: '4033-03-0006' },
  ],
};

const KS400B5_PARAMS = {
  OD_MAX:              35,    // max odAft / odBf for machine eligibility
  WC_TYPE_THRESHOLD:   12.2,  // wc_min < this → WORK CLAMP TYPE1
  SHAFT_TYPE_THRESHOLD: 14,   // sh_A < this → SHAFT TYPE1
};

const KS400B6_PARAMS = {
  // PILOT PIN type boundaries based on pp_ID = idBf + idBfTolMinus
  PP_ID_THRESHOLDS: [6, 10],
  // STOCKER CHUTE: only present when OD_max <= SC_OD_MAX and W <= SC_W_MAX
  SC_OD_MAX: 32,
  SC_W_MAX:  26,
  // Drill/thread string lookup by W range (cannot be computed by expr-eval — string constants)
  SC_DRILL_SPECS: [
    { maxW: 6,        F: 'Ø2.1THRU.',  G: 'M5x0.8THRU.', H: 44 },
    { maxW: 10,       F: 'Ø3.1THRU.',  G: 'M5x0.8THRU.', H: 44 },
    { maxW: Infinity, F: 'M5x0.8THRU.', G: '-',           H: '-' },
  ],
};

// ── DB fetch ───────────────────────────────────────────────────────────────

async function fetchSpecRow(cnNumber) {
  const r = await engPool.query(
    `SELECT * FROM ${TABLES.SPEC_PROCESS} WHERE TRIM(cn) = $1 LIMIT 1`,
    [String(cnNumber).trim()]
  );
  if (r.rows.length === 0) throw new Error('C/N not found in Specification.');
  return r.rows[0];
}

// ── Data mapping ───────────────────────────────────────────────────────────

function mapPartData(row) {
  return {
    odBf:          parseFloat(row.od_bf    || 0),
    odBfTolPlus:   parseFloat(row.od_bf_max || 0),
    odBfTolMinus:  parseFloat(row.od_bf_min || 0),
    idBf:          parseFloat(row.id_bf    || 0),
    idBfTolPlus:   parseFloat(row.id_bf_max || 0),
    idBfTolMinus:  parseFloat(row.id_bf_min || 0),
    wBf:           parseFloat(row.w_bf     || 0),
    wBfTolPlus:    parseFloat(row.w_bf_max || 0),
    wBfTolMinus:   parseFloat(row.w_bf_min || 0),
    odAft:         parseFloat(row.od_aft   || 0),
    odAftTolPlus:  parseFloat(row.od_aft_max || 0),
    odAftTolMinus: parseFloat(row.od_aft_min || 0),
    idAft:         parseFloat(row.id_aft   || 0),
    idTolPlus:     parseFloat(row.id_aft_max || 0),
    idTolMinus:    parseFloat(row.id_aft_min || 0),
    wAft:          parseFloat(row.w_aft    || 0),
    wAftTolPlus:   parseFloat(row.w_aft_max || 0),
    wAftTolMinus:  parseFloat(row.w_aft_min || 0),
    type:    String(row.type    || '').toUpperCase(),
    yBall:   row.yball ? String(row.yball).toUpperCase() : 'N',
    process: String(row.process || '').replace(/=>/g, '->').replace(/→/g, '->'),
    sd:      parseFloat(row.sd     || 0),
    sdAft:   parseFloat(row.sd_aft || 0),
  };
}

function computeDerivedFlags(partData) {
  const sdCalc = calculateSD(partData) || 0;
  return {
    ...partData,
    sdCalc,
    isYBall:         partData.yBall === 'Y' ? 1 : 0,
    isBallInner:     (partData.type.includes('ABR') || partData.type.includes('BALL_INNER')) ? 1 : 0,
    isABR:           (partData.type.includes('ABR') || partData.yBall === 'Y' || partData.yBall === 'B') ? 1 : 0,
    isInner:         (partData.type.includes('INNER') || partData.yBall === 'Y') ? 1 : 0,
    isIDtoOD:        partData.process === 'ID->OD' ? 1 : 0,
    isNormalOrOther: (partData.type.includes('NORMAL') || partData.type.includes('OTHER')) ? 1 : 0,
  };
}

// ── Dynamic formula adapters ───────────────────────────────────────────────
// KS-B22G and TSG-300ZNC are fully DB-driven (no hardcode base).
// Remaining machines still use hardcode base + DB patches (Phase 2/3 migration pending).

// dynKSB22G  → tooling_formula machine='KS-B22G'  (JAW, BACK PLATE)
// dynTSG300ZNC → tooling_formula machine='TSG-300ZNC' (CHUTE COVER, CARRIER, CARRIER W)
function adaptDynamicCalcCommon(dynKSB22G, dynTSG300ZNC, partData) {
  const jaw = dynKSB22G?.['JAW']             || {};
  const bp  = dynKSB22G?.['BACK PLATE']      || {};
  const ch  = dynTSG300ZNC?.['CHUTE COVER']  || {};
  const ca  = dynTSG300ZNC?.['CARRIER']      || {};
  const caw = dynTSG300ZNC?.['CARRIER W']    || {};
  return {
    jawA:         jaw.A    ?? 0,
    jawB:         jaw.B    ?? 0,
    baseC:        jaw.C    ?? 0,
    bpAA:         bp.A     ?? 0,
    bpBB:         bp.B     ?? 0,
    chuteCalcA:   ch.A     ?? 0,
    chuteCalcB:   ch.B     ?? 0,
    chuteCalcC:   ch.C     ?? 0,
    chuteCalcD:   ch.D     ?? 0,
    carrierCalcA: ca.A     ?? 0,
    carrierCalcB: ca.B     ?? 0,
    carrierCalcC: ca.C     ?? 0,
    tsgW_Amin:    caw.Amin ?? 0,
    tsgW_Amax:    caw.Amax ?? 0,
  };
}

function adaptDynamicKS03A(dynamic, partData) {
  if (dynamic.error) return { error: dynamic.error };
  if ((partData.odAft || 0) > KS03A_PARAMS.OD_MAX) return { error: `OD > ${KS03A_PARAMS.OD_MAX}, Cannot use KS-03A` };

  const OD_max = (partData.odAft || 0) + (partData.odAftTolPlus || 0);
  const W_max  = (partData.wAft  || 0) + (partData.wAftTolPlus  || 0);
  const typeStr  = String(partData.type  || '').toUpperCase();
  const yBallStr = String(partData.yBall || '').toUpperCase();
  const isABR = typeStr.includes('ABR') || yBallStr === 'Y' || yBallStr === 'B';

  const cpx = dynamic['CPX SHOE']       || {};
  const rs  = dynamic['ROLLER SHOE']    || {};
  const ch  = dynamic['CHUTE COVER']    || {};
  const fp  = dynamic['FRONT PLATE']    || {};
  const sg  = dynamic['SETTING GAUGE']  || {};
  const mr  = dynamic['MASTER RING']    || {};
  const pg  = dynamic['PLUG GAUGE']     || {};
  const ld  = dynamic['LOADER']         || {};
  const pr  = dynamic['PRESSURE ROTOR'] || {};

  const [cpx1, cpx2, cpx3] = KS03A_PARAMS.CPX_OD_THRESHOLDS;
  const cpx_Type   = OD_max <= cpx1 ? 'TYPE1' : OD_max <= cpx2 ? 'TYPE2' : OD_max <= cpx3 ? 'TYPE3' : 'TYPE4';
  const [cpc1, cpc2] = KS03A_PARAMS.CPX_C_THRESHOLDS;
  const cpx_C_val  = cpx.C ?? 0;
  let   cpx_V;
  if (isABR)               cpx_V = 'Check Dwg';
  else if (cpx_C_val < cpc1) cpx_V = cpx_C_val.toFixed(3);
  else if (cpx_C_val < cpc2) cpx_V = '4.000';
  else                       cpx_V = '5.000';

  const [rs1, rs2] = KS03A_PARAMS.RS_W_THRESHOLDS;
  const rs_Type    = W_max >= rs1 && W_max < rs2 ? 'TYPE1' : W_max >= rs2 && W_max < KS03A_PARAMS.RS_W_THRESHOLDS[2] ? 'TYPE2' : 'TYPE3';
  const chute_Type = OD_max < KS03A_PARAMS.CHUTE_FP_OD_SPLIT ? 'TYPE1' : 'TYPE2';
  const fp_Type    = OD_max < KS03A_PARAMS.CHUTE_FP_OD_SPLIT ? 'TYPE1' : 'TYPE2';
  const fp_A_val   = fp.A ?? 0;
  const [sg1, sg2] = KS03A_PARAMS.SG_A_THRESHOLDS;
  const sg_Type    = fp_A_val < sg1 ? 'TYPE1' : fp_A_val < sg2 ? 'TYPE2' : 'TYPE3';
  const sg_M       = sg_Type === 'TYPE1' ? 'M6x1.0' : 'M8x1.25';

  const pr_A_val   = pr.A ?? 0;
  const [pr1, pr2] = KS03A_PARAMS.PR_A_THRESHOLDS;
  const pr_Type    = pr_A_val <= pr1 ? 'TYPE1' : pr_A_val <= pr2 ? 'TYPE2' : 'TYPE3';

  const chute_E_raw = ch.E ?? 0;
  const chute_E = chute_E_raw >= KS03A_PARAMS.CHUTE_E_MIN ? chute_E_raw : null;
  const chute_G = chute_E !== null ? Math.min(ch.G ?? 0, KS03A_PARAMS.CHUTE_G_MAX) : null;
  const chute_H = chute_E !== null ? (ch.H ?? 0) : null;

  // Plug gauge D/E: null when TYPE1
  const pg_D = sg_Type !== 'TYPE1' ? (pg.D || null) : null;
  const pg_E = sg_Type !== 'TYPE1' ? (pg.E || null) : null;

  return {
    error: null,
    cpxShoe:    { Type: cpx_Type,   A: cpx.A ?? 0, C: cpx.C ?? 0, D: cpx.D ?? 0, V: cpx_V },
    rollerShoe: { Type: rs_Type,    A: rs.A  ?? 0, B: rs.B  ?? 0, C: rs.C  ?? 0, D: rs.D  ?? 0 },
    chute:      { Type: chute_Type, A: ch.A  ?? 0, B: ch.B  ?? 0, C: ch.C  ?? 0, D: ch.D  ?? 0, E: chute_E, F: ch.F ?? 0, G: chute_G, H: chute_H },
    fp:         { Type: fp_Type,    A: fp.A  ?? 0, B: fp.B  ?? 0, C: fp.C  ?? 0, D: fp.D  ?? 0, E: fp.E ?? 0, F: fp.F ?? 0, G: fp.G ?? 0, H: fp.H ?? 0, J: fp.J ?? 0 },
    sg:         { Type: sg_Type,    A: sg.A  ?? 0, B: sg.B  ?? 0, C: sg.C  ?? 0, D: sg.D  ?? 0, M: sg_M },
    mr:         { A: mr.A ?? 0, B: mr.B ?? 0, C: mr.C ?? 0 },
    pg:         { Type: sg_Type,    A: pg.A  ?? 0, B: pg.B  ?? 0, C: pg.C  ?? 0, D: pg_D, E: pg_E, F: pg.F ?? 0 },
    ld:         { A_target: ld.A_target ?? 0, A_min: ld.A_min ?? 0, A_max: ld.A_max ?? 0, B: ld.B ?? 0, C: ld.C ?? 0, D: ld.D ?? 0, E: ld.E ?? 0, F: ld.F ?? 0 },
    pr:         { Type: pr_Type, A: pr.A ?? 0 },
  };
}

function adaptDynamicKS400B(dynamic, partData) {
  if (dynamic.error) return { error: dynamic.error };
  if (partData.odBf > KS400B_PARAMS.OD_BF_MAX || partData.wAft > KS400B_PARAMS.W_AFT_MAX) {
    return { error: `Part size is out of KS400B machine limits (odBf max ${KS400B_PARAMS.OD_BF_MAX}, wAft max ${KS400B_PARAMS.W_AFT_MAX})` };
  }
  const SD = calculateSD(partData);
  if (SD === null) return { error: 'Cannot calculate SD: SD not found' };

  const wd = dynamic['WORK DRIVER']   || {};
  const sb = dynamic['SUPPORT BLOCK'] || {};
  const lc = dynamic['LOADING CHUTE'] || {};
  const pa = dynamic['PLUG(A)']       || {};
  const pb = dynamic['PLUG(B)']       || {};

  const wd_type = SD < KS400B_PARAMS.SD_TYPE_THRESHOLD ? 'TYPE1' : 'TYPE2';
  const pa_type = SD <= KS400B_PARAMS.PA_SD_THRESHOLD ? 'TYPE1' : (partData.idAft <= KS400B_PARAMS.PA_ID_THRESHOLD ? 'TYPE2' : 'TYPE3');

  return {
    od_turning: partData.odBf,
    w_aft:      partData.wAft,
    SD:         SD.toFixed(3),
    wd_type,
    wd_A: wd.A ?? 0,
    wd_B: wd.B ?? 0,
    wd_C: wd.C ?? 0,
    wd_D: wd.D ?? 0,
    wd_E: wd.E ?? 0,
    wd_F: wd.F ?? 0,
    sb_A: sb.A ?? 0,
    sb_B: sb.B ?? 0,
    sb_C: sb.C ?? 0,
    sb_D: sb.D ?? 0,
    sb_E: sb.E ?? 0,
    sb_hasR: (sb.R ?? 0) > 0,
    lc_A: lc.A ?? 0,
    lc_B: lc.B ?? 0,
    lc_C: lc.C ?? 0,
    lc_D: lc.D ?? 0,
    lc_E: lc.E ?? 0,
    lc_F: lc.F ?? 0,
    pa_type,
    pa_A: pa.A ?? 0,
    pa_B: pa.B ?? 0,
    pa_C: pa.C ?? 0,
    pa_D: pa.D ?? 0,
    pa_E: pa.E ?? 0,
    pa_F: KS400B_PARAMS.PA_F,
    pb_type: pa_type,
    pb_A: pb.A ?? 0,
    pb_B: pb.B ?? 0,
    pb_C: pb.C ?? 0,
    pb_D: pa.D ?? 0,
    pb_E: pa.E ?? 0,
    pb_F: KS400B_PARAMS.PB_F,
  };
}

function adaptDynamicKS500RD(dynamic, partData) {
  if (dynamic.error) return { error: dynamic.error };
  const { idAft: ID, odAft: OD, wAft: W } = partData;
  const p = KS500RD_PARAMS;
  if (ID < p.ID_MIN || ID > p.ID_MAX || OD < p.OD_MIN || OD > p.OD_MAX || W < p.W_MIN || W > p.W_MAX) {
    return { error: `Part size is out of KS500RD machine limits (ID ${p.ID_MIN}–${p.ID_MAX}, OD ${p.OD_MIN}–${p.OD_MAX}, W ${p.W_MIN}–${p.W_MAX})` };
  }
  const SD = calculateSD(partData);
  if (SD === null) return { error: 'SD not found' };

  const lp = dynamic['LOADING PINTLE'] || {};
  const wd = dynamic['WORK DRIVER']    || {};

  const fsEntry = KS500RD_PARAMS.FRONT_SHOE_MAP.find(e => W < e.maxW);
  const fs_No = fsEntry ? fsEntry.no : 'Out of Range';

  return {
    error: null,
    lp: {
      A: lp.A ?? 0, B: lp.B ?? 0, C: lp.C ?? 0, D: lp.D ?? 0,
      E: lp.E ?? 0, F: lp.F ?? 0, G: lp.G ?? 0, H: lp.H ?? 0,
    },
    wd: { A: wd.A ?? 0, B: wd.B ?? 0 },
    fs: { No: fs_No },
  };
}

function adaptDynamicKS400B5(dynamic, partData) {
  if (dynamic.error) return { error: dynamic.error };
  if ((partData.odAft || 0) > KS400B5_PARAMS.OD_MAX || (partData.odBf || 0) > KS400B5_PARAMS.OD_MAX) {
    return { error: `Part OD > ${KS400B5_PARAMS.OD_MAX}, out of KS-400B5 machine limits` };
  }

  const wc  = dynamic['WORK CLAMP']   || {};
  const sh  = dynamic['SHAFT']        || {};
  const wch = dynamic['WORK CHUTE']   || {};
  const wl  = dynamic['WORK LOADER']  || {};
  const ck  = dynamic['WORK CHUCK']   || {};
  const wh  = dynamic['WORK HOLDER']  || {};
  const cj  = dynamic['CHUCK JAW']    || {};
  const wcg = dynamic['CHUTE GUIDE']  || {};
  const st  = dynamic['STOPPER']      || {};
  const mrj = dynamic['MASTER RING']  || {};

  const wc_min  = Math.min(partData.odAft || 0, partData.sd || 0, partData.sdAft || 0);
  const wc_Type = wc_min < KS400B5_PARAMS.WC_TYPE_THRESHOLD ? 'TYPE1' : 'TYPE2';
  const sh_A_val   = sh.A ?? 0;
  const shaft_Type = sh_A_val < KS400B5_PARAMS.SHAFT_TYPE_THRESHOLD ? 'TYPE1' : 'TYPE2';

  return {
    error: null,
    workClamp:        { Type: wc_Type,    A: wc.A  ?? 0, B: wc.B  ?? 0, C: wc.C  ?? 0, D: wc.D  ?? 0, E: wc.E  ?? 0 },
    shaft:            { Type: shaft_Type, A: sh.A  ?? 0, B: sh.B  ?? 0, C: sh.C  ?? 0 },
    workChute:        { A: wch.A ?? 0, B: wch.B ?? 0, C: wch.C ?? 0, D: wch.D ?? 0 },
    workLoader:       { A: wl.A  ?? 0, B: wl.B  ?? 0, C: wl.C  ?? 0, D: wl.D  ?? 0, E: wl.E ?? 0, F: wl.F ?? 0, G: wl.G ?? 0 },
    workChuck:        { A: ck.A  ?? 0 },
    workHolder:       { A: wh.A  ?? 0, B: wh.B  ?? 0 },
    chuckJaw:         { A: cj.A  ?? 0, B: cj.B  ?? 0, C: cj.C  ?? 0, D: cj.D  ?? 0 },
    workChuteGuide:   { A: wcg.A ?? 0, B: wcg.B ?? 0, C: wcg.C ?? 0, D: wcg.D ?? 0, E: wcg.E ?? 0 },
    stopper:          { A: st.A  ?? 0, B: st.B  ?? 0 },
    masterRingForJaw: { A: mrj.A ?? 0, B: mrj.B ?? 0, C: mrj.C ?? 0 },
  };
}

function adaptDynamicKS400B6(dynamic, partData) {
  if (dynamic.error) return { error: dynamic.error };

  const SD = calculateSD(partData);
  if (SD === null) return { error: 'SD not found' };

  const isInner = String(partData.type || '').toUpperCase().includes('INNER') || String(partData.yBall || '').toUpperCase() === 'Y';
  const pp_ID   = (partData.idBf || 0) + (partData.idBfTolMinus || 0);
  const [pp1, pp2] = KS400B6_PARAMS.PP_ID_THRESHOLDS;
  const pp_Type = pp_ID < pp1 ? 'TYPE1' : pp_ID < pp2 ? 'TYPE2' : 'TYPE3';
  const sc_OD   = (partData.odBf || 0) + (partData.odBfTolPlus || 0);
  const sc_W    = partData.wAft || 0;

  const wd = dynamic['WORK DRIVER']   || {};
  const lc = dynamic['LOADING CHUTE'] || {};
  const pg = dynamic['PLUG']          || {};
  const wg = dynamic['WORK GUIDE']    || {};
  const wp = dynamic['WORK PUSHER']   || {};
  const sc = dynamic['STOCKER CHUTE'] || {};
  const fs = dynamic['FRONT SHOE']    || {};
  const rs = dynamic['REAR SHOE']     || {};
  const pp = dynamic['PILOT PIN']     || {};

  // String fields — cannot store in expr-eval DB, computed here
  const lc_F = isInner ? 'TG' : parseFloat(((lc.D ?? 0) / 2).toFixed(1));
  const fs_A  = isInner ? 'Need V' : (fs.A ?? 0);
  const fs_D  = isInner ? '-' : (fs.D ?? 0);
  const rs_A  = isInner ? 'Need X' : (rs.A ?? 0);
  const rs_B  = isInner ? 'Need Y' : (rs.B ?? 0);
  const rs_D  = isInner ? '-' : ((rs.D ?? 0) !== 0 ? rs.D : null);
  const pp_D  = pp_Type === 'TYPE3' ? '-' : (pp.D ?? 0);
  const pp_L  = pp_Type === 'TYPE1' ? 'R1' : 'R2';

  // workGuide.D: DB returns 0 when !isInner → null
  const wg_D = isInner ? (wg.D ?? 0) : null;

  // stockerChute: null when OD_max > SC_OD_MAX or W > SC_W_MAX; F/G/H are string constants
  // (cannot be stored in tooling_formula — expr-eval only returns numbers)
  let stockerChute = null;
  if (sc_OD <= KS400B6_PARAMS.SC_OD_MAX && sc_W <= KS400B6_PARAMS.SC_W_MAX) {
    const drillSpec = KS400B6_PARAMS.SC_DRILL_SPECS.find(s => sc_W <= s.maxW);
    const { F: sc_F, G: sc_G, H: sc_H } = drillSpec;
    stockerChute = { A: sc.A ?? 0, B: sc.B ?? 0, C: sc.C ?? 0, D: sc.D ?? 0, E: sc.E ?? 0, F: sc_F, G: sc_G, H: sc_H };
  }

  return {
    error: null,
    workDriver:   { A: wd.A ?? 0, B: wd.B ?? 0, C: wd.C ?? 0, D: wd.D ?? 0, E: wd.E ?? 0 },
    loadingChute: { A: lc.A ?? 0, B: lc.B ?? 0, C: lc.C ?? 0, D: lc.D ?? 0, F: lc_F },
    plug:         { A: pg.A ?? 0, B: pg.B ?? 0, C: pg.C ?? 0, D: pg.D ?? 0 },
    workGuide:    { A: wg.A ?? 0, B: wg.B ?? 0, C: wg.C ?? 0, D: wg_D,      E: wg.E ?? 0 },
    workPusher:   { A: wp.A ?? 0, B: wp.B ?? 0, C: wp.C ?? 0 },
    stockerChute,
    frontShoe:    { A: fs_A,      B: fs.B ?? 0, C: fs.C ?? 0, D: fs_D },
    rearShoe:     { A: rs_A,      B: rs_B,       C: rs.C ?? 0, D: rs_D },
    pilotPin:     { Type: pp_Type, A: pp.A ?? 0, B: pp.B ?? 0, C: pp.C ?? 0, D: pp_D, E: pp.E ?? 0, F: pp.F ?? 0, G: pp.G ?? 0, H: pp.H ?? 0, J: pp.J ?? 0, K: pp.K ?? 0, L: pp_L },
  };
}

function buildCalcMap(dynamics, partData) {
  const { dynKSB22G, dynTSG300ZNC, dynKS400B, dynKS03A, dynKS500RD, dynKS400B5, dynKS400B6 } = dynamics;
  return {
    calc:         adaptDynamicCalcCommon(dynKSB22G, dynTSG300ZNC, partData),
    ks400b_calc:  adaptDynamicKS400B(dynKS400B, partData),
    ks03a_calc:   adaptDynamicKS03A(dynKS03A, partData),
    ks500rd_calc: adaptDynamicKS500RD(dynKS500RD, partData),
    ks400b5_calc: adaptDynamicKS400B5(dynKS400B5, partData),
    ks400b6_calc: adaptDynamicKS400B6(dynKS400B6, partData),
  };
}

module.exports = { fetchSpecRow, mapPartData, computeDerivedFlags, buildCalcMap };
