// ==========================================
// ค้นหา LOADING PINTLE (KS500RD)
// ==========================================
function searchKS500RD_LoadingPintle(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase();
    return name.includes('LOADING PINTLE'); // ให้ผ่านเข้ารอบมาให้หมด ไม่ต้องตัดทิ้ง
  }).map(row => {
    // ดึงค่า A ถึง H
    const a = parseFloat(row[h('Dim_A')]); const b = parseFloat(row[h('Dim_B')]);
    const c = parseFloat(row[h('Dim_C')]); const d = parseFloat(row[h('Dim_D')]);
    const e = parseFloat(row[h('Dim_E')]); const f = parseFloat(row[h('Dim_F')]);
    const g = parseFloat(row[h('Dim_G')]); const hv = parseFloat(row[h('Dim_H')]);

    // รวมค่าความคลาดเคลื่อนทั้งหมด 8 มิติ (ตัวที่พัง/แหว่ง โดนปรับคะแนน 100 ผลักไปท้ายๆ)
    const totalDiff = 
      (isNaN(a) ? 100 : Math.abs(a - calc.lp.A)) +
      (isNaN(b) ? 100 : Math.abs(b - calc.lp.B)) +
      (isNaN(c) ? 100 : Math.abs(c - calc.lp.C)) +
      (isNaN(d) ? 100 : Math.abs(d - calc.lp.D)) +
      (isNaN(e) ? 100 : Math.abs(e - calc.lp.E)) +
      (isNaN(f) ? 100 : Math.abs(f - calc.lp.F)) +
      (isNaN(g) ? 100 : Math.abs(g - calc.lp.G)) +
      (isNaN(hv)? 100 : Math.abs(hv - calc.lp.H));

    return {
      no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
      // ส่งค่าออกไป 8 ตัวสำหรับหน้า UI
      val1: row[h('Dim_A')], val2: row[h('Dim_B')], val3: row[h('Dim_C')], val4: row[h('Dim_D')],
      val5: row[h('Dim_E')], val6: row[h('Dim_F')], val7: row[h('Dim_G')], val8: row[h('Dim_H')],
      _totalDiff: totalDiff
    };
  }).sort((a, b) => a._totalDiff - b._totalDiff); // เรียงอันดับจากเพี้ยนน้อยไปมาก
}

// ==========================================
// ค้นหา WORK DRIVER (KS500RD)
// ==========================================
function searchKS500RD_WorkDriver(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase();
    return name.includes('WORK DRIVER'); // ให้ผ่านเข้ารอบมาให้หมด
  }).map(row => {
    const a = parseFloat(row[h('Dim_A')]);
    const b = parseFloat(row[h('Dim_B')]);

    const totalDiff = (isNaN(a) ? 100 : Math.abs(a - calc.wd.A)) + (isNaN(b) ? 100 : Math.abs(b - calc.wd.B));

    return {
      no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
      val1: row[h('Dim_A')], val2: row[h('Dim_B')], val3: '-', val4: '-', val5: '-',
      _totalDiff: totalDiff
    };
  }).sort((a, b) => a._totalDiff - b._totalDiff);
}