'use strict';

const { engPool } = require('../../../../instance/eng_db');
const { TABLES } = require('../mtcConstants');
const {
  calculateToolingParams, calculateSD,
  calculateKS400B_Params, calculateKS03A_Params,
  calculateKS500RD_Params, calculateKS400B5_Params, calculateKS400B6_Params,
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
    process: String(row.process || ''),
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
    isIDtoOD:        partData.process === 'ID→OD' ? 1 : 0,
    isNormalOrOther: (partData.type.includes('NORMAL') || partData.type.includes('OTHER')) ? 1 : 0,
  };
}

// ── Dynamic formula adapters ───────────────────────────────────────────────
// Adapter: apply dynamic DB formula results onto legacy calc base.
// Legacy provides complete structure (limit checks, all keys). Dynamic patches individual values.

// dynKSB22G  → tooling_formula machine='KS-B22G'  (JAW, BACK PLATE)
// dynTSG300ZNC → tooling_formula machine='TSG-300ZNC' (CHUTE COVER, CARRIER)
function adaptDynamicCalcCommon(dynKSB22G, dynTSG300ZNC, partData) {
  const base = calculateToolingParams(partData);
  const jaw = dynKSB22G?.['JAW']         || {};
  const bp  = dynKSB22G?.['BACK PLATE']  || {};
  const ch  = dynTSG300ZNC?.['CHUTE COVER'] || {};
  const ca  = dynTSG300ZNC?.['CARRIER']     || {};
  return {
    ...base,
    ...(jaw.A != null && { jawA: jaw.A }),
    ...(jaw.B != null && { jawB: jaw.B }),
    ...(bp.A  != null && { bpAA: bp.A }),
    ...(bp.B  != null && { bpBB: bp.B }),
    ...(ch.A  != null && { chuteCalcA: ch.A }),
    ...(ca.C  != null && { carrierCalcC: ca.C }),
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
  const base = calculateKS400B_Params(partData);
  if (dynamic.error || base.error) return base;
  const wd   = dynamic['WORK DRIVER']   || {};
  const sb   = dynamic['SUPPORT BLOCK'] || {};
  const lc   = dynamic['LOADING CHUTE'] || {};
  const plug = dynamic['PLUG']          || {};
  return {
    ...base,
    ...(wd.A   != null && { wd_A: wd.A }),
    ...(wd.B   != null && { wd_B: wd.B }),
    ...(sb.A   != null && { sb_A: sb.A }),
    ...(lc.D   != null && { lc_D: lc.D }),
    ...(plug.A != null && { pa_B: plug.A, pb_B: plug.A }),
  };
}

function adaptDynamicKS500RD(dynamic, partData) {
  const base = calculateKS500RD_Params(partData);
  if (dynamic.error || base.error) return base;
  const lp = dynamic['LOADING PINTLE'] || {};
  const wd = dynamic['WORK DRIVER']    || {};
  return {
    ...base,
    lp: { ...base.lp, ...(lp.A != null && { A: lp.A }), ...(lp.B != null && { B: lp.B }) },
    wd: { ...base.wd, ...(wd.A != null && { A: wd.A }), ...(wd.B != null && { B: wd.B }) },
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
