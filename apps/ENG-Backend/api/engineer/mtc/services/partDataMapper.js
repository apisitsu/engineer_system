'use strict';

const { engPool } = require('../../../../instance/eng_db');
const { TABLES } = require('../mtcConstants');
const {
  calculateSD,
  calculateKS03A_Params,
  calculateKS400B5_Params, calculateKS400B6_Params,
} = require('./calculationLogic');

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
  const base = calculateKS03A_Params(partData);
  if (dynamic.error || base.error) return base;
  const cpx = dynamic['CPX SHOE']    || {};
  const rs  = dynamic['ROLLER SHOE'] || {};
  const ch  = dynamic['CHUTE COVER'] || {};
  const fp  = dynamic['FRONT PLATE'] || {};
  const mr  = dynamic['MASTER RING'] || {};
  const pg  = dynamic['PLUG GAUGE']  || {};
  const ld  = dynamic['LOADER']      || {};
  return {
    ...base,
    cpxShoe:    { ...base.cpxShoe,    ...(cpx.A != null && { A: cpx.A }), ...(cpx.C != null && { C: cpx.C }), ...(cpx.D != null && { D: cpx.D }) },
    rollerShoe: { ...base.rollerShoe, ...(rs.A  != null && { A: rs.A  }), ...(rs.C  != null && { C: rs.C  }) },
    chute:      { ...base.chute,      ...(ch.A  != null && { A: ch.A  }) },
    fp:         { ...base.fp,         ...(fp.A  != null && { A: fp.A  }) },
    mr:         { ...base.mr,         ...(mr.A  != null && { A: mr.A  }) },
    pg:         { ...base.pg,         ...(pg.A  != null && { A: pg.A  }) },
    ld:         { ...base.ld,
                  ...(ld.A_target != null && { A_target: ld.A_target }),
                  ...(ld.A_min    != null && { A_min:    ld.A_min    }),
                  ...(ld.A_max    != null && { A_max:    ld.A_max    }),
                  ...(ld.B        != null && { B:        ld.B        }),
                  ...(ld.F        != null && { F:        ld.F        }) },
  };
}

function adaptDynamicKS400B(dynamic, partData) {
  if (dynamic.error) return { error: dynamic.error };
  if (partData.odBf > 32 || partData.wAft > 30) return { error: 'Part size is out of KS400B machine limits' };
  const SD = calculateSD(partData);
  if (SD === null) return { error: 'Cannot calculate SD: SD not found' };

  const wd = dynamic['WORK DRIVER']   || {};
  const sb = dynamic['SUPPORT BLOCK'] || {};
  const lc = dynamic['LOADING CHUTE'] || {};
  const pa = dynamic['PLUG(A)']       || {};
  const pb = dynamic['PLUG(B)']       || {};

  const wd_type = SD < 19.5 ? 'TYPE1' : 'TYPE2';
  const pa_type = SD <= 8.5 ? 'TYPE1' : (partData.idAft <= 11.4 ? 'TYPE2' : 'TYPE3');

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
    pa_F: 48,
    pb_type: pa_type,
    pb_A: pb.A ?? 0,
    pb_B: pb.B ?? 0,
    pb_C: pb.C ?? 0,
    pb_D: pa.D ?? 0,
    pb_E: pa.E ?? 0,
    pb_F: 70,
  };
}

