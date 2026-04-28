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

function adaptDynamicCalcCommon(dynamic, partData) {
  const base = calculateToolingParams(partData);
  if (dynamic.error) return base;
  const patch = {};
  for (const [k, v] of Object.entries(dynamic)) {
    if (k !== '_raw') patch[k] = v;
  }
  return { ...base, ...patch };
}

function adaptDynamicKS03A(dynamic, partData) {
  const base = calculateKS03A_Params(partData);
  if (dynamic.error || base.error) return base;
  const cpx = dynamic['CPX SHOE'] || {};
  const rs  = dynamic['ROLLER SHOE'] || {};
  const ch  = dynamic['CHUTE'] || {};
  const fp  = dynamic['FRONT PLATE'] || {};
  const mr  = dynamic['MASTER RING'] || {};
  const pg  = dynamic['PLUG GAUGE'] || {};
  const ld  = dynamic['LOADER'] || {};
  return {
    ...base,
    cpxShoe:    { ...base.cpxShoe,    ...(cpx.cpx_A     != null && { A: cpx.cpx_A }),     ...(cpx.cpx_C  != null && { C: cpx.cpx_C }),  ...(cpx.cpx_D  != null && { D: cpx.cpx_D }) },
    rollerShoe: { ...base.rollerShoe, ...(rs.rs_A        != null && { A: rs.rs_A }),       ...(rs.rs_C    != null && { C: rs.rs_C }) },
    chute:      { ...base.chute,      ...(ch.chute_A     != null && { A: ch.chute_A }),    ...(ch.chute_B != null && { B: ch.chute_B }) },
    fp:         { ...base.fp,         ...(fp.fp_A        != null && { A: fp.fp_A }) },
    mr:         { ...base.mr,         ...(mr.mr_A        != null && { A: mr.mr_A }) },
    pg:         { ...base.pg,         ...(pg.pg_A        != null && { A: pg.pg_A }) },
    ld:         { ...base.ld,         ...(ld.ld_A_target != null && { A_target: ld.ld_A_target }) },
  };
}

function adaptDynamicKS400B(dynamic, partData) {
  const base = calculateKS400B_Params(partData);
  if (dynamic.error || base.error) return base;
  const patch = {};
  for (const [k, v] of Object.entries(dynamic)) {
    if (k !== '_raw') patch[k] = v;
  }
  return { ...base, ...patch };
}

function adaptDynamicKS500RD(dynamic, partData) {
  const base = calculateKS500RD_Params(partData);
  if (dynamic.error || base.error) return base;
  const lp = dynamic['lp'] || {};
  const wd = dynamic['wd'] || {};
  const fs = dynamic['fs'] || {};
  return {
    ...base,
    lp: { ...base.lp,
      ...(lp.lp_A != null && { A: lp.lp_A }), ...(lp.lp_B != null && { B: lp.lp_B }),
      ...(lp.lp_C != null && { C: lp.lp_C }), ...(lp.lp_D != null && { D: lp.lp_D }),
      ...(lp.lp_E != null && { E: lp.lp_E }), ...(lp.lp_F != null && { F: lp.lp_F }),
      ...(lp.lp_G != null && { G: lp.lp_G }), ...(lp.lp_H != null && { H: lp.lp_H }),
    },
    wd: { ...base.wd, ...(wd.wd_A != null && { A: wd.wd_A }), ...(wd.wd_B != null && { B: wd.wd_B }) },
    fs: { ...base.fs, ...(fs.fs_No != null && { No: fs.fs_No }) },
  };
}

