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
    // ----------------------------------------

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
  }))

  .sort((a, b) => {

    const diffC_A = Math.abs(parseFloat(a.val3) - reqC); 
    const diffC_B = Math.abs(parseFloat(b.val3) - reqC);

    if (diffC_A !== diffC_B) {
      return diffC_A - diffC_B;
    } else {

      return a._diff - b._diff; 
    }
  });
}

function searchKSB80_BackPlates(fixData, h, sheetName, calc) {
  let reqAA = 0, minPCD = 0, maxPCD = 100.0, checkPCD = true;

  if (calc.jawA <= 54) { // TYPE 1
    reqAA = parseFloat((calc.ID_part + 0.3).toFixed(2));
    minPCD = Math.ceil((reqAA + 1.0) * 10) / 10;
  } else { // TYPE 2
    reqAA = parseFloat((calc.ID_part + 0.6).toFixed(2));
    checkPCD = false; // TYPE 2 ไม่มีค่า B
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
    no: row[h('Tooling_no')], 
    machine: row[h('Machine')] || sheetName,
    val1: row[h('BackPlateID_A')], 
    val2: row[h('BackPlatePCD_B')],
    _diff: Math.abs(parseFloat(row[h('BackPlateID_A')]) - reqAA)
  }))
  .sort((a, b) => a._diff - b._diff);
}