function adaptDynamicKS500RD(dynamic, partData) {
  if (dynamic.error) return { error: dynamic.error };
  const { idAft: ID, odAft: OD, wAft: W } = partData;
  if (ID < 14 || ID > 38.125 || OD < 26 || OD > 59.531 || W < 23.5 || W > 51.15) {
    return { error: 'Part size is out of KS500RD machine limits' };
  }
  const SD = calculateSD(partData);
  if (SD === null) return { error: 'SD not found' };

  const lp = dynamic['LOADING PINTLE'] || {};
  const wd = dynamic['WORK DRIVER']    || {};

  let fs_No;
  if (W < 19)       fs_No = '4033-03-0001';
  else if (W < 21)  fs_No = '4033-03-0002';
  else if (W < 28)  fs_No = '4033-03-0003';
  else if (W < 37)  fs_No = '4033-03-0004';
  else if (W < 46)  fs_No = '4033-03-0005';
  else if (W < 100) fs_No = '4033-03-0006';
  else              fs_No = 'Out of Range';

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
  const base = calculateKS400B5_Params(partData);
  if (dynamic.error || base.error) return base;
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
  return {
    ...base,
    workClamp:      { ...base.workClamp,      ...(wc.A  != null && { A: wc.A  }), ...(wc.B != null && { B: wc.B }) },
    shaft:          { ...base.shaft,          ...(sh.A  != null && { A: sh.A  }), ...(sh.C != null && { C: sh.C }) },
    workChute:      { ...base.workChute,      ...(wch.A != null && { A: wch.A }), ...(wch.B != null && { B: wch.B }) },
    workLoader:     { ...base.workLoader,     ...(wl.A  != null && { A: wl.A  }), ...(wl.D != null && { D: wl.D }) },
    workChuck:      { ...base.workChuck,      ...(ck.A  != null && { A: ck.A  }) },
    workHolder:     { ...base.workHolder,     ...(wh.A  != null && { A: wh.A  }), ...(wh.B != null && { B: wh.B }) },
    chuckJaw:       { ...base.chuckJaw,       ...(cj.A  != null && { A: cj.A  }) },
    workChuteGuide: { ...base.workChuteGuide, ...(wcg.A != null && { A: wcg.A }), ...(wcg.B != null && { B: wcg.B }) },
    stopper:        { ...base.stopper,        ...(st.A  != null && { A: st.A  }), ...(st.B != null && { B: st.B }) },
    masterRingForJaw: { ...base.masterRingForJaw, ...(mrj.A != null && { A: mrj.A }), ...(mrj.B != null && { B: mrj.B }) },
  };
}

function adaptDynamicKS400B6(dynamic, partData) {
  const base = calculateKS400B6_Params(partData);
  if (dynamic.error || base.error) return base;
  const wd = dynamic['WORK DRIVER']    || {};
  const lc = dynamic['LOADING CHUTE']  || {};
  const pg = dynamic['PLUG']           || {};
  const wg = dynamic['WORK GUIDE']     || {};
  const wp = dynamic['WORK PUSHER']    || {};
  const sc = dynamic['STOCKER CHUTE']  || {};
  const fs = dynamic['FRONT SHOE']     || {};
  const rs = dynamic['REAR SHOE']      || {};
  const pp = dynamic['PILOT PIN']      || {};
  return {
    ...base,
    workDriver:   { ...base.workDriver,   ...(wd.A != null && { A: wd.A }), ...(wd.B != null && { B: wd.B }), ...(wd.C != null && { C: wd.C }) },
    loadingChute: { ...base.loadingChute, ...(lc.A != null && { A: lc.A }), ...(lc.C != null && { C: lc.C }), ...(lc.D != null && { D: lc.D }) },
    plug:         { ...base.plug,         ...(pg.A != null && { A: pg.A }), ...(pg.B != null && { B: pg.B }) },
    workGuide:    { ...base.workGuide,    ...(wg.A != null && { A: wg.A }), ...(wg.C != null && { C: wg.C }) },
    workPusher:   { ...base.workPusher,   ...(wp.A != null && { A: wp.A }), ...(wp.B != null && { B: wp.B }), ...(wp.C != null && { C: wp.C }) },
    ...(base.stockerChute && {
      stockerChute: { ...base.stockerChute, ...(sc.A != null && { A: sc.A }), ...(sc.B != null && { B: sc.B }), ...(sc.C != null && { C: sc.C }) },
    }),
    frontShoe:    { ...base.frontShoe,    ...(fs.A != null && { A: fs.A }), ...(fs.B != null && { B: fs.B }), ...(fs.D != null && { D: fs.D }) },
    rearShoe:     { ...base.rearShoe,     ...(rs.A != null && { A: rs.A }), ...(rs.B != null && { B: rs.B }), ...(rs.C != null && { C: rs.C }) },
    pilotPin:     { ...base.pilotPin,     ...(pp.A != null && { A: pp.A }), ...(pp.B != null && { B: pp.B }), ...(pp.C != null && { C: pp.C }) },
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
