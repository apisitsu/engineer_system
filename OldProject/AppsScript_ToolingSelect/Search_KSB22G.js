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
    // ---------------------------------------------------

    if (!isNaN(fixD) && fixD > maxDepth) return false;
    if (!isNaN(fixD) && fixD < MIN_JAW_DEPTH) return false;

    const fixC = parseFloat(row[h('JawWidth_Max_C')]);
    if (!isNaN(fixC) && fixC > reqC + JAW_WIDTH_MAX_MARGIN) return false;

    return true;
  }).map(row => ({
    no: row[h('Tooling_no')],
    machine: row[h('Machine')] || sheetName,
    val1: row[h('JawID_1_A')], val2: row[h('JawID_2_B')], val3: row[h('JawWidth_Max_C')],
    valD: row[h('JawDepth_Max_D')] || '-', valE: '-',
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
    no: row[h('Tooling_no')], 
    machine: row[h('Machine')] || sheetName,
    val1: row[h('BackPlateID_A')], 
    val2: row[h('BackPlatePCD_B')],
    _diff: Math.abs(parseFloat(row[h('BackPlateID_A')]) - reqAA)
  }))
  .sort((a, b) => a._diff - b._diff); 
}