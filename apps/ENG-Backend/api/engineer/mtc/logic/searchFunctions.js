'use strict';

const TOP_N_PER_MACHINE = 2;

function topNPerMachine(matches, n) {
  const groups = {};
  matches.forEach(m => {
    if (!groups[m.machine]) groups[m.machine] = [];
    groups[m.machine].push(m);
  });
  const result = [];
  Object.keys(groups).sort().forEach(machine => {
    groups[machine].sort((a, b) => (a._diff || 0) - (b._diff || 0));
    const top = groups[machine].slice(0, n);
    top.forEach(item => {
      const { _diff, _diffA, _diffB, _diffC, _diffD, _diffE, _totalDiff, ...rest } = item;
      result.push(rest);
    });
  });
  return result;
}

// ── KSB22G ──────────────────────────────────────────────────────────────────

function searchKSB22G_Jaws(fixData, h, sheetName, calc, maxDepth) {
  const MIN_JAW_DEPTH = 4.5;
  const JAW_WIDTH_MAX_MARGIN = 10.0;
  const reqC = calc.baseC ? Math.ceil(calc.baseC * 2) / 2 : 30;
  return fixData.filter(row => {
    const toolType = String(row[h('Tooling_name')]).toUpperCase();
    if (!toolType.includes('JAW')) return false;
    const fixA = parseFloat(row[h('JawID_1_A')]);
    const fixD = parseFloat(row[h('JawDepth_Max_D')]);
    const clearance = Math.round((fixA - calc.jawA) * 1000) / 1000;
    if (clearance < -0.015 || clearance > 0.05) return false;
    if (!isNaN(fixD) && fixD > maxDepth) return false;
    if (!isNaN(fixD) && fixD < MIN_JAW_DEPTH) return false;
    const fixC = parseFloat(row[h('JawWidth_Max_C')]);
    if (!isNaN(fixC) && fixC > reqC + JAW_WIDTH_MAX_MARGIN) return false;
    return true;
  }).map(row => ({
    no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
    val1: row[h('JawID_1_A')], val2: row[h('JawID_2_B')], val3: row[h('JawWidth_Max_C')],
    valD: row[h('JawDepth_Max_D')] || '-', valE: '-',
    _diff: Math.abs(parseFloat(row[h('JawID_1_A')]) - calc.jawA)
  })).sort((a, b) => {
    const diffC_A = Math.abs(parseFloat(a.val3) - reqC);
    const diffC_B = Math.abs(parseFloat(b.val3) - reqC);
    return diffC_A !== diffC_B ? diffC_A - diffC_B : a._diff - b._diff;
  });
}

function searchKSB22G_BackPlates(fixData, h, sheetName, calc) {
  const reqAA = calc.bpAA;
  const minPCD = calc.bpBB;
  return fixData.filter(row => {
    const toolType = String(row[h('Tooling_name')]).toUpperCase();
    if (!toolType.includes('BACK PLATE')) return false;
    const sheetID = parseFloat(row[h('BackPlateID_A')]);
    const sheetPCD = parseFloat(row[h('BackPlatePCD_B')]);
    if (sheetID < reqAA || sheetID > reqAA + 2.5) return false;
    if (isNaN(sheetPCD) || sheetPCD < minPCD) return false;
    return true;
  }).map(row => ({
    no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
    val1: row[h('BackPlateID_A')], val2: row[h('BackPlatePCD_B')],
    _diff: Math.abs(parseFloat(row[h('BackPlateID_A')]) - reqAA)
  })).sort((a, b) => a._diff - b._diff);
}

// ── KSB80 ────────────────────────────────────────────────────────────────────

function searchKSB80_Jaws(fixData, h, sheetName, calc, maxDepth) {
  const MIN_JAW_DEPTH = 6.0;
  const JAW_WIDTH_MAX_MARGIN = 10.0;
  const reqC = Math.ceil(calc.baseC * 2) / 2;
  let reqE = null;
  if (calc.jawA > 54 && calc.jawA <= 70) {
    reqE = Math.ceil((calc.jawA + 2.5) * 2) / 2;
  }
  return fixData.filter(row => {
    const toolType = String(row[h('Tooling_name')]).toUpperCase();
    if (!toolType.includes('JAW')) return false;
    const fixA = parseFloat(row[h('JawID_1_A')]);
    const fixD = parseFloat(row[h('JawDepth_Max_D')]);
    const clearance = Math.round((fixA - calc.jawA) * 1000) / 1000;
    if (clearance < -0.015 || clearance > 0.05) return false;
    if (!isNaN(fixD) && fixD > maxDepth) return false;
    if (!isNaN(fixD) && fixD < MIN_JAW_DEPTH) return false;
    const fixC = parseFloat(row[h('JawWidth_Max_C')]);
    if (!isNaN(fixC) && fixC > reqC + JAW_WIDTH_MAX_MARGIN) return false;
    if (reqE !== null) {
      const fixE = parseFloat(row[h('Jaw_E')]);
      if (isNaN(fixE) || fixE < reqE) return false;
    }
    return true;
  }).map(row => ({
    no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
    val1: row[h('JawID_1_A')], val2: row[h('JawID_2_B')], val3: row[h('JawWidth_Max_C')],
    valD: row[h('JawDepth_Max_D')] || '-', valE: row[h('Jaw_E')] || '-',
    _diff: Math.abs(parseFloat(row[h('JawID_1_A')]) - calc.jawA)
  })).sort((a, b) => {
    const diffC_A = Math.abs(parseFloat(a.val3) - reqC);
    const diffC_B = Math.abs(parseFloat(b.val3) - reqC);
    return diffC_A !== diffC_B ? diffC_A - diffC_B : a._diff - b._diff;
  });
}