function adaptDynamicKS400B5(dynamic, partData) {
  const base = calculateKS400B5_Params(partData);
  if (dynamic.error || base.error) return base;
  const wc  = dynamic['workClamp']        || {};
  const sh  = dynamic['shaft']            || {};
  const wch = dynamic['workChute']        || {};
  const wl  = dynamic['workLoader']       || {};
  const ck  = dynamic['workChuck']        || {};
  const wh  = dynamic['workHolder']       || {};
  const cj  = dynamic['chuckJaw']         || {};
  const wcg = dynamic['workChuteGuide']   || {};
  const st  = dynamic['stopper']          || {};
  const mrj = dynamic['masterRingForJaw'] || {};
  return {
    ...base,
    workClamp:      { ...base.workClamp,
      ...(wc.wc_A != null && { A: wc.wc_A }), ...(wc.wc_B != null && { B: wc.wc_B }),
      ...(wc.wc_C != null && { C: wc.wc_C }), ...(wc.wc_D != null && { D: wc.wc_D }),
      ...(wc.wc_E != null && { E: wc.wc_E }), ...(wc.wc_Type != null && { Type: wc.wc_Type }),
    },
    shaft:          { ...base.shaft,
      ...(sh.shaft_A != null && { A: sh.shaft_A }), ...(sh.shaft_B != null && { B: sh.shaft_B }),
      ...(sh.shaft_C != null && { C: sh.shaft_C }), ...(sh.shaft_Type != null && { Type: sh.shaft_Type }),
    },
    workChute:      { ...base.workChute,
      ...(wch.chute_A != null && { A: wch.chute_A }), ...(wch.chute_B != null && { B: wch.chute_B }),
      ...(wch.chute_C != null && { C: wch.chute_C }), ...(wch.chute_D != null && { D: wch.chute_D }),
    },
    workLoader:     { ...base.workLoader,
      ...(wl.wl_A != null && { A: wl.wl_A }), ...(wl.wl_B != null && { B: wl.wl_B }),
      ...(wl.wl_C != null && { C: wl.wl_C }), ...(wl.wl_D != null && { D: wl.wl_D }),
      ...(wl.wl_E != null && { E: wl.wl_E }), ...(wl.wl_F != null && { F: wl.wl_F }),
      ...(wl.wl_G != null && { G: wl.wl_G }),
    },
    workChuck:      { ...base.workChuck, ...(ck.chuck_A != null && { A: ck.chuck_A }) },
    workHolder:     { ...base.workHolder,
      ...(wh.wh_A != null && { A: wh.wh_A }), ...(wh.wh_B != null && { B: wh.wh_B }),
    },
    chuckJaw:       { ...base.chuckJaw,
      ...(cj.cj_A != null && { A: cj.cj_A }), ...(cj.cj_B != null && { B: cj.cj_B }),
      ...(cj.cj_C != null && { C: cj.cj_C }), ...(cj.cj_D != null && { D: cj.cj_D }),
    },
    workChuteGuide: { ...base.workChuteGuide,
      ...(wcg.wcg_A != null && { A: wcg.wcg_A }), ...(wcg.wcg_B != null && { B: wcg.wcg_B }),
      ...(wcg.wcg_C != null && { C: wcg.wcg_C }), ...(wcg.wcg_D != null && { D: wcg.wcg_D }),
      ...(wcg.wcg_E != null && { E: wcg.wcg_E }),
    },
    stopper:        { ...base.stopper,
      ...(st.stopper_A != null && { A: st.stopper_A }), ...(st.stopper_B != null && { B: st.stopper_B }),
    },
    masterRingForJaw: { ...base.masterRingForJaw,
      ...(mrj.mrj_A != null && { A: mrj.mrj_A }), ...(mrj.mrj_B != null && { B: mrj.mrj_B }),
      ...(mrj.mrj_C != null && { C: mrj.mrj_C }),
    },
  };
}

