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
      valA: row[h('Face_Carrier_A')], 
      valB: row[h('Face_Carrier_E')],
      valC: '-', valD: '-',

      _diff: (Math.abs(sA - calc.tsgW_Amin) * 10000) - sE
    };
  });
}