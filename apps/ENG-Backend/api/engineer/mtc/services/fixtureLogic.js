'use strict';

const { fetchSpecRow, mapPartData, computeDerivedFlags, buildCalcMap } = require('./partDataMapper');
const { computeOkFlags, fetchToolingRows } = require('./machineQueryService');
const { assembleResults } = require('./fixtureAssembler');
const { findDynamicFixtures } = require('./dynamicLogic');
const FormulaService = require('./FormulaService');

const MAX_JAW_DEPTH = 10.0;

async function findFixtures(cnNumber) {
  try {
    const row = await fetchSpecRow(cnNumber);
    const partData = computeDerivedFlags(mapPartData(row));

    const [dynKSB22G, dynTSG300ZNC, dynKS400B, dynKS03A, dynKS500RD, dynKS400B5, dynKS400B6] = await Promise.all([
      FormulaService.calculateMachineParams('KS-B22G',    partData),
      FormulaService.calculateMachineParams('TSG-300ZNC', partData),
      FormulaService.calculateMachineParams('KS400B',     partData),
      FormulaService.calculateMachineParams('KS-03A',     partData),
      FormulaService.calculateMachineParams('KS500RD',    partData),
      FormulaService.calculateMachineParams('KS-400B5',   partData),
      FormulaService.calculateMachineParams('KS400B6',    partData),
    ]);

    const calcs   = buildCalcMap({ dynKSB22G, dynTSG300ZNC, dynKS400B, dynKS03A, dynKS500RD, dynKS400B5, dynKS400B6 }, partData);
    const okFlags = computeOkFlags(calcs.calc, calcs, partData);
    const rows    = await fetchToolingRows(okFlags, calcs.calc);
    const results = assembleResults(rows, okFlags, calcs, partData);

    const dynamicFixtures = await findDynamicFixtures(partData, {
      ks400b:  calcs.ks400b_calc,
      ks03a:   calcs.ks03a_calc,
      ks500rd: calcs.ks500rd_calc,
      ks400b5: calcs.ks400b5_calc,
      ks400b6: calcs.ks400b6_calc,
      tsg:     calcs.calc,
    }, okFlags);

    const calc = calcs.calc;
    return {
      success: true,
      cn: String(cnNumber).trim(),
      part: partData,
      dynamicFixtures,
      calc: {
        A:        calc.jawA.toFixed(3),
        B:        calc.jawB.toFixed(3),
        C:        calc.baseC.toFixed(2),
        D_Limit:  MAX_JAW_DEPTH.toFixed(2),
        AA:       calc.bpAA.toFixed(2),
        BB:       calc.bpBB.toFixed(2),
        chuteA:   calc.chuteCalcA.toFixed(2),
        chuteB:   calc.chuteCalcB.toFixed(2),
        chuteC:   calc.chuteCalcC.toFixed(2),
        chuteD:   calc.chuteCalcD.toFixed(2),
        carrierA: calc.carrierCalcA.toFixed(2),
        carrierB: calc.carrierCalcB.toFixed(2),
        carrierC: calc.carrierCalcC.toFixed(2),
      },
      ...results,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = { findFixtures };