function searchKSB80_BackPlates(fixData, h, sheetName, calc) {
  let reqAA = 0, minPCD = 0, maxPCD = 100.0, checkPCD = true;
  if (calc.jawA <= 54) {
    reqAA = parseFloat((calc.ID_part + 0.3).toFixed(2));
    minPCD = Math.ceil((reqAA + 1.0) * 10) / 10;
  } else {
    reqAA = parseFloat((calc.ID_part + 0.6).toFixed(2));
    checkPCD = false;
  }
  return fixData.filter(row => {
    const toolType = String(row[h('Tooling_name')]).toUpperCase();
    if (!toolType.includes('BACK PLATE')) return false;
    const sheetID = parseFloat(row[h('BackPlateID_A')]);
    const sheetPCD = parseFloat(row[h('BackPlatePCD_B')]);
    if (sheetID < reqAA || sheetID > reqAA + 2.5) return false;
    if (checkPCD && (isNaN(sheetPCD) || sheetPCD < minPCD || sheetPCD > maxPCD)) return false;
    return true;
  }).map(row => ({
    no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
    val1: row[h('BackPlateID_A')], val2: row[h('BackPlatePCD_B')],
    _diff: Math.abs(parseFloat(row[h('BackPlateID_A')]) - reqAA)
  })).sort((a, b) => a._diff - b._diff);
}

// ── TSG-300 ──────────────────────────────────────────────────────────────────

function searchTSG_Chutes(fixData, h, sheetName, calc) {
  const CHUTE_B_MAX_EXCESS = 3.0;
  return fixData.filter(row => {
    const toolType = String(row[h('Tooling_name')]).toUpperCase();
    if (!toolType.includes('CHUTE')) return false;
    const sA = parseFloat(row[h('Face_Chute_A')]);
    const sB = parseFloat(row[h('Face_Chute_B')]);
    if (isNaN(sA) || isNaN(sB)) return false;
    if (sA < calc.chuteCalcA || sA > (calc.chuteCalcA + 1.0)) return false;
    if (sB < calc.chuteCalcB) return false;
    if (sB > calc.chuteCalcB + CHUTE_B_MAX_EXCESS) return false;
    return true;
  }).map(row => {
    const sA = parseFloat(row[h('Face_Chute_A')]);
    const sB = parseFloat(row[h('Face_Chute_B')]);
    return {
      no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
      valA: row[h('Face_Chute_A')], valB: row[h('Face_Chute_B')],
      valC: row[h('Face_Chute_C')], valD: row[h('Face_Chute_D')],
      _diff: Math.abs(sA - calc.chuteCalcA) + Math.abs(sB - calc.chuteCalcB)
    };
  });
}

function searchTSG300_Carriers(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const toolType = String(row[h('Tooling_name')]).toUpperCase();
    const isW_Machine = String(row[h('Machine')]).toUpperCase().includes('TSG300W');
    if (!toolType.includes('CARRIER') || isW_Machine) return false;
    const sDepth = parseFloat(row[h('Face_Carrier_D')]);
    const sA = parseFloat(row[h('Face_Carrier_A')]);
    const sLength = parseFloat(row[h('Face_Carrier_C')]);
    const CARRIER_A_MAX_EXCESS = 1.0;
    if (isNaN(sDepth) || sDepth > calc.maxCarrierD) return false;
    if (isNaN(sA) || sA < calc.carrierCalcA) return false;
    if (sA > calc.carrierCalcA + CARRIER_A_MAX_EXCESS) return false;
    if (isNaN(sLength) || sLength < calc.carrierCalcC) return false;
    return true;
  }).map(row => {
    const sA = parseFloat(row[h('Face_Carrier_A')]);
    const sDepth = parseFloat(row[h('Face_Carrier_D')]);
    return {
      no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
      valA: row[h('Face_Carrier_A')], valB: row[h('Face_Carrier_B')],
      valC: row[h('Face_Carrier_C')], valD: row[h('Face_Carrier_D')],
      _diff: (Math.abs(sA - calc.carrierCalcA) * 10000) - sDepth
    };
  });
}

function searchTSG300W_Carriers(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const toolType = String(row[h('Tooling_name')]).toUpperCase();
    const isW_Machine = String(row[h('Machine')]).toUpperCase().includes('TSG300W');
    if (!toolType.includes('CARRIER') || !isW_Machine) return false;
    const sA = parseFloat(row[h('Face_Carrier_A')]);
    const sE = parseFloat(row[h('Face_Carrier_E')]);
    if (isNaN(sA) || isNaN(sE)) return false;
    if (sA < calc.tsgW_Amin || sA > calc.tsgW_Amax) return false;
    if (sE < calc.tsgW_Emin || sE > calc.tsgW_Emax) return false;
    return true;
  }).map(row => {
    const sA = parseFloat(row[h('Face_Carrier_A')]);
    const sE = parseFloat(row[h('Face_Carrier_E')]);
    return {
      no: row[h('Tooling_no')], machine: row[h('Machine')],
      valA: row[h('Face_Carrier_A')], valB: row[h('Face_Carrier_E')],
      valC: '-', valD: '-',
      _diff: (Math.abs(sA - calc.tsgW_Amin) * 10000) - sE
    };
  });
}

// ── KS400B ───────────────────────────────────────────────────────────────────

const KS400B_OD_MAX = 32;
const KS400B_W_MAX = 30;