function adaptDynamicKS400B6(dynamic, partData) {
  const base = calculateKS400B6_Params(partData);
  if (dynamic.error || base.error) return base;
  const wd = dynamic['workDriver']   || {};
  const lc = dynamic['loadingChute'] || {};
  const pg = dynamic['plug']         || {};
  const wg = dynamic['workGuide']    || {};
  const wp = dynamic['workPusher']   || {};
  const sc = dynamic['stockerChute'] || {};
  const fs = dynamic['frontShoe']    || {};
  const rs = dynamic['rearShoe']     || {};
  const pp = dynamic['pilotPin']     || {};
  return {
    ...base,
    workDriver:   { ...base.workDriver,
      ...(wd.wd_A != null && { A: wd.wd_A }), ...(wd.wd_B != null && { B: wd.wd_B }),
      ...(wd.wd_C != null && { C: wd.wd_C }), ...(wd.wd_D != null && { D: wd.wd_D }),
      ...(wd.wd_E != null && { E: wd.wd_E }),
    },
    loadingChute: { ...base.loadingChute,
      ...(lc.lc_A != null && { A: lc.lc_A }), ...(lc.lc_B != null && { B: lc.lc_B }),
      ...(lc.lc_C != null && { C: lc.lc_C }), ...(lc.lc_D != null && { D: lc.lc_D }),
      ...(lc.lc_F != null && { F: lc.lc_F }),
    },
    plug:         { ...base.plug,
      ...(pg.plug_A != null && { A: pg.plug_A }), ...(pg.plug_B != null && { B: pg.plug_B }),
      ...(pg.plug_C != null && { C: pg.plug_C }), ...(pg.plug_D != null && { D: pg.plug_D }),
    },
    workGuide:    { ...base.workGuide,
      ...(wg.wg_A != null && { A: wg.wg_A }), ...(wg.wg_B != null && { B: wg.wg_B }),
      ...(wg.wg_C != null && { C: wg.wg_C }), ...(wg.wg_D != null && { D: wg.wg_D }),
      ...(wg.wg_E != null && { E: wg.wg_E }),
    },
    workPusher:   { ...base.workPusher,
      ...(wp.wp_A != null && { A: wp.wp_A }), ...(wp.wp_B != null && { B: wp.wp_B }),
      ...(wp.wp_C != null && { C: wp.wp_C }),
    },
    stockerChute: base.stockerChute ? { ...base.stockerChute,
      ...(sc.sc_A != null && { A: sc.sc_A }), ...(sc.sc_B != null && { B: sc.sc_B }),
      ...(sc.sc_C != null && { C: sc.sc_C }), ...(sc.sc_D != null && { D: sc.sc_D }),
      ...(sc.sc_E != null && { E: sc.sc_E }),
    } : base.stockerChute,
    frontShoe:    { ...base.frontShoe,
      ...(fs.fs_A != null && { A: fs.fs_A }), ...(fs.fs_B != null && { B: fs.fs_B }),
      ...(fs.fs_C != null && { C: fs.fs_C }), ...(fs.fs_D != null && { D: fs.fs_D }),
    },
    rearShoe:     { ...base.rearShoe,
      ...(rs.rs_A != null && { A: rs.rs_A }), ...(rs.rs_B != null && { B: rs.rs_B }),
      ...(rs.rs_C != null && { C: rs.rs_C }), ...(rs.rs_D != null && { D: rs.rs_D }),
    },
    pilotPin:     { ...base.pilotPin,
      ...(pp.pp_A != null && { A: pp.pp_A }), ...(pp.pp_B != null && { B: pp.pp_B }),
      ...(pp.pp_C != null && { C: pp.pp_C }), ...(pp.pp_D != null && { D: pp.pp_D }),
      ...(pp.pp_E != null && { E: pp.pp_E }), ...(pp.pp_F != null && { F: pp.pp_F }),
      ...(pp.pp_G != null && { G: pp.pp_G }), ...(pp.pp_H != null && { H: pp.pp_H }),
      ...(pp.pp_J != null && { J: pp.pp_J }), ...(pp.pp_K != null && { K: pp.pp_K }),
      ...(pp.pp_L != null && { L: pp.pp_L }), ...(pp.pp_Type != null && { Type: pp.pp_Type }),
    },
  };
}

function buildCalcMap(dynamics, partData) {
  const { dynCommon, dynKS400B, dynKS03A, dynKS500RD, dynKS400B5, dynKS400B6 } = dynamics;
  return {
    calc:         adaptDynamicCalcCommon(dynCommon, partData),
    ks400b_calc:  adaptDynamicKS400B(dynKS400B, partData),
    ks03a_calc:   adaptDynamicKS03A(dynKS03A, partData),
    ks500rd_calc: adaptDynamicKS500RD(dynKS500RD, partData),
    ks400b5_calc: adaptDynamicKS400B5(dynKS400B5, partData),
    ks400b6_calc: adaptDynamicKS400B6(dynKS400B6, partData),
  };
}

module.exports = { fetchSpecRow, mapPartData, computeDerivedFlags, buildCalcMap };
