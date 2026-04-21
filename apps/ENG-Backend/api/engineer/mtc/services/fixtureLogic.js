'use strict';

const { engPool } = require('../../../../instance/eng_db');
const { TABLES } = require('../mtcConstants');
const {
  calculateToolingParams, calculateSD,
  calculateKS400B_Params, calculateKS03A_Params,
  calculateKS500RD_Params, calculateKS400B5_Params, calculateKS400B6_Params,
} = require('./calculationLogic');
const {
  topNPerMachine,
  searchKSB22G_Jaws, searchKSB22G_BackPlates,
  searchKSB80_Jaws, searchKSB80_BackPlates,
  searchTSG_Chutes, searchTSG300_Carriers, searchTSG300W_Carriers,
  searchKS400B_WorkDriver, searchKS400B_LoadingChute, searchKS400B_SupportBlock,
  searchKS400B_PlugA, searchKS400B_PlugB,
  searchKS03A_RollerShoe, searchKS03A_CPXShoe, searchKS03A_ChuteCover,
  searchKS03A_FrontPlate, searchKS03A_SettingGauge, searchKS03A_MasterRing,
  searchKS03A_PlugGauge, searchKS03A_Loader, searchKS03A_PressureRotor,
  searchKS500RD_LoadingPintle, searchKS500RD_WorkDriver,
  searchKS400B5_Tool,
  searchKS400B6_WorkDriver, searchKS400B6_LoadingChute, searchKS400B6_Plug,
  searchKS400B6_WorkGuide, searchKS400B6_WorkPusher, searchKS400B6_StockerChute,
  searchKS400B6_FrontShoe, searchKS400B6_RearShoe, searchKS400B6_PilotPin,
} = require('./searchFunctions');
const { findDynamicFixtures } = require('./dynamicLogic');
const FormulaService = require('./FormulaService');

const TOP_N = 2;
const MAX_JAW_DEPTH = 10.0;
const h = name => name;

// Adapter: apply dynamic DB formula results onto legacy calc base.
// Legacy provides complete structure (limit checks, all keys). Dynamic patches individual values.
// Naming convention: param_key in DB uses abbreviated prefix (e.g. cpx_A, rs_A, lp_A)
// which the adapter strips to get the sub-property name (A, C, etc.)

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
    cpxShoe:    { ...base.cpxShoe,    ...(cpx.cpx_A      != null && { A: cpx.cpx_A }),      ...(cpx.cpx_C     != null && { C: cpx.cpx_C }),     ...(cpx.cpx_D     != null && { D: cpx.cpx_D }) },
    rollerShoe: { ...base.rollerShoe, ...(rs.rs_A         != null && { A: rs.rs_A }),        ...(rs.rs_C       != null && { C: rs.rs_C }) },
    chute:      { ...base.chute,      ...(ch.chute_A      != null && { A: ch.chute_A }),     ...(ch.chute_B    != null && { B: ch.chute_B }) },
    fp:         { ...base.fp,         ...(fp.fp_A         != null && { A: fp.fp_A }) },
    mr:         { ...base.mr,         ...(mr.mr_A         != null && { A: mr.mr_A }) },
    pg:         { ...base.pg,         ...(pg.pg_A         != null && { A: pg.pg_A }) },
    ld:         { ...base.ld,         ...(ld.ld_A_target  != null && { A_target: ld.ld_A_target }) },
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
    wd: { ...base.wd,
      ...(wd.wd_A != null && { A: wd.wd_A }), ...(wd.wd_B != null && { B: wd.wd_B }),
    },
    fs: { ...base.fs, ...(fs.fs_No != null && { No: fs.fs_No }) },
  };
}

function adaptDynamicKS400B5(dynamic, partData) {
  const base = calculateKS400B5_Params(partData);
  if (dynamic.error || base.error) return base;
  const wc  = dynamic['workClamp']       || {};
  const sh  = dynamic['shaft']           || {};
  const wch = dynamic['workChute']       || {};
  const wl  = dynamic['workLoader']      || {};
  const ck  = dynamic['workChuck']       || {};
  const wh  = dynamic['workHolder']      || {};
  const cj  = dynamic['chuckJaw']        || {};
  const wcg = dynamic['workChuteGuide']  || {};
  const st  = dynamic['stopper']         || {};
  const mrj = dynamic['masterRingForJaw']|| {};
  return {
    ...base,
    workClamp:    { ...base.workClamp,
      ...(wc.wc_A != null && { A: wc.wc_A }), ...(wc.wc_B != null && { B: wc.wc_B }),
      ...(wc.wc_C != null && { C: wc.wc_C }), ...(wc.wc_D != null && { D: wc.wc_D }),
      ...(wc.wc_E != null && { E: wc.wc_E }), ...(wc.wc_Type != null && { Type: wc.wc_Type }),
    },
    shaft:        { ...base.shaft,
      ...(sh.shaft_A != null && { A: sh.shaft_A }), ...(sh.shaft_B != null && { B: sh.shaft_B }),
      ...(sh.shaft_C != null && { C: sh.shaft_C }), ...(sh.shaft_Type != null && { Type: sh.shaft_Type }),
    },
    workChute:    { ...base.workChute,
      ...(wch.chute_A != null && { A: wch.chute_A }), ...(wch.chute_B != null && { B: wch.chute_B }),
      ...(wch.chute_C != null && { C: wch.chute_C }), ...(wch.chute_D != null && { D: wch.chute_D }),
    },
    workLoader:   { ...base.workLoader,
      ...(wl.wl_A != null && { A: wl.wl_A }), ...(wl.wl_B != null && { B: wl.wl_B }),
      ...(wl.wl_C != null && { C: wl.wl_C }), ...(wl.wl_D != null && { D: wl.wl_D }),
      ...(wl.wl_E != null && { E: wl.wl_E }), ...(wl.wl_F != null && { F: wl.wl_F }),
      ...(wl.wl_G != null && { G: wl.wl_G }),
    },
    workChuck:    { ...base.workChuck, ...(ck.chuck_A != null && { A: ck.chuck_A }) },
    workHolder:   { ...base.workHolder,
      ...(wh.wh_A != null && { A: wh.wh_A }), ...(wh.wh_B != null && { B: wh.wh_B }),
    },
    chuckJaw:     { ...base.chuckJaw,
      ...(cj.cj_A != null && { A: cj.cj_A }), ...(cj.cj_B != null && { B: cj.cj_B }),
      ...(cj.cj_C != null && { C: cj.cj_C }), ...(cj.cj_D != null && { D: cj.cj_D }),
    },
    workChuteGuide: { ...base.workChuteGuide,
      ...(wcg.wcg_A != null && { A: wcg.wcg_A }), ...(wcg.wcg_B != null && { B: wcg.wcg_B }),
      ...(wcg.wcg_C != null && { C: wcg.wcg_C }), ...(wcg.wcg_D != null && { D: wcg.wcg_D }),
      ...(wcg.wcg_E != null && { E: wcg.wcg_E }),
    },
    stopper:      { ...base.stopper,
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
  const wd  = dynamic['workDriver']   || {};
  const lc  = dynamic['loadingChute'] || {};
  const pg  = dynamic['plug']         || {};
  const wg  = dynamic['workGuide']    || {};
  const wp  = dynamic['workPusher']   || {};
  const sc  = dynamic['stockerChute'] || {};
  const fs  = dynamic['frontShoe']    || {};
  const rs  = dynamic['rearShoe']     || {};
  const pp  = dynamic['pilotPin']     || {};
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

async function findFixtures(cnNumber) {
  try {
    const partResult = await engPool.query(
      `SELECT * FROM ${TABLES.SPEC_PROCESS} WHERE TRIM(cn) = $1 LIMIT 1`,
      [String(cnNumber).trim()]
    );
    if (partResult.rows.length === 0) throw new Error('C/N not found in Specification.');

    const r = partResult.rows[0];
    const partData = {
      odBf:          parseFloat(r.od_bf   || 0),
      odBfTolPlus:   parseFloat(r.od_bf_max || 0),
      odBfTolMinus:  parseFloat(r.od_bf_min || 0),
      idBf:          parseFloat(r.id_bf   || 0),
      idBfTolPlus:   parseFloat(r.id_bf_max || 0),
      idBfTolMinus:  parseFloat(r.id_bf_min || 0),
      wBf:           parseFloat(r.w_bf    || 0),
      wBfTolPlus:    parseFloat(r.w_bf_max || 0),
      wBfTolMinus:   parseFloat(r.w_bf_min || 0),
      odAft:         parseFloat(r.od_aft  || 0),
      odAftTolPlus:  parseFloat(r.od_aft_max || 0),
      odAftTolMinus: parseFloat(r.od_aft_min || 0),
      idAft:         parseFloat(r.id_aft  || 0),
      idTolPlus:     parseFloat(r.id_aft_max || 0),
      idTolMinus:    parseFloat(r.id_aft_min || 0),
      wAft:          parseFloat(r.w_aft   || 0),
      wAftTolPlus:   parseFloat(r.w_aft_max || 0),
      wAftTolMinus:  parseFloat(r.w_aft_min || 0),
      type:    String(r.type    || '').toUpperCase(),
      yBall:   r.yball ? String(r.yball).toUpperCase() : 'N',
      process: String(r.process || ''),
      sd:      parseFloat(r.sd     || 0),
      sdAft:   parseFloat(r.sd_aft || 0),
    };

    // Pre-compute derived flags for DB formula context
    partData.sdCalc      = calculateSD(partData) || 0;
    partData.isYBall     = partData.yBall === 'Y' ? 1 : 0;
    partData.isBallInner = (partData.type.includes('ABR') || partData.type.includes('BALL_INNER')) ? 1 : 0;
    partData.isABR       = (partData.type.includes('ABR') || partData.yBall === 'Y' || partData.yBall === 'B') ? 1 : 0;
    partData.isInner     = (partData.type.includes('INNER') || partData.yBall === 'Y') ? 1 : 0;

    // --- NEW: Try Dynamic Formulas First ---
    const [dynamicKS400B, dynamicKS03A, dynamicKS500RD, dynamicKS400B5, dynamicKS400B6] = await Promise.all([
      FormulaService.calculateMachineParams('KS400B', partData),
      FormulaService.calculateMachineParams('KS03A', partData),
      FormulaService.calculateMachineParams('KS500RD', partData),
      FormulaService.calculateMachineParams('KS400B5', partData),
      FormulaService.calculateMachineParams('KS400B6', partData),
    ]);

    // Apply dynamic DB formulas onto legacy calc base (legacy handles limit checks)
    const calc         = calculateToolingParams(partData);
    const ks400b_calc  = adaptDynamicKS400B(dynamicKS400B, partData);
    const ks03a_calc   = adaptDynamicKS03A(dynamicKS03A, partData);
    const ks500rd_calc = adaptDynamicKS500RD(dynamicKS500RD, partData);
    const ks400b5_calc = adaptDynamicKS400B5(dynamicKS400B5, partData);
    const ks400b6_calc = adaptDynamicKS400B6(dynamicKS400B6, partData);

    // Flags for conditional querying
    const ksb22gOK = calc.jawA <= 38 && partData.idAft >= 4.8 && partData.idAft < 16 && partData.wAft >= 14;
    const ksb80OK  = calc.jawA > 15 && calc.jawA <= 70 && partData.idAft >= 7.9 && partData.wAft >= 14;
    const ks03aOK  = partData.odAft <= 33 && !ks03a_calc.error;
    const ks400bOK = !ks400b_calc.error;
    const ks500rdOK= !ks500rd_calc.error;
    const ks400b5OK= !ks400b5_calc.error;
    const ks400b6OK= !ks400b6_calc.error;

    const [ksb22g, ksb80, tsg300, ks03a, ks400b, ks500rd, ks400b5, ks400b6] = await Promise.all([
      ksb22gOK ? engPool.query(`
        SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
               dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C", dim_d AS "Dim_D",
               machine AS "Machine"
        FROM ${TABLES.TOOLING_KSB22G}
        WHERE (tooling_name ILIKE '%JAW%' AND dim_a BETWEEN $1 AND $2)
           OR (tooling_name ILIKE '%BACK PLATE%' AND dim_a BETWEEN $3 AND $4)`,
        [calc.jawA - 0.015, calc.jawA + 0.05, calc.bpAA, calc.bpAA + 2.5]
      ) : Promise.resolve({ rows: [] }),
      ksb80OK ? engPool.query(`
        SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
               dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C",
               dim_d AS "Dim_D", dim_e AS "Dim_E",
               machine AS "Machine"
        FROM ${TABLES.TOOLING_KSB80}
        WHERE (tooling_name ILIKE '%JAW%' AND dim_a BETWEEN $1 AND $2)
           OR (tooling_name ILIKE '%BACK PLATE%' AND dim_a BETWEEN $3 AND $4)`,
        [calc.jawA - 0.015, calc.jawA + 0.05, calc.bpAA - 0.4, calc.bpAA + 3.1]
      ) : Promise.resolve({ rows: [] }),
      engPool.query(`
        SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
               dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C", dim_d AS "Dim_D",
               dim_e AS "Dim_E", dim_f AS "Dim_F", dim_g AS "Dim_G",
               machine AS "Machine"
        FROM ${TABLES.TOOLING_TSG300}
        WHERE (tooling_name ILIKE '%CHUTE%' AND dim_a BETWEEN $1 AND $2 AND dim_b BETWEEN $3 AND $4)
           OR (tooling_name ILIKE '%CARRIER%' AND dim_a BETWEEN $5 AND $6)`,
        [
          calc.chuteCalcA, calc.chuteCalcA + 1.0,
          calc.chuteCalcB - 0.1, calc.chuteCalcB + 3.0,
          Math.min(calc.carrierCalcA, calc.tsgW_Amin) - 0.1,
          Math.max(calc.carrierCalcA + 1.0, calc.tsgW_Amax) + 0.1,
        ]
      ),
      ks03aOK ? engPool.query(`
        SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
               dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C", dim_d AS "Dim_D",
               dim_e AS "Dim_E", dim_f AS "Dim_F", dim_g AS "Dim_G", dim_h AS "Dim_H",
               dim_i AS "Dim_I", dim_j AS "Dim_J", dim_k AS "Dim_K", dim_l AS "Dim_L",
               dim_m AS "Dim_M", dim_n AS "Dim_N", dim_o AS "Dim_O", dim_p AS "Dim_P",
               dim_q AS "Dim_Q", dim_r AS "Dim_R", dim_s AS "Dim_S", dim_t AS "Dim_T",
               dim_u AS "Dim_U", dim_v AS "Dim_V", machine AS "Machine" FROM ${TABLES.TOOLING_KS03A}
        WHERE tooling_name ILIKE ANY(ARRAY['%ROLLER SHOE%', '%CPX SHOE%', '%CHUTE COVER%', '%FRONT PLATE%', '%SETTING GAUGE%', '%MASTER RING%', '%PLUG GAUGE%', '%LOADER%', '%ROTOR%'])`) : Promise.resolve({ rows: [] }),
      ks400bOK ? engPool.query(`
        SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
               dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C",
               dim_d AS "Dim_D", dim_e AS "Dim_E", dim_f AS "Dim_F",
               machine AS "Machine" FROM ${TABLES.TOOLING_KS400B}
        WHERE tooling_name ILIKE ANY(ARRAY['%WORK DRIVER%', '%SUPPORT BLOCK%', '%CHUTE%', '%PLUG%'])`) : Promise.resolve({ rows: [] }),
      ks500rdOK ? engPool.query(`
        SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
               dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C", dim_d AS "Dim_D",
               dim_e AS "Dim_E", dim_f AS "Dim_F", dim_g AS "Dim_G", dim_h AS "Dim_H",
               machine AS "Machine" FROM ${TABLES.TOOLING_KS500RD}
        WHERE tooling_name ILIKE ANY(ARRAY['%LOADING PINTLE%', '%WORK DRIVER%', '%FRONT SHOE%'])`) : Promise.resolve({ rows: [] }),
      ks400b5OK ? engPool.query(`
        SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
               dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C", dim_d AS "Dim_D",
               dim_e AS "Dim_E", dim_f AS "Dim_F", dim_g AS "Dim_G", dim_h AS "Dim_H",
               dim_i AS "Dim_I", dim_j AS "Dim_J", dim_k AS "Dim_K", dim_l AS "Dim_L",
               dim_m AS "Dim_M", dim_n AS "Dim_N", dim_o AS "Dim_O", dim_p AS "Dim_P",
               dim_q AS "Dim_Q", dim_r AS "Dim_R", dim_s AS "Dim_S", dim_t AS "Dim_T",
               dim_u AS "Dim_U", dim_v AS "Dim_V", dim_w AS "Dim_W", dim_x AS "Type"
               FROM ${TABLES.TOOLING_KS400B5}
        WHERE tooling_name ILIKE ANY(ARRAY['%WORK CLAMP%', '%SHAFT%', '%WORK CHUTE%', '%WORK LOADER%', '%WORK CHUCK%', '%WORK HOLDER%', '%CHUCK JAW%', '%CHUTE GUIDE%', '%STOPPER%', '%MASTER RING%'])`) : Promise.resolve({ rows: [] }),
      ks400b6OK ? engPool.query(`
        SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
               dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C", dim_d AS "Dim_D",
               dim_e AS "Dim_E", dim_f AS "Dim_F", dim_g AS "Dim_G", dim_h AS "Dim_H",
               dim_i AS "Dim_I", dim_j AS "Dim_J", dim_k AS "Dim_K", dim_l AS "Dim_L",
               dim_m AS "Dim_M", dim_n AS "Dim_N", dim_o AS "Dim_O", dim_p AS "Dim_P",
               dim_q AS "Dim_Q", dim_r AS "Dim_R", dim_s AS "Dim_S", dim_t AS "Dim_T",
               dim_u AS "Dim_U", dim_v AS "Dim_V", dim_w AS "Dim_W", dim_x AS "Type"
               FROM ${TABLES.TOOLING_KS400B6}
        WHERE tooling_name ILIKE ANY(ARRAY['%WORK DRIVER%', '%CHUTE%', '%PLUG%', '%WORK GUIDE%', '%WORK PUSHER%', '%FRONT SHOE%', '%REAR SHOE%', '%PILOT PIN%'])`) : Promise.resolve({ rows: [] }),
    ]);


    const ksb22gRows  = ksb22g.rows;
    const ksb80Rows   = ksb80.rows;
    const tsg300Rows  = tsg300.rows;
    const ks03aRows   = ks03a.rows;
    const ks400bRows  = ks400b.rows;
    const ks500rdRows = ks500rd.rows;
    const ks400b5Rows = ks400b5.rows;
    const ks400b6Rows = ks400b6.rows;

    let allJawMatches = [], allBpMatches = [];
    if (ksb22gOK) {
      allJawMatches.push(...searchKSB22G_Jaws(ksb22gRows, h, 'KS-B22G', calc, MAX_JAW_DEPTH));
      allBpMatches.push(...searchKSB22G_BackPlates(ksb22gRows, h, 'KS-B22G', calc));
    }

    if (ksb80OK) {
      allJawMatches.push(...searchKSB80_Jaws(ksb80Rows, h, 'KS-B80', calc, MAX_JAW_DEPTH));
      allBpMatches.push(...searchKSB80_BackPlates(ksb80Rows, h, 'KS-B80', calc));
    }

    const allChuteMatches      = searchTSG_Chutes(tsg300Rows, h, 'TSG-300', calc);
    const allCarrierZncMatches = searchTSG300_Carriers(tsg300Rows, h, 'TSG-300', calc);
    const allCarrierWMatches   = searchTSG300W_Carriers(tsg300Rows, h, 'TSG-300', calc);

    let ks03a_results = {};
    if (ks03aOK) {
      const targetMachine = partData.idAft >= 12.0 ? 'KS-B22RD' : 'KS-03A';
      ks03a_results = {
        calc: ks03a_calc,
        rollerShoes:    topNPerMachine(searchKS03A_RollerShoe(ks03aRows, h, targetMachine, ks03a_calc), TOP_N),
        cpxShoes:       topNPerMachine(searchKS03A_CPXShoe(ks03aRows, h, targetMachine, ks03a_calc), TOP_N),
        chuteCovers:    topNPerMachine(searchKS03A_ChuteCover(ks03aRows, h, targetMachine, ks03a_calc), TOP_N),
        frontPlates:    topNPerMachine(searchKS03A_FrontPlate(ks03aRows, h, targetMachine, ks03a_calc), TOP_N),
        settingGauges:  topNPerMachine(searchKS03A_SettingGauge(ks03aRows, h, targetMachine, ks03a_calc), TOP_N),
        masterRings:    topNPerMachine(searchKS03A_MasterRing(ks03aRows, h, targetMachine, ks03a_calc), TOP_N),
        plugGauges:     topNPerMachine(searchKS03A_PlugGauge(ks03aRows, h, targetMachine, ks03a_calc), TOP_N),
        loader:         topNPerMachine(searchKS03A_Loader(ks03aRows, h, targetMachine, ks03a_calc), TOP_N),
        pressureRotors: topNPerMachine(searchKS03A_PressureRotor(ks03aRows, h, targetMachine, ks03a_calc), TOP_N),
      };
    }

    let ks400b_results = { calc: ks400b_calc };
    if (ks400bOK) {
      ks400b_results = {
        calc: ks400b_calc,
        workDrivers:   topNPerMachine(searchKS400B_WorkDriver(ks400bRows, h, 'KS400B', ks400b_calc), TOP_N),
        supportBlocks: topNPerMachine(searchKS400B_SupportBlock(ks400bRows, h, 'KS400B', ks400b_calc), TOP_N),
        loadingChutes: topNPerMachine(searchKS400B_LoadingChute(ks400bRows, h, 'KS400B', ks400b_calc), TOP_N),
        plugsA:        topNPerMachine(searchKS400B_PlugA(ks400bRows, h, 'KS400B', ks400b_calc), TOP_N),
        plugsB:        topNPerMachine(searchKS400B_PlugB(ks400bRows, h, 'KS400B', ks400b_calc), TOP_N),
      };
    }

    let ks500rd_results = {};
    if (ks500rdOK) {
      ks500rd_results = {
        calc: ks500rd_calc,
        loadingPintles: topNPerMachine(searchKS500RD_LoadingPintle(ks500rdRows, h, 'KS500RD', ks500rd_calc), TOP_N),
        workDrivers:    topNPerMachine(searchKS500RD_WorkDriver(ks500rdRows, h, 'KS500RD', ks500rd_calc), TOP_N),
        frontShoes: [{ no: ks500rd_calc.fs.No, machine: 'KS500RD', val1: '-', val2: '-', val3: '-' }],
      };
    }

    let ks400b5_results = {};
    if (ks400b5OK) {
      ks400b5_results = {
        calc: ks400b5_calc,
        workClamps:      topNPerMachine(searchKS400B5_Tool(ks400b5Rows, h, 'KS400B5', 'WORK CLAMP',   ks400b5_calc.workClamp), TOP_N),
        shafts:          topNPerMachine(searchKS400B5_Tool(ks400b5Rows, h, 'KS400B5', 'SHAFT',        ks400b5_calc.shaft), TOP_N),
        workChutes:      topNPerMachine(searchKS400B5_Tool(ks400b5Rows, h, 'KS400B5', 'WORK CHUTE',   ks400b5_calc.workChute), TOP_N),
        workLoaders:     topNPerMachine(searchKS400B5_Tool(ks400b5Rows, h, 'KS400B5', 'WORK LOADER',  ks400b5_calc.workLoader), TOP_N),
        workChucks:      topNPerMachine(searchKS400B5_Tool(ks400b5Rows, h, 'KS400B5', 'WORK CHUCK',   ks400b5_calc.workChuck), TOP_N),
        workHolders:     topNPerMachine(searchKS400B5_Tool(ks400b5Rows, h, 'KS400B5', 'WORK HOLDER',  ks400b5_calc.workHolder), TOP_N),
        chuckJaws:       topNPerMachine(searchKS400B5_Tool(ks400b5Rows, h, 'KS400B5', 'CHUCK JAW',    ks400b5_calc.chuckJaw), TOP_N),
        workChuteGuides: topNPerMachine(searchKS400B5_Tool(ks400b5Rows, h, 'KS400B5', 'CHUTE GUIDE',  ks400b5_calc.workChuteGuide), TOP_N),
        stoppers:        topNPerMachine(searchKS400B5_Tool(ks400b5Rows, h, 'KS400B5', 'STOPPER',      ks400b5_calc.stopper), TOP_N),
        masterRings:     topNPerMachine(searchKS400B5_Tool(ks400b5Rows, h, 'KS400B5', 'MASTER RING',  ks400b5_calc.masterRingForJaw), TOP_N),
      };
    }

    let ks400b6_results = {};
    if (ks400b6OK) {
      ks400b6_results = {
        calc: ks400b6_calc,
        workDrivers:   topNPerMachine(searchKS400B6_WorkDriver(ks400b6Rows, h, 'KS400B6', ks400b6_calc), TOP_N),
        loadingChutes: topNPerMachine(searchKS400B6_LoadingChute(ks400b6Rows, h, 'KS400B6', ks400b6_calc), TOP_N),
        plugs:         topNPerMachine(searchKS400B6_Plug(ks400b6Rows, h, 'KS400B6', ks400b6_calc), TOP_N),
        workGuides:    topNPerMachine(searchKS400B6_WorkGuide(ks400b6Rows, h, 'KS400B6', ks400b6_calc), TOP_N),
        workPushers:   topNPerMachine(searchKS400B6_WorkPusher(ks400b6Rows, h, 'KS400B6', ks400b6_calc), TOP_N),
        stockerChutes: topNPerMachine(searchKS400B6_StockerChute(ks400b6Rows, h, 'KS400B6', ks400b6_calc), TOP_N),
        frontShoes:    topNPerMachine(searchKS400B6_FrontShoe(ks400b6Rows, h, 'KS400B6', ks400b6_calc), TOP_N),
        rearShoes:     topNPerMachine(searchKS400B6_RearShoe(ks400b6Rows, h, 'KS400B6', ks400b6_calc), TOP_N),
        pilotPins:     topNPerMachine(searchKS400B6_PilotPin(ks400b6Rows, h, 'KS400B6', ks400b6_calc), TOP_N),
      };
    }

    const allCalcs = {
      ks400b: ks400b_calc,
      ks03a:  ks03a_calc,
      ks500rd: ks500rd_calc,
      ks400b5: ks400b5_calc,
      ks400b6: ks400b6_calc,
      tsg: calc,
    };
    const okFlags = { ks400bOK, ks03aOK, ks500rdOK, ks400b5OK, ks400b6OK, ksb22gOK, ksb80OK };

    const dynamicFixtures = await findDynamicFixtures(partData, allCalcs, okFlags);

    return {
      success: true,
      cn: String(cnNumber).trim(),
      part: partData,
      dynamicFixtures: dynamicFixtures,
      calc: {
        A: calc.jawA.toFixed(3),
        B: calc.jawB.toFixed(3),
        C: calc.baseC.toFixed(2),
        D_Limit: MAX_JAW_DEPTH.toFixed(2),
        AA: calc.bpAA.toFixed(2),
        BB: calc.bpBB.toFixed(2),
        chuteA: calc.chuteCalcA.toFixed(2),
        chuteB: calc.chuteCalcB.toFixed(2),
        chuteC: calc.chuteCalcC.toFixed(2),
        chuteD: calc.chuteCalcD.toFixed(2),
        carrierA: calc.carrierCalcA.toFixed(2),
        carrierB: calc.carrierCalcB.toFixed(2),
        carrierC: calc.carrierCalcC.toFixed(2),
      },
      jaws:         topNPerMachine(allJawMatches, TOP_N),
      bps:          topNPerMachine(allBpMatches, TOP_N),
      chutes:       topNPerMachine(allChuteMatches, TOP_N),
      carriersZNC:  topNPerMachine(allCarrierZncMatches, TOP_N),
      carriersW:    topNPerMachine(allCarrierWMatches, TOP_N),
      ks400b:  ks400b_results,
      ks03a:   ks03a_results,
      ks500rd: ks500rd_results,
      ks400b5: ks400b5_results,
      ks400b6: ks400b6_results,
    };

  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = { findFixtures };