function searchKS400B_WorkDriver(fixData, h, sheetName, calc) {
  if (calc.od_turning > KS400B_OD_MAX || calc.w_aft > KS400B_W_MAX) return [];
  return fixData.filter(row => String(row[h('Tooling_name')]).toUpperCase().includes('WORK DRIVER'))
    .map(row => {
      const fixA = parseFloat(row[h('OD_A')]);
      const fixB = parseFloat(row[h('ID_B')]);
      const fixE = parseFloat(row[h('Width_E')]);
      if (isNaN(fixA) || isNaN(fixB)) return { _diff: 99999, _diffA: 99999, _diffB: 99999, _diffE: 99999 };
      const diffA = Math.abs(fixA - calc.wd_A);
      const diffB = Math.abs(fixB - calc.wd_B);
      const diffE = (calc.wd_E && !isNaN(fixE)) ? Math.abs(fixE - calc.wd_E) : 0;
      let penalty = 0;
      if (diffA > 1.01) penalty += 10000;
      if (diffB > 1.01) penalty += 10000;
      return {
        no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
        val1: row[h('OD_A')], val2: row[h('ID_B')], val3: row[h('OD_C')],
        val4: row[h('OD_D')], val5: row[h('Width_E')],
        _diffA: diffA + penalty, _diffB: diffB, _diffE: diffE, _diff: diffA + penalty
      };
    }).sort((a, b) => {
      if (Math.abs(a._diffA - b._diffA) > 0.001) return a._diffA - b._diffA;
      if (Math.abs(a._diffB - b._diffB) > 0.001) return a._diffB - b._diffB;
      return a._diffE - b._diffE;
    });
}

function searchKS400B_LoadingChute(fixData, h, sheetName, calc) {
  if (calc.od_turning > KS400B_OD_MAX || calc.w_aft > KS400B_W_MAX) return [];
  return fixData.filter(row => {
    const toolType = String(row[h('Tooling_name')]).toUpperCase();
    return toolType.includes('LOADING CHUTE') || toolType.includes('CHUTE');
  }).map(row => {
    const fixA = parseFloat(row[h('LOADING_CHUTE_A')]);
    const fixC = parseFloat(row[h('LOADING_CHUTE_C')]);
    const fixD = parseFloat(row[h('LOADING_CHUTE_D')]);
    let penalty = 0, diffA = 999, diffC = 999, diffD = 999;
    if (!isNaN(fixC) && calc.lc_C !== undefined) {
      if (fixC < calc.lc_C - 0.01) penalty += 10000;
      diffC = Math.abs(fixC - calc.lc_C);
    }
    if (!isNaN(fixD) && calc.lc_D !== undefined) {
      if (fixD < calc.lc_D - 0.01) penalty += 10000;
      diffD = Math.abs(fixD - calc.lc_D);
    }
    if (!isNaN(fixA) && calc.lc_A !== undefined) diffA = Math.abs(fixA - calc.lc_A);
    return {
      no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
      val1: row[h('LOADING_CHUTE_A')], val2: row[h('LOADING_CHUTE_B')],
      val3: row[h('LOADING_CHUTE_C')], val4: row[h('LOADING_CHUTE_D')],
      val5: row[h('LOADING_CHUTE_E')], val6: row[h('LOADING_CHUTE_F')],
      _diff: penalty + diffD + (diffC / 100) + (diffA / 10000)
    };
  }).sort((a, b) => a._diff - b._diff);
}

function searchKS400B_SupportBlock(fixData, h, sheetName, calc) {
  if (calc.od_turning > KS400B_OD_MAX || calc.w_aft > KS400B_W_MAX) return [];
  return fixData.filter(row => String(row[h('Tooling_name')]).toUpperCase().includes('SUPPORT BLOCK'))
    .map(row => {
      const fixA = parseFloat(row[h('SUPPORT_BLOCK_A')]);
      const fixB = parseFloat(row[h('SUPPORT_BLOCK_B')]);
      const fixC = parseFloat(row[h('SUPPORT_BLOCK_C')]);
      const fixD = parseFloat(row[h('SUPPORT_BLOCK_D')]);
      const fixE = parseFloat(row[h('SUPPORT_BLOCK_E')]);
      if (isNaN(fixA) || isNaN(fixB) || isNaN(fixC) || isNaN(fixD) || isNaN(fixE)) {
        return { _diffB: 99999, _diffA: 99999, _diffC: 99999, _diff: 99999 };
      }
      let penalty = 0;
      const diffA_real = fixA - calc.sb_A;
      if (diffA_real < -0.01 || diffA_real > 0.51) penalty += 10000;
      const diffC_real = fixC - calc.sb_C;
      if (diffC_real < -0.01 || diffC_real > 0.21) penalty += 10000;
      if (Math.abs(fixD - calc.sb_D) > 0.51) penalty += 10000;
      const diffE_real = fixE - calc.sb_E;
      if (diffE_real < -0.01 || diffE_real > 0.51) penalty += 10000;
      const diffB_abs = Math.abs(fixB - calc.sb_B);
      if (diffB_abs > 0.51) penalty += 10000;
      return {
        no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
        val1: row[h('SUPPORT_BLOCK_A')], val2: row[h('SUPPORT_BLOCK_B')],
        val3: row[h('SUPPORT_BLOCK_C')], val4: row[h('SUPPORT_BLOCK_D')], val5: row[h('SUPPORT_BLOCK_E')],
        _diffB: penalty + diffB_abs, _diffA: Math.abs(diffA_real), _diffC: Math.abs(diffC_real),
        _diff: penalty + diffB_abs
      };
    }).sort((a, b) => {
      if (Math.abs(a._diffB - b._diffB) > 0.001) return a._diffB - b._diffB;
      if (Math.abs(a._diffA - b._diffA) > 0.001) return a._diffA - b._diffA;
      return a._diffC - b._diffC;
    });
}

function searchKS400B_PlugA(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const toolType = String(row[h('Tooling_name')]).toUpperCase();
    if (!toolType.includes('PLUG(A)')) return false;
    const fixA = parseFloat(row[h('PLUG_A_OD_A')]);
    const fixB = parseFloat(row[h('PLUG_A_OD_B')]);
    const fixC = parseFloat(row[h('PLUG_A_DEPTH_C')]);
    if (isNaN(fixA)) return false;
    if (Math.abs(fixA - calc.pa_A) > 0.5) return false;
    if (!isNaN(fixB) && calc.pa_B !== undefined && Math.abs(fixB - calc.pa_B) > 2.0) return false;
    if (!isNaN(fixC) && calc.pa_C !== undefined && Math.abs(fixC - calc.pa_C) > 5.0) return false;
    return true;
  }).map(row => {
    const fixA = parseFloat(row[h('PLUG_A_OD_A')]);
    const fixB = parseFloat(row[h('PLUG_A_OD_B')]);
    const fixC = parseFloat(row[h('PLUG_A_DEPTH_C')]);
    const fixE = parseFloat(row[h('PLUG_A_DIST_E')]);
    const diffA = isNaN(fixA) ? 100 : Math.abs(fixA - calc.pa_A);
    const diffB = isNaN(fixB) ? 100 : Math.abs(fixB - calc.pa_B);
    const diffC = isNaN(fixC) ? 100 : Math.abs(fixC - calc.pa_C);
    const diffE = isNaN(fixE) ? 100 : Math.abs(fixE - calc.pa_E);
    return {
      no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName, type: calc.pa_type,
      val1: row[h('PLUG_A_OD_A')], val2: row[h('PLUG_A_OD_B')], val3: row[h('PLUG_A_DEPTH_C')],
      val4: row[h('PLUG_A_CHAM_D')], val5: row[h('PLUG_A_DIST_E')], valF: 48,
      _diff: diffA + diffB + diffC + diffE
    };
  }).sort((a, b) => a._diff - b._diff);
}

function searchKS400B_PlugB(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const toolType = String(row[h('Tooling_name')]).toUpperCase();
    return toolType.includes('PLUG(B)') || toolType.includes('PLUG (B)');
  }).map(row => {
    const fixA = parseFloat(row[h('PLUG_B_OD_A')]);
    const fixB = parseFloat(row[h('PLUG_B_OD_B')]);
    const fixC = parseFloat(row[h('PLUG_B_DEPTH_C')]);
    if (isNaN(fixA) || isNaN(fixB)) return { _diffB: 99999, _diffA: 99999, _diffC: 99999, _diff: 99999 };
    const diffB = calc.pb_B !== undefined ? Math.abs(fixB - calc.pb_B) : 0;
    const diffA = calc.pb_A !== undefined ? Math.abs(fixA - calc.pb_A) : 0;
    const diffC = (calc.pb_C !== undefined && !isNaN(fixC)) ? Math.abs(fixC - calc.pb_C) : 0;
    let penalty = 0;
    if (diffB > 1.01) penalty += 10000;
    if (diffA > 1.01) penalty += 10000;
    return {
      no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName, type: calc.pb_type,
      val1: row[h('PLUG_B_OD_A')], val2: row[h('PLUG_B_OD_B')], val3: row[h('PLUG_B_DEPTH_C')],
      val4: row[h('PLUG_B_CHAM_D')], val5: row[h('PLUG_B_DIST_E')], valF: 70,
      _diffB: penalty + diffB, _diffA: diffA, _diffC: diffC, _diff: penalty + diffB
    };
  }).sort((a, b) => {
    if (Math.abs(a._diffB - b._diffB) > 0.001) return a._diffB - b._diffB;
    if (Math.abs(a._diffA - b._diffA) > 0.001) return a._diffA - b._diffA;
    return a._diffC - b._diffC;
  });
}

// ── KS-03A ───────────────────────────────────────────────────────────────────

function searchKS03A_RollerShoe(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase();
    if (!name.includes('ROLLER SHOE')) return false;
    const fixA = parseFloat(row[h('Dim_A')]);
    const fixC = parseFloat(row[h('Dim_C')]);
    if (isNaN(fixA) || Math.abs(fixA - calc.rollerShoe.A) > 1.0) return false;
    if (isNaN(fixC) || Math.abs(fixC - calc.rollerShoe.C) > 1.0) return false;
    return true;
  }).map(row => {
    const a = parseFloat(row[h('Dim_A')]), b = parseFloat(row[h('Dim_B')]);
    const c = parseFloat(row[h('Dim_C')]), d = parseFloat(row[h('Dim_D')]);
    const diffA = isNaN(a) ? 100 : Math.abs(a - calc.rollerShoe.A);
    const diffB = isNaN(b) ? 100 : Math.abs(b - calc.rollerShoe.B);
    const diffC = isNaN(c) ? 100 : Math.abs(c - calc.rollerShoe.C);
    const diffD = isNaN(d) ? 100 : Math.abs(d - calc.rollerShoe.D);
    return {
      no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
      val1: row[h('Dim_A')], val2: row[h('Dim_C')], val3: row[h('Dim_D')], val4: row[h('Dim_B')], val5: row[h('Type')],
      _diff: diffA + diffB + diffC + diffD
    };
  }).sort((a, b) => a._diff - b._diff);
}

function searchKS03A_CPXShoe(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase();
    if (!name.includes('CPX SHOE')) return false;
    const fixA = parseFloat(row[h('Dim_A')]);
    const fixD = parseFloat(row[h('Dim_D')]);
    if (isNaN(fixA) || Math.abs(fixA - calc.cpxShoe.A) > 0.05) return false;
    if (isNaN(fixD) || Math.abs(fixD - calc.cpxShoe.D) > 0.1) return false;
    return true;
  }).map(row => ({
    no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
    val1: row[h('Dim_A')], val2: row[h('Dim_D')], val3: row[h('Dim_C')],
    val4: calc.cpxShoe.V, val5: row[h('Type')],
    _diff: Math.abs(parseFloat(row[h('Dim_A')]) - calc.cpxShoe.A)
  })).sort((a, b) => a._diff - b._diff);
}

function searchKS03A_ChuteCover(fixData, h, sheetName, calc) {
  return fixData.filter(row => String(row[h('Tooling_name')]).toUpperCase().includes('CHUTE COVER'))
    .map(row => {
      const a = parseFloat(row[h('Dim_A')]), b = parseFloat(row[h('Dim_B')]), c = parseFloat(row[h('Dim_C')]);
      let penalty = 0, diffA = 100, diffB = 100, diffC = 100;
      if (!isNaN(a)) { if (a < calc.chute.A - 0.01) penalty += 10000; diffA = Math.abs(a - calc.chute.A); }
      if (!isNaN(b)) { if (b < calc.chute.B - 0.01) penalty += 10000; diffB = Math.abs(b - calc.chute.B); }
      if (!isNaN(c)) diffC = Math.abs(c - calc.chute.C);
      return {
        no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
        val1: row[h('Dim_A')], val2: row[h('Dim_B')], val3: row[h('Dim_C')], val4: '', val5: row[h('Type')],
        _diff: penalty + diffA + diffB + diffC
      };
    }).sort((a, b) => a._diff - b._diff);
}

function searchKS03A_FrontPlate(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase();
    if (!name.includes('FRONT PLATE')) return false;
    const fixA = parseFloat(row[h('Dim_A')]);
    if (isNaN(fixA) || Math.abs(fixA - calc.fp.A) > 0.5) return false;
    return true;
  }).map(row => {
    const a = parseFloat(row[h('Dim_A')]), b = parseFloat(row[h('Dim_B')]), c = parseFloat(row[h('Dim_C')]);
    const diffA = isNaN(a) ? 100 : Math.abs(a - calc.fp.A);
    const diffB = isNaN(b) ? 100 : Math.abs(b - calc.fp.B);
    const diffC = isNaN(c) ? 100 : Math.abs(c - calc.fp.C);
    return {
      no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
      val1: row[h('Dim_A')], val2: row[h('Dim_B')], val3: row[h('Dim_C')], val4: '', val5: row[h('Type')],
      _diff: diffA + diffB + diffC
    };
  }).sort((a, b) => a._diff - b._diff);
}

function searchKS03A_SettingGauge(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase();
    if (!name.includes('SETTING GAUGE')) return false;
    const fixA = parseFloat(row[h('Dim_A')]);
    if (isNaN(fixA) || Math.abs(fixA - calc.sg.A) > 0.5) return false;
    return true;
  }).map(row => ({
    no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
    val1: row[h('Dim_A')], val2: row[h('Dim_B')], val3: row[h('Dim_C')], val4: row[h('Dim_M')], val5: row[h('Type')],
    _diff: Math.abs(parseFloat(row[h('Dim_A')]) - calc.sg.A)
  })).sort((a, b) => a._diff - b._diff);
}

function searchKS03A_MasterRing(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase();
    if (!name.includes('MASTER RING')) return false;
    const fixA = parseFloat(row[h('Dim_A')]);
    if (isNaN(fixA) || Math.abs(fixA - calc.mr.A) > 0.05) return false;
    return true;
  }).map(row => {
    const a = parseFloat(row[h('Dim_A')]), b = parseFloat(row[h('Dim_B')]), c = parseFloat(row[h('Dim_C')]);
    const diffA = isNaN(a) ? 100 : Math.abs(a - calc.mr.A);
    const diffB = isNaN(b) ? 100 : Math.abs(b - calc.mr.B);
    const diffC = isNaN(c) ? 100 : Math.abs(c - calc.mr.C);
    return {
      no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
      val1: row[h('Dim_A')], val2: row[h('Dim_B')], val3: row[h('Dim_C')], val4: '', val5: row[h('Type')],
      _diff: diffA + diffB + diffC
    };
  }).sort((a, b) => a._diff - b._diff);
}

function searchKS03A_PlugGauge(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase();
    if (!name.includes('PLUG GAUGE')) return false;
    const fixA = parseFloat(row[h('Dim_A')]);
    if (isNaN(fixA) || Math.abs(fixA - calc.pg.A) > 0.005) return false;
    return true;
  }).map(row => {
    const a = parseFloat(row[h('Dim_A')]);
    const b_tol = parseFloat(row[h('Dim_B')]);
    const c_tol = parseFloat(row[h('Dim_C')]);
    let totalDiff = Math.abs(a - calc.pg.A);
    if (!isNaN(b_tol) && calc.pg.B !== undefined) totalDiff += Math.abs(b_tol - calc.pg.B);
    else totalDiff += 100;
    if (!isNaN(c_tol) && calc.pg.C !== undefined) totalDiff += Math.abs(c_tol - calc.pg.C);
    else totalDiff += 100;
    return {
      no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
      val1: row[h('Dim_A')], val2: row[h('Dim_B')], val3: row[h('Dim_C')], val4: '', val5: row[h('Type')],
      _diff: totalDiff
    };
  }).sort((a, b) => a._diff - b._diff);
}

function searchKS03A_Loader(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase();
    if (!name.includes('LOADER')) return false;
    const fixA = parseFloat(row[h('Dim_A')]);
    const fixB = parseFloat(row[h('Dim_B')]);
    if (isNaN(fixA) || fixA < calc.ld.A_min || fixA > calc.ld.A_max) return false;
    if (isNaN(fixB) || Math.abs(fixB - calc.ld.B) > 0.5) return false;
    return true;
  }).map(row => {
    const fixA = parseFloat(row[h('Dim_A')]), fixB = parseFloat(row[h('Dim_B')]);
    const fixF = parseFloat(row[h('Dim_F')]);
    const diffB = Math.abs(fixB - calc.ld.B);
    const diffA = Math.abs(fixA - (calc.ld.A_target !== undefined ? calc.ld.A_target : calc.ld.A_min));
    const diffF = (!isNaN(fixF) && calc.ld.F !== undefined) ? Math.abs(fixF - calc.ld.F) : 0;
    return {
      no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
      val1: row[h('Dim_A')], val2: row[h('Dim_B')], val3: row[h('Dim_C')],
      val4: row[h('Dim_D')], val5: row[h('Dim_E')],
      _diff: diffB + (diffA / 100) + (diffF / 1000)
    };
  }).sort((a, b) => a._diff - b._diff);
}

function searchKS03A_PressureRotor(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase();
    if (!name.includes('PRESSURE ROTOR')) return false;
    const fixA = parseFloat(row[h('Dim_A')]);
    if (isNaN(fixA) || Math.abs(fixA - calc.pr.A) > 0.5) return false;
    return true;
  }).map(row => ({
    no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
    val1: row[h('Dim_A')], val2: row[h('Dim_B')] || '-', val3: row[h('Dim_C')] || '-', val4: '', val5: row[h('Type')],
    _diff: Math.abs(parseFloat(row[h('Dim_A')]) - calc.pr.A)
  })).sort((a, b) => a._diff - b._diff);
}

// ── KS500RD ──────────────────────────────────────────────────────────────────

function searchKS500RD_LoadingPintle(fixData, h, sheetName, calc) {
  return fixData.filter(row => String(row[h('Tooling_name')]).toUpperCase().includes('LOADING PINTLE'))
    .map(row => {
      const a = parseFloat(row[h('Dim_A')]), b = parseFloat(row[h('Dim_B')]);
      const c = parseFloat(row[h('Dim_C')]), d = parseFloat(row[h('Dim_D')]);
      const e = parseFloat(row[h('Dim_E')]), f = parseFloat(row[h('Dim_F')]);
      const g = parseFloat(row[h('Dim_G')]), hv = parseFloat(row[h('Dim_H')]);
      const totalDiff =
        (isNaN(a) ? 100 : Math.abs(a - calc.lp.A)) +
        (isNaN(b) ? 100 : Math.abs(b - calc.lp.B)) +
        (isNaN(c) ? 100 : Math.abs(c - calc.lp.C)) +
        (isNaN(d) ? 100 : Math.abs(d - calc.lp.D)) +
        (isNaN(e) ? 100 : Math.abs(e - calc.lp.E)) +
        (isNaN(f) ? 100 : Math.abs(f - calc.lp.F)) +
        (isNaN(g) ? 100 : Math.abs(g - calc.lp.G)) +
        (isNaN(hv) ? 100 : Math.abs(hv - calc.lp.H));
      return {
        no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
        val1: row[h('Dim_A')], val2: row[h('Dim_B')], val3: row[h('Dim_C')], val4: row[h('Dim_D')],
        val5: row[h('Dim_E')], val6: row[h('Dim_F')], val7: row[h('Dim_G')], val8: row[h('Dim_H')],
        _diff: totalDiff
      };
    }).sort((a, b) => a._diff - b._diff);
}

function searchKS500RD_WorkDriver(fixData, h, sheetName, calc) {
  return fixData.filter(row => String(row[h('Tooling_name')]).toUpperCase().includes('WORK DRIVER'))
    .map(row => {
      const a = parseFloat(row[h('Dim_A')]), b = parseFloat(row[h('Dim_B')]);
      const totalDiff = (isNaN(a) ? 100 : Math.abs(a - calc.wd.A)) + (isNaN(b) ? 100 : Math.abs(b - calc.wd.B));
      return {
        no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
        val1: row[h('Dim_A')], val2: row[h('Dim_B')], val3: '-', val4: '-', val5: '-',
        _diff: totalDiff
      };
    }).sort((a, b) => a._diff - b._diff);
}

// ── KS400B5 ──────────────────────────────────────────────────────────────────

function searchKS400B5_Tool(fixData, h, sheetName, toolNameKeyword, targetValues) {
  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase().replace(/\s+/g, '');
    const keyword = String(toolNameKeyword).toUpperCase().replace(/\s+/g, '');
    if (keyword === 'WORKCHUTE' && name.includes('GUIDE')) return false;
    return name.includes(keyword);
  }).map(row => {
    let totalDiff = 0;
    const a = parseFloat(row[h('Dim_A')]), b = parseFloat(row[h('Dim_B')]);
    const c = parseFloat(row[h('Dim_C')]), d = parseFloat(row[h('Dim_D')]);
    const e = parseFloat(row[h('Dim_E')]), f = parseFloat(row[h('Dim_F')]);
    const g = parseFloat(row[h('Dim_G')]);
    if (targetValues.A !== undefined) totalDiff += isNaN(a) ? 100 : Math.abs(a - targetValues.A);
    if (targetValues.B !== undefined) totalDiff += isNaN(b) ? 100 : Math.abs(b - targetValues.B);
    if (targetValues.C !== undefined) totalDiff += isNaN(c) ? 100 : Math.abs(c - targetValues.C);
    if (targetValues.D !== undefined) totalDiff += isNaN(d) ? 100 : Math.abs(d - targetValues.D);
    if (targetValues.E !== undefined) totalDiff += isNaN(e) ? 100 : Math.abs(e - targetValues.E);
    if (targetValues.F !== undefined) totalDiff += isNaN(f) ? 100 : Math.abs(f - targetValues.F);
    if (targetValues.G !== undefined) totalDiff += isNaN(g) ? 100 : Math.abs(g - targetValues.G);
    const typeVal = String(row[h('Type')] || '-').trim().toUpperCase();
    if (targetValues.Type !== undefined && typeVal !== '-' && typeVal !== '') {
      if (typeVal !== String(targetValues.Type).toUpperCase()) totalDiff += 1000;
    }
    return {
      no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
      val1: isNaN(a) ? '-' : a, val2: isNaN(b) ? '-' : b, val3: isNaN(c) ? '-' : c,
      val4: isNaN(d) ? '-' : d, val5: isNaN(e) ? '-' : e, val6: isNaN(f) ? '-' : f,
      val7: isNaN(g) ? '-' : g, type: typeVal,
      _diff: totalDiff
    };
  }).sort((a, b) => a._diff - b._diff);
}

// ── KS400B6 ──────────────────────────────────────────────────────────────────

function searchKS400B6_WorkDriver(fixData, h, sheetName, calc) {
  return fixData.filter(row => String(row[h('Tooling_name')]).toUpperCase().includes('WORK DRIVER'))
    .map(row => {
      const a = parseFloat(row[h('Dim_A')]), b = parseFloat(row[h('Dim_B')]);
      const c = parseFloat(row[h('Dim_C')]), d = parseFloat(row[h('Dim_D')]), e = parseFloat(row[h('Dim_E')]);
      let diffA = isNaN(a) ? 100 : Math.abs(a - calc.workDriver.A);
      let diffB = isNaN(b) ? 100 : Math.abs(b - calc.workDriver.B);
      let diffC = isNaN(c) ? 100 : Math.abs(c - calc.workDriver.C);
      let diffD = isNaN(d) ? 100 : Math.abs(d - calc.workDriver.D);
      let diffE = isNaN(e) ? 100 : Math.abs(e - calc.workDriver.E);
      return {
        no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
        val1: isNaN(a) ? '-' : a, val2: isNaN(b) ? '-' : b, val3: isNaN(c) ? '-' : c,
        val4: isNaN(d) ? '-' : d, val5: isNaN(e) ? '-' : e,
        _diff: diffA + diffB + diffC + diffD + diffE
      };
    }).sort((a, b) => a._diff - b._diff);
}

function searchKS400B6_LoadingChute(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase();
    return name.includes('LOADING CHUTE') || name.includes('CHUTE');
  }).map(row => {
    const fixA = parseFloat(row[h('Dim_A')]), fixB = parseFloat(row[h('Dim_B')]);
    const fixC = parseFloat(row[h('Dim_C')]), fixD = parseFloat(row[h('Dim_D')]);
    const fixF = parseFloat(row[h('Dim_F')]);
    let penalty = 0, diffA = 999, diffB = 999, diffC = 999, diffD = 999, diffF = 999;
    if (!isNaN(fixC) && calc.loadingChute.C !== undefined) {
      if (fixC < calc.loadingChute.C - 0.01) penalty += 10000;
      diffC = Math.abs(fixC - calc.loadingChute.C);
    }
    if (!isNaN(fixD) && calc.loadingChute.D !== undefined) {
      if (fixD < calc.loadingChute.D - 0.01) penalty += 10000;
      diffD = Math.abs(fixD - calc.loadingChute.D);
    }
    if (!isNaN(fixA) && calc.loadingChute.A !== undefined) diffA = Math.abs(fixA - calc.loadingChute.A);
    if (!isNaN(fixB) && calc.loadingChute.B !== undefined) diffB = Math.abs(fixB - calc.loadingChute.B);
    if (!isNaN(fixF) && calc.loadingChute.F !== undefined && typeof calc.loadingChute.F === 'number') {
      diffF = Math.abs(fixF - calc.loadingChute.F);
    }
    return {
      no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
      val1: isNaN(fixA) ? '-' : fixA, val2: isNaN(fixB) ? '-' : fixB,
      val3: isNaN(fixC) ? '-' : fixC, val4: isNaN(fixD) ? '-' : fixD, val5: isNaN(fixF) ? '-' : fixF,
      _diff: penalty + diffD + (diffC / 100) + (diffA / 10000) + (diffB / 10000) + (diffF / 10000)
    };
  }).sort((a, b) => a._diff - b._diff);
}

function searchKS400B6_Plug(fixData, h, sheetName, calc) {
  return fixData.filter(row => String(row[h('Tooling_name')]).toUpperCase().includes('PLUG'))
    .map(row => {
      const a = parseFloat(row[h('Dim_A')]), b = parseFloat(row[h('Dim_B')]);
      const c = parseFloat(row[h('Dim_C')]), d = parseFloat(row[h('Dim_D')]);
      const diffA = isNaN(a) ? 100 : Math.abs(a - calc.plug.A);
      const diffB = isNaN(b) ? 100 : Math.abs(b - calc.plug.B);
      const diffC = isNaN(c) ? 100 : Math.abs(c - calc.plug.C);
      const diffD = isNaN(d) ? 100 : Math.abs(d - calc.plug.D);
      return {
        no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
        val1: isNaN(a) ? '-' : a, val2: isNaN(b) ? '-' : b, val3: isNaN(c) ? '-' : c, val4: isNaN(d) ? '-' : d,
        _diff: diffA + diffB + diffC + diffD
      };
    }).sort((a, b) => a._diff - b._diff);
}

