function searchTSG_Chutes(fixData, h, sheetName, calc) {
  const CHUTE_B_MAX_EXCESS = 3.0; // chute max 3mm wider than part: prevents excessive tilt during feed

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

    const CARRIER_A_MAX_EXCESS = 1.0; // carrier pocket max 1mm larger than OD+0.5: prevents part floating/vibration

    if (isNaN(sDepth) || sDepth > calc.maxCarrierD) return false;
    if (isNaN(sA) || sA < calc.carrierCalcA) return false;
    if (sA > calc.carrierCalcA + CARRIER_A_MAX_EXCESS) return false;
    if (isNaN(sLength) || sLength < (calc.carrierCalcC)) return false;
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