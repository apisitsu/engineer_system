'use strict';

const { engPool } = require('../../../../instance/eng_db');
const {
  calculateToolingParams, calculateKS400B_Params,
  calculateKS03A_Params, calculateKS500RD_Params,
  calculateKS400B5_Params, calculateKS400B6_Params,
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

const TOP_N = 2;
const MAX_JAW_DEPTH = 10.0;
const h = name => name;

async function findFixtures(cnNumber) {
  try {
    const partResult = await engPool.query(
      `SELECT * FROM spec_process WHERE TRIM(cn) = $1 LIMIT 1`,
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

    const calc        = calculateToolingParams(partData);
    const ks400b_calc = calculateKS400B_Params(partData);

    const [ksb22g, ksb80, tsg300, ks03a, ks400b, ks500rd, ks400b5, ks400b6] = await Promise.all([
      engPool.query(`
        SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
               dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C", dim_d AS "Dim_D",
               machine AS "Machine" FROM tooling_ksb22g`),
      engPool.query(`
        SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
               dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C",
               dim_d AS "Dim_D", dim_e AS "Dim_E",
               machine AS "Machine" FROM tooling_ksb80`),
      engPool.query(`
        SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
               dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C", dim_d AS "Dim_D",
               dim_e AS "Dim_E", dim_f AS "Dim_F", dim_g AS "Dim_G",
               machine AS "Machine" FROM tooling_tsg300`),
      engPool.query(`
        SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
               dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C", dim_d AS "Dim_D",
               dim_e AS "Dim_E", dim_f AS "Dim_F", dim_g AS "Dim_G", dim_h AS "Dim_H",
               dim_i AS "Dim_I", dim_j AS "Dim_J", dim_k AS "Dim_K", dim_l AS "Dim_L",
               dim_m AS "Dim_M", dim_n AS "Dim_N", dim_o AS "Dim_O", dim_p AS "Dim_P",
               dim_q AS "Dim_Q", dim_r AS "Dim_R", dim_s AS "Dim_S", dim_t AS "Dim_T",
               dim_u AS "Dim_U", dim_v AS "Dim_V", machine AS "Machine" FROM tooling_ks03a`),
      engPool.query(`
        SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
               dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C",
               dim_d AS "Dim_D", dim_e AS "Dim_E", dim_f AS "Dim_F",
               machine AS "Machine" FROM tooling_ks400b`),
      engPool.query(`
        SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
               dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C", dim_d AS "Dim_D",
               dim_e AS "Dim_E", dim_f AS "Dim_F", dim_g AS "Dim_G", dim_h AS "Dim_H",
               machine AS "Machine" FROM tooling_ks500rd`),
      engPool.query(`
        SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
               dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C", dim_d AS "Dim_D",
               dim_e AS "Dim_E", dim_f AS "Dim_F", dim_g AS "Dim_G", dim_h AS "Dim_H",
               dim_i AS "Dim_I", dim_j AS "Dim_J", dim_k AS "Dim_K", dim_l AS "Dim_L",
               dim_m AS "Dim_M", dim_n AS "Dim_N", dim_o AS "Dim_O", dim_p AS "Dim_P",
               dim_q AS "Dim_Q", dim_r AS "Dim_R", dim_s AS "Dim_S", dim_t AS "Dim_T",
               dim_u AS "Dim_U", dim_v AS "Dim_V", dim_w AS "Dim_W", dim_x AS "Type"
               FROM tooling_ks400b5`),
      engPool.query(`
        SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
               dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C", dim_d AS "Dim_D",
               dim_e AS "Dim_E", dim_f AS "Dim_F", dim_g AS "Dim_G", dim_h AS "Dim_H",
               dim_i AS "Dim_I", dim_j AS "Dim_J", dim_k AS "Dim_K", dim_l AS "Dim_L",
               dim_m AS "Dim_M", dim_n AS "Dim_N", dim_o AS "Dim_O", dim_p AS "Dim_P",
               dim_q AS "Dim_Q", dim_r AS "Dim_R", dim_s AS "Dim_S", dim_t AS "Dim_T",
               dim_u AS "Dim_U", dim_v AS "Dim_V", dim_w AS "Dim_W", dim_x AS "Type"
               FROM tooling_ks400b6`),
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
    const ksb22gOK = calc.jawA <= 38 && partData.idAft >= 4.8 && partData.idAft < 16 && partData.wAft >= 14;
    if (ksb22gOK) {
      allJawMatches.push(...searchKSB22G_Jaws(ksb22gRows, h, 'KS-B22G', calc, MAX_JAW_DEPTH));
      allBpMatches.push(...searchKSB22G_BackPlates(ksb22gRows, h, 'KS-B22G', calc));
    }

    const ksb80OK = calc.jawA > 15 && calc.jawA <= 70 && partData.idAft >= 7.9 && partData.wAft >= 14;
    if (ksb80OK) {
      allJawMatches.push(...searchKSB80_Jaws(ksb80Rows, h, 'KS-B80', calc, MAX_JAW_DEPTH));
      allBpMatches.push(...searchKSB80_BackPlates(ksb80Rows, h, 'KS-B80', calc));
    }

    const allChuteMatches      = searchTSG_Chutes(tsg300Rows, h, 'TSG-300', calc);
    const allCarrierZncMatches = searchTSG300_Carriers(tsg300Rows, h, 'TSG-300', calc);
    const allCarrierWMatches   = searchTSG300W_Carriers(tsg300Rows, h, 'TSG-300', calc);

    let ks03a_results = {};
    const ks03aOK = partData.odAft <= 33;
    if (ks03aOK) {
      const targetMachine = partData.idAft >= 12.0 ? 'KS-B22RD' : 'KS-03A';
      const ks03a_calc = calculateKS03A_Params(partData);
      if (!ks03a_calc.error) {
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
    }

    let ks400b_results = { calc: ks400b_calc };
    if (!ks400b_calc.error) {
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
    const ks500rdOK = partData.idAft >= 14 && partData.idAft <= 38.125 &&
                      partData.odAft >= 26 && partData.odAft <= 59.531 &&
                      partData.wAft >= 23.5 && partData.wAft <= 51.15;
    if (ks500rdOK) {
      const ks500rd_calc = calculateKS500RD_Params(partData);
      if (!ks500rd_calc.error) {
        ks500rd_results = {
          calc: ks500rd_calc,
          loadingPintles: topNPerMachine(searchKS500RD_LoadingPintle(ks500rdRows, h, 'KS500RD', ks500rd_calc), TOP_N),
          workDrivers:    topNPerMachine(searchKS500RD_WorkDriver(ks500rdRows, h, 'KS500RD', ks500rd_calc), TOP_N),
          frontShoes: !ks500rd_calc.error ? [{ no: ks500rd_calc.fs.No, machine: 'KS500RD', val1: '-', val2: '-', val3: '-' }] : [],
        };
      }
    }

    let ks400b5_results = {};
    const ks400b5_calc = calculateKS400B5_Params(partData);
    if (!ks400b5_calc.error) {
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
    const ks400b6_calc = calculateKS400B6_Params(partData);
    if (!ks400b6_calc.error) {
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

    const dynamicFixtures = await findDynamicFixtures(partData);

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
