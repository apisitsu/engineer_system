// ==========================================
// ค้นหา Tooling สำหรับ KS400B5 (Universal Search)
// ==========================================
function searchKS400B5_Tool(fixData, h, sheetName, toolNameKeyword, targetValues) {
  return fixData.filter(row => {
    // ล้างช่องว่างออกให้หมด เช่น "WORK CHUTE GUIDE" จะกลายเป็น "WORKCHUTEGUIDE"
    const name = String(row[h('Tooling_name')]).toUpperCase().replace(/\s+/g, '');
    const keyword = String(toolNameKeyword).toUpperCase().replace(/\s+/g, '');
    
    // ดักจับแบบเด็ดขาด: ถ้ากำลังหา "WORKCHUTE" แต่ในชื่อมีคำว่า "GUIDE" ให้ปัดตกทันที!
    if (keyword === "WORKCHUTE" && name.includes("GUIDE")) {
      return false; 
    }
    
    return name.includes(keyword);
  }).map(row => {
    let totalDiff = 0;
    
    // ดึงค่า A-G จากชีท
    const a = parseFloat(row[h('Dim_A')]); const b = parseFloat(row[h('Dim_B')]);
    const c = parseFloat(row[h('Dim_C')]); const d = parseFloat(row[h('Dim_D')]);
    const e = parseFloat(row[h('Dim_E')]); const f = parseFloat(row[h('Dim_F')]);
    const g = parseFloat(row[h('Dim_G')]);

    // หาผลต่าง (Difference) เพื่อจัดอันดับตัวที่ใกล้เคียงที่สุด
    if (targetValues.A !== undefined) totalDiff += isNaN(a) ? 100 : Math.abs(a - targetValues.A);
    if (targetValues.B !== undefined) totalDiff += isNaN(b) ? 100 : Math.abs(b - targetValues.B);
    if (targetValues.C !== undefined) totalDiff += isNaN(c) ? 100 : Math.abs(c - targetValues.C);
    if (targetValues.D !== undefined) totalDiff += isNaN(d) ? 100 : Math.abs(d - targetValues.D);
    if (targetValues.E !== undefined) totalDiff += isNaN(e) ? 100 : Math.abs(e - targetValues.E);
    if (targetValues.F !== undefined) totalDiff += isNaN(f) ? 100 : Math.abs(f - targetValues.F);
    if (targetValues.G !== undefined) totalDiff += isNaN(g) ? 100 : Math.abs(g - targetValues.G);

    // ดึงค่า Type (ถ้ามี)
    const typeVal = String(row[h('Type')] || '-').trim().toUpperCase();

    // เช็กเงื่อนไขบังคับ Type ตรงกัน
    if (targetValues.Type !== undefined && typeVal !== '-' && typeVal !== '') {
      if (typeVal !== String(targetValues.Type).toUpperCase()) {
        totalDiff += 1000;
      }
    }

    return {
      no: row[h('Tooling_no')],
      machine: row[h('Machine')] || sheetName,
      val1: isNaN(a) ? '-' : a, val2: isNaN(b) ? '-' : b, val3: isNaN(c) ? '-' : c,
      val4: isNaN(d) ? '-' : d, val5: isNaN(e) ? '-' : e, val6: isNaN(f) ? '-' : f,
      val7: isNaN(g) ? '-' : g, type: typeVal,
      _totalDiff: totalDiff
    };
  }).sort((a, b) => a._totalDiff - b._totalDiff);
}