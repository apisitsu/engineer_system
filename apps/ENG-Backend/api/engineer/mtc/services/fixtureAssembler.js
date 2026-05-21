'use strict';

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

const TOP_N = 2;
const MAX_JAW_DEPTH = 10.0;
// idAft threshold: KS-03A results are relabelled KS-B22RD when idAft >= this value.
// Frontend reads machineName from ks03a_results — do NOT duplicate this threshold there.
const KS03A_B22RD_ID_THRESHOLD = 12.0;
const h = name => name;

function assembleResults(rows, okFlags, calcs, partData) {
  const { ksb22gOK, ksb80OK, ks03aOK, ks400bOK, ks500rdOK, ks400b5OK, ks400b6OK } = okFlags;
  const { calc, ks03a_calc, ks400b_calc, ks500rd_calc, ks400b5_calc, ks400b6_calc } = calcs;
  const { ksb22g, ksb80, tsg300, ks03a, ks400b, ks500rd, ks400b5, ks400b6 } = rows;

  // ── KS-B22G ───────────────────────────────────────────────────────────────
  let ksb22g_results = {};
  if (ksb22gOK) {
    ksb22g_results = {
      jaws: topNPerMachine(searchKSB22G_Jaws(ksb22g, h, 'KS-B22G', calc, MAX_JAW_DEPTH), TOP_N),
      bps:  topNPerMachine(searchKSB22G_BackPlates(ksb22g, h, 'KS-B22G', calc), TOP_N),
    };
  }

  // ── KS-B80 ────────────────────────────────────────────────────────────────
  let ksb80_results = {};
  if (ksb80OK) {
    ksb80_results = {
      jaws: topNPerMachine(searchKSB80_Jaws(ksb80, h, 'KS-B80', calc, MAX_JAW_DEPTH), TOP_N),
      bps:  topNPerMachine(searchKSB80_BackPlates(ksb80, h, 'KS-B80', calc), TOP_N),
    };
  }

  // ── TSG300 ────────────────────────────────────────────────────────────────
  const allChuteMatches      = searchTSG_Chutes(tsg300, h, 'TSG-300', calc);
  const allCarrierZncMatches = searchTSG300_Carriers(tsg300, h, 'TSG-300', calc);
  const allCarrierWMatches   = searchTSG300W_Carriers(tsg300, h, 'TSG-300', calc);

  // ── KS03A ─────────────────────────────────────────────────────────────────
  let ks03a_results = {};
  if (ks03aOK) {
    const targetMachine = partData.idAft >= KS03A_B22RD_ID_THRESHOLD ? 'KS-B22RD' : 'KS-03A';
    ks03a_results = {
      machineName: targetMachine,
      calc: ks03a_calc,
      rollerShoes:    topNPerMachine(searchKS03A_RollerShoe(ks03a, h, targetMachine, ks03a_calc), TOP_N),
      cpxShoes:       topNPerMachine(searchKS03A_CPXShoe(ks03a, h, targetMachine, ks03a_calc), TOP_N),
      chuteCovers:    topNPerMachine(searchKS03A_ChuteCover(ks03a, h, targetMachine, ks03a_calc), TOP_N),
      frontPlates:    topNPerMachine(searchKS03A_FrontPlate(ks03a, h, targetMachine, ks03a_calc), TOP_N),
      settingGauges:  topNPerMachine(searchKS03A_SettingGauge(ks03a, h, targetMachine, ks03a_calc), TOP_N),
      masterRings:    topNPerMachine(searchKS03A_MasterRing(ks03a, h, targetMachine, ks03a_calc), TOP_N),
      plugGauges:     topNPerMachine(searchKS03A_PlugGauge(ks03a, h, targetMachine, ks03a_calc), TOP_N),
      loader:         topNPerMachine(searchKS03A_Loader(ks03a, h, targetMachine, ks03a_calc), TOP_N),
      pressureRotors: topNPerMachine(searchKS03A_PressureRotor(ks03a, h, targetMachine, ks03a_calc), TOP_N),
    };
  }

  // ── KS400B ────────────────────────────────────────────────────────────────
  let ks400b_results = { calc: ks400b_calc };
  if (ks400bOK) {
    ks400b_results = {
      calc: ks400b_calc,
      workDrivers:   topNPerMachine(searchKS400B_WorkDriver(ks400b, h, 'KS400B', ks400b_calc), TOP_N),
      supportBlocks: topNPerMachine(searchKS400B_SupportBlock(ks400b, h, 'KS400B', ks400b_calc), TOP_N),
      loadingChutes: topNPerMachine(searchKS400B_LoadingChute(ks400b, h, 'KS400B', ks400b_calc), TOP_N),
      plugsA:        topNPerMachine(searchKS400B_PlugA(ks400b, h, 'KS400B', ks400b_calc), TOP_N),
      plugsB:        topNPerMachine(searchKS400B_PlugB(ks400b, h, 'KS400B', ks400b_calc), TOP_N),
    };
  }

  // ── KS500RD ───────────────────────────────────────────────────────────────
  let ks500rd_results = {};
  if (ks500rdOK) {
    ks500rd_results = {
      calc: ks500rd_calc,
      loadingPintles: topNPerMachine(searchKS500RD_LoadingPintle(ks500rd, h, 'KS500RD', ks500rd_calc), TOP_N),
      workDrivers:    topNPerMachine(searchKS500RD_WorkDriver(ks500rd, h, 'KS500RD', ks500rd_calc), TOP_N),
      frontShoes: [{ no: ks500rd_calc.fs.No, machine: 'KS500RD', val1: '-', val2: '-', val3: '-' }],
    };
  }

  // ── KS400B5 ───────────────────────────────────────────────────────────────
  let ks400b5_results = {};
  if (ks400b5OK) {
    ks400b5_results = {
      calc: ks400b5_calc,
      workClamps:      topNPerMachine(searchKS400B5_Tool(ks400b5, h, 'KS400B5', 'WORK CLAMP',  ks400b5_calc.workClamp), TOP_N),
      shafts:          topNPerMachine(searchKS400B5_Tool(ks400b5, h, 'KS400B5', 'SHAFT',       ks400b5_calc.shaft), TOP_N),
      workChutes:      topNPerMachine(searchKS400B5_Tool(ks400b5, h, 'KS400B5', 'WORK CHUTE',  ks400b5_calc.workChute), TOP_N),
      workLoaders:     topNPerMachine(searchKS400B5_Tool(ks400b5, h, 'KS400B5', 'WORK LOADER', ks400b5_calc.workLoader), TOP_N),
      workChucks:      topNPerMachine(searchKS400B5_Tool(ks400b5, h, 'KS400B5', 'WORK CHUCK',  ks400b5_calc.workChuck), TOP_N),
      workHolders:     topNPerMachine(searchKS400B5_Tool(ks400b5, h, 'KS400B5', 'WORK HOLDER', ks400b5_calc.workHolder), TOP_N),
      chuckJaws:       topNPerMachine(searchKS400B5_Tool(ks400b5, h, 'KS400B5', 'CHUCK JAW',   ks400b5_calc.chuckJaw), TOP_N),
      workChuteGuides: topNPerMachine(searchKS400B5_Tool(ks400b5, h, 'KS400B5', 'CHUTE GUIDE', ks400b5_calc.workChuteGuide), TOP_N),
      stoppers:        topNPerMachine(searchKS400B5_Tool(ks400b5, h, 'KS400B5', 'STOPPER',     ks400b5_calc.stopper), TOP_N),
      masterRings:     topNPerMachine(searchKS400B5_Tool(ks400b5, h, 'KS400B5', 'MASTER RING', ks400b5_calc.masterRingForJaw), TOP_N),
    };
  }

  // ── KS400B6 ───────────────────────────────────────────────────────────────
  let ks400b6_results = {};
  if (ks400b6OK) {
    ks400b6_results = {
      calc: ks400b6_calc,
      workDrivers:   topNPerMachine(searchKS400B6_WorkDriver(ks400b6, h, 'KS400B6', ks400b6_calc), TOP_N),
      loadingChutes: topNPerMachine(searchKS400B6_LoadingChute(ks400b6, h, 'KS400B6', ks400b6_calc), TOP_N),
      plugs:         topNPerMachine(searchKS400B6_Plug(ks400b6, h, 'KS400B6', ks400b6_calc), TOP_N),
      workGuides:    topNPerMachine(searchKS400B6_WorkGuide(ks400b6, h, 'KS400B6', ks400b6_calc), TOP_N),
      workPushers:   topNPerMachine(searchKS400B6_WorkPusher(ks400b6, h, 'KS400B6', ks400b6_calc), TOP_N),
      stockerChutes: topNPerMachine(searchKS400B6_StockerChute(ks400b6, h, 'KS400B6', ks400b6_calc), TOP_N),
      frontShoes:    topNPerMachine(searchKS400B6_FrontShoe(ks400b6, h, 'KS400B6', ks400b6_calc), TOP_N),
      rearShoes:     topNPerMachine(searchKS400B6_RearShoe(ks400b6, h, 'KS400B6', ks400b6_calc), TOP_N),
      pilotPins:     topNPerMachine(searchKS400B6_PilotPin(ks400b6, h, 'KS400B6', ks400b6_calc), TOP_N),
    };
  }

  return {
    ksb22g:      ksb22g_results,
    ksb80:       ksb80_results,
    chutes:      topNPerMachine(allChuteMatches, TOP_N),
    carriersZNC: topNPerMachine(allCarrierZncMatches, TOP_N),
    carriersW:   topNPerMachine(allCarrierWMatches, TOP_N),
    ks400b:  ks400b_results,
    ks03a:   ks03a_results,
    ks500rd: ks500rd_results,
    ks400b5: ks400b5_results,
    ks400b6: ks400b6_results,
  };
}

module.exports = { assembleResults, MAX_JAW_DEPTH };