function searchKS400B6_WorkGuide(fixData, h, sheetName, calc) {
  return fixData.filter(row => String(row[h('Tooling_name')]).toUpperCase().includes('WORK GUIDE'))
    .map(row => {
      const a = parseFloat(row[h('Dim_A')]), b = parseFloat(row[h('Dim_B')]);
      const c = parseFloat(row[h('Dim_C')]), e = parseFloat(row[h('Dim_E')]);
      const diffA = isNaN(a) ? 100 : Math.abs(a - calc.workGuide.A);
      const diffB = isNaN(b) ? 100 : Math.abs(b - calc.workGuide.B);
      const diffC = isNaN(c) ? 100 : Math.abs(c - calc.workGuide.C);
      return {
        no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
        val1: isNaN(a) ? '-' : a, val2: isNaN(b) ? '-' : b, val3: isNaN(c) ? '-' : c, val4: isNaN(e) ? '-' : e,
        _diff: diffA + diffB + diffC
      };
    }).sort((a, b) => a._diff - b._diff);
}

function searchKS400B6_WorkPusher(fixData, h, sheetName, calc) {
  return fixData.filter(row => String(row[h('Tooling_name')]).toUpperCase().includes('WORK PUSHER'))
    .map(row => {
      const a = parseFloat(row[h('Dim_A')]), b = parseFloat(row[h('Dim_B')]), c = parseFloat(row[h('Dim_C')]);
      const diffA = isNaN(a) ? 100 : Math.abs(a - calc.workPusher.A);
      const diffB = isNaN(b) ? 100 : Math.abs(b - calc.workPusher.B);
      const diffC = isNaN(c) ? 100 : Math.abs(c - calc.workPusher.C);
      return {
        no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
        val1: isNaN(a) ? '-' : a, val2: isNaN(b) ? '-' : b, val3: isNaN(c) ? '-' : c,
        _diff: diffA + diffB + diffC
      };
    }).sort((a, b) => a._diff - b._diff);
}

function searchKS400B6_StockerChute(fixData, h, sheetName, calc) {
  if (!calc.stockerChute) return [];
  return fixData.filter(row => String(row[h('Tooling_name')]).toUpperCase().includes('STOCKER CHUTE'))
    .map(row => {
      const a = parseFloat(row[h('Dim_A')]), b = parseFloat(row[h('Dim_B')]);
      const c = parseFloat(row[h('Dim_C')]);
      const diffA = isNaN(a) ? 100 : Math.abs(a - calc.stockerChute.A);
      const diffB = isNaN(b) ? 100 : Math.abs(b - calc.stockerChute.B);
      const diffC = isNaN(c) ? 100 : Math.abs(c - calc.stockerChute.C);
      return {
        no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
        val1: isNaN(a) ? '-' : a, val2: isNaN(b) ? '-' : b, val3: isNaN(c) ? '-' : c,
        _diff: diffA + diffB + diffC
      };
    }).sort((a, b) => a._diff - b._diff);
}

function searchKS400B6_FrontShoe(fixData, h, sheetName, calc) {
  return fixData.filter(row => String(row[h('Tooling_name')]).toUpperCase().includes('FRONT SHOE'))
    .map(row => {
      const a = parseFloat(row[h('Dim_A')]), b = parseFloat(row[h('Dim_B')]);
      const c = parseFloat(row[h('Dim_C')]), d = parseFloat(row[h('Dim_D')]);
      const fa = calc.frontShoe.A;
      const diffA = (typeof fa === 'number' && !isNaN(a)) ? Math.abs(a - fa) : 50;
      const diffB = isNaN(b) ? 100 : Math.abs(b - calc.frontShoe.B);
      const diffD = isNaN(d) ? 100 : (typeof calc.frontShoe.D === 'number' ? Math.abs(d - calc.frontShoe.D) : 0);
      return {
        no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
        val1: isNaN(a) ? '-' : a, val2: isNaN(b) ? '-' : b, val3: isNaN(c) ? '-' : c, val4: isNaN(d) ? '-' : d,
        _diff: diffA + diffB + diffD
      };
    }).sort((a, b) => a._diff - b._diff);
}

function searchKS400B6_RearShoe(fixData, h, sheetName, calc) {
  return fixData.filter(row => String(row[h('Tooling_name')]).toUpperCase().includes('REAR SHOE'))
    .map(row => {
      const a = parseFloat(row[h('Dim_A')]), b = parseFloat(row[h('Dim_B')]);
      const c = parseFloat(row[h('Dim_C')]);
      const ra = calc.rearShoe.A, rb = calc.rearShoe.B;
      const diffA = (typeof ra === 'number' && !isNaN(a)) ? Math.abs(a - ra) : 50;
      const diffB = (typeof rb === 'number' && !isNaN(b)) ? Math.abs(b - rb) : 50;
      const diffC = isNaN(c) ? 100 : Math.abs(c - calc.rearShoe.C);
      return {
        no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
        val1: isNaN(a) ? '-' : a, val2: isNaN(b) ? '-' : b, val3: isNaN(c) ? '-' : c,
        _diff: diffA + diffB + diffC
      };
    }).sort((a, b) => a._diff - b._diff);
}

function searchKS400B6_PilotPin(fixData, h, sheetName, calc) {
  return fixData.filter(row => String(row[h('Tooling_name')]).toUpperCase().includes('PILOT PIN'))
    .map(row => {
      const a = parseFloat(row[h('Dim_A')]), b = parseFloat(row[h('Dim_B')]), c = parseFloat(row[h('Dim_C')]);
      const diffA = isNaN(a) ? 100 : Math.abs(a - calc.pilotPin.A);
      const diffB = isNaN(b) ? 100 : Math.abs(b - calc.pilotPin.B);
      const diffC = isNaN(c) ? 100 : Math.abs(c - calc.pilotPin.C);
      return {
        no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
        val1: isNaN(a) ? '-' : a, val2: isNaN(b) ? '-' : b, val3: isNaN(c) ? '-' : c,
        _diff: diffA + diffB + diffC
      };
    }).sort((a, b) => a._diff - b._diff);
}

module.exports = {
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
};
