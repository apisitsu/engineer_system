// ==========================================
// KS-03A SEARCH FUNCTIONS
// ==========================================
function searchKS03A_RollerShoe(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase();
    if (!name.includes('ROLLER SHOE')) return false;
    
    const fixA = parseFloat(row[h('Dim_A')]); 
    const fixC = parseFloat(row[h('Dim_C')]); 

    // ขยาย Tolerance ของการกรองรอบแรกให้กว้างขึ้น เพื่อไม่ให้ตัวดีๆ โดนเตะทิ้งแต่แรก
    if (isNaN(fixA) || Math.abs(fixA - calc.rollerShoe.A) > 1.0) return false;
    if (isNaN(fixC) || Math.abs(fixC - calc.rollerShoe.C) > 1.0) return false;
    
    return true;
  }).map(row => {
    // 1. ดึงค่าจากหน้าสต็อก
    const a = parseFloat(row[h('Dim_A')]);
    const b = parseFloat(row[h('Dim_B')]);
    const c = parseFloat(row[h('Dim_C')]);
    const d = parseFloat(row[h('Dim_D')]);

    // 2. คำนวณความคลาดเคลื่อนของแต่ละมิติ (หาผลต่างสัมบูรณ์)
    const diffA = isNaN(a) ? 100 : Math.abs(a - calc.rollerShoe.A);
    const diffB = isNaN(b) ? 100 : Math.abs(b - calc.rollerShoe.B);
    const diffC = isNaN(c) ? 100 : Math.abs(c - calc.rollerShoe.C);
    const diffD = isNaN(d) ? 100 : Math.abs(d - calc.rollerShoe.D);

    // 3. เอาความคลาดเคลื่อนทั้งหมดมารวมกัน (ตัวไหนน้อยสุด = ใกล้เคียงสมบูรณ์แบบที่สุด)
    const totalDiff = diffA + diffB + diffC + diffD;

    return {
      no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
      val1: row[h('Dim_A')], val2: row[h('Dim_C')], val3: row[h('Dim_D')], val4: row[h('Dim_B')], val5: row[h('Type')],
      _totalDiff: totalDiff // เก็บค่าผลรวมความคลาดเคลื่อนไว้ใช้จัดอันดับ
    };
  }).sort((a, b) => a._totalDiff - b._totalDiff); // เรียงจากคลาดเคลื่อนน้อยไปมาก
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
    val4: calc.cpxShoe.V, // แก้ตรงนี้
    val5: row[h('Type')],
    _diff: Math.abs(parseFloat(row[h('Dim_A')]) - calc.cpxShoe.A) // แก้ตรงนี้
  })).sort((a, b) => a._diff - b._diff);
}

function searchKS03A_ChuteCover(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase();
    return name.includes('CHUTE COVER'); 
  }).map(row => {
    const a = parseFloat(row[h('Dim_A')]);
    const b = parseFloat(row[h('Dim_B')]);
    const c = parseFloat(row[h('Dim_C')]);

    let penalty = 0;
    let diffA = 100, diffB = 100, diffC = 100;

    // A: (OD/ความสูง) ห้ามเตี้ยกว่าเป้าหมาย (ยอมให้คลาดเคลื่อนจากการปัดเศษได้ 0.01)
    if (!isNaN(a)) {
      if (a < calc.chute.A - 0.01) penalty += 10000; // งานติด! โดนปรับตก
      diffA = Math.abs(a - calc.chute.A);
    }

    // B: (W/ความกว้าง) ห้ามแคบกว่าเป้าหมาย
    if (!isNaN(b)) {
      if (b < calc.chute.B - 0.01) penalty += 10000; // งานติด! โดนปรับตก
      diffB = Math.abs(b - calc.chute.B);
    }

    if (!isNaN(c)) diffC = Math.abs(c - calc.chute.C);

    return {
      no: row[h('Tooling_no')], 
      machine: row[h('Machine')] || sheetName,
      val1: row[h('Dim_A')], 
      val2: row[h('Dim_B')], 
      val3: row[h('Dim_C')], 
      val4: '', 
      val5: row[h('Type')],
      _totalDiff: penalty + diffA + diffB + diffC
    };
  }).sort((a, b) => a._totalDiff - b._totalDiff);
}

function searchKS03A_FrontPlate(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase();
    if (!name.includes('FRONT PLATE')) return false;

    const fixA = parseFloat(row[h('Dim_A')]);
    if (isNaN(fixA) || Math.abs(fixA - calc.fp.A) > 0.5) return false;

    return true;
  }).map(row => {
    const a = parseFloat(row[h('Dim_A')]);
    const b = parseFloat(row[h('Dim_B')]);
    const c = parseFloat(row[h('Dim_C')]);

    const diffA = isNaN(a) ? 100 : Math.abs(a - calc.fp.A);
    const diffB = isNaN(b) ? 100 : Math.abs(b - calc.fp.B);
    const diffC = isNaN(c) ? 100 : Math.abs(c - calc.fp.C);

    const totalDiff = diffA + diffB + diffC;

    return {
      no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
      val1: row[h('Dim_A')], val2: row[h('Dim_B')], val3: row[h('Dim_C')], val4: '', val5: row[h('Type')],
      _totalDiff: totalDiff
    };
  }).sort((a, b) => a._totalDiff - b._totalDiff);
}

function searchKS03A_SettingGauge(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase();
    if (!name.includes('SETTING GAUGE')) return false;
    const fixA = parseFloat(row[h('Dim_A')]);
    // ขยาย Tolerance เป็น ±0.5
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
    // Master Ring ค่า A (OD) สำคัญมาก คงการกรองที่ ±0.05 ไว้
    if (isNaN(fixA) || Math.abs(fixA - calc.mr.A) > 0.05) return false;
    
    return true;
  }).map(row => {
    const a = parseFloat(row[h('Dim_A')]);
    const b = parseFloat(row[h('Dim_B')]);
    const c = parseFloat(row[h('Dim_C')]);

    // คำนวณความเพี้ยนของแต่ละมิติ
    const diffA = isNaN(a) ? 100 : Math.abs(a - calc.mr.A);
    const diffB = isNaN(b) ? 100 : Math.abs(b - calc.mr.B);
    const diffC = isNaN(c) ? 100 : Math.abs(c - calc.mr.C);

    // รวมความคลาดเคลื่อนเข้าด้วยกัน
    const totalDiff = diffA + diffB + diffC;

    return {
      no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
      val1: row[h('Dim_A')], val2: row[h('Dim_B')], val3: row[h('Dim_C')], val4: '', val5: row[h('Type')],
      _totalDiff: totalDiff // ใช้ผลรวมจัดอันดับ
    };
  }).sort((a, b) => a._totalDiff - b._totalDiff); // เรียงจากเพี้ยนน้อยไปเพี้ยนมาก
}

// ==========================================
// ค้นหา PLUG GAUGE (KS-03A)
// ==========================================
function searchKS03A_PlugGauge(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase();
    if (!name.includes('PLUG GAUGE')) return false;
    
    const fixA = parseFloat(row[h('Dim_A')]);
    // ปรับให้ดักจับไซส์ Nominal แบบเข้มงวด (ยอมให้ต่างได้แค่ 0.005) ป้องกันไซส์อื่นมาปน
    if (isNaN(fixA) || Math.abs(fixA - calc.pg.A) > 0.005) return false;
    return true;
  }).map(row => {
    const a = parseFloat(row[h('Dim_A')]);
    const b_tol = parseFloat(row[h('Dim_B')]); 
    const c_tol = parseFloat(row[h('Dim_C')]); 
    
    let totalDiff = 0;
    
    totalDiff += Math.abs(a - calc.pg.A);
    
    // เอาค่า Tolerance ในชีท มาลบกับค่า REQ Tolerance ได้ตรงๆ เลย (แอปเปิ้ลเทียบแอปเปิ้ล)
    if (!isNaN(b_tol) && calc.pg.B !== undefined) {
      totalDiff += Math.abs(b_tol - calc.pg.B);
    } else {
      totalDiff += 100;
    }
    
    if (!isNaN(c_tol) && calc.pg.C !== undefined) {
      totalDiff += Math.abs(c_tol - calc.pg.C);
    } else {
      totalDiff += 100;
    }

    return {
      no: row[h('Tooling_no')], 
      machine: row[h('Machine')] || sheetName,
      val1: row[h('Dim_A')], 
      val2: row[h('Dim_B')], 
      val3: row[h('Dim_C')], 
      val4: '', 
      val5: row[h('Type')],
      _diff: totalDiff
    };
  }).sort((a, b) => a._diff - b._diff);
}

function searchKS03A_Loader(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase();
    // ค้นหาทั้ง "LOADER" และ "NYLON LOADER"
    if (!name.includes('LOADER')) return false; 
    
    const fixA = parseFloat(row[h('Dim_A')]); // Width
    const fixB = parseFloat(row[h('Dim_B')]); // OD
    
    // Width (A) ต้องอยู่ระหว่าง Min ถึง Max 
    if (isNaN(fixA) || fixA < calc.ld.A_min || fixA > calc.ld.A_max) return false;
    // OD (B) สำคัญสุด ยอมให้ต่างได้ 0.5
    if (isNaN(fixB) || Math.abs(fixB - calc.ld.B) > 0.5) return false;
    
    return true;
  }).map(row => {
    const fixA = parseFloat(row[h('Dim_A')]);
    const fixB = parseFloat(row[h('Dim_B')]);
    const fixF = parseFloat(row[h('Dim_F')]); // ค่า F (ถ้ามี)
    
    // คำนวณความเพี้ยนเพื่อจัดอันดับ
    // 1. OD (B) ต้องเป๊ะที่สุด ให้คะแนนนำ
    let diffB = Math.abs(fixB - calc.ld.B);
    
    // 2. Width (A) ยิ่งเข้าใกล้เป้าหมาย (W-1) ยิ่งดี
    let diffA = Math.abs(fixA - calc.ld.A_target);

    // 3. F (ถ้าในตารางมีบันทึกค่า F ไว้ ค่อยเอามาคิดคะแนน ถ้าเป็นรุ่นเก่าที่ช่อง F ว่าง ก็ข้ามไป)
    let diffF = 0;
    if (!isNaN(fixF) && calc.ld.F !== undefined) {
      diffF = Math.abs(fixF - calc.ld.F);
    }

    return {
      no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
      val1: row[h('Dim_A')], val2: row[h('Dim_B')], val3: row[h('Dim_C')], 
      val4: row[h('Dim_D')], val5: row[h('Dim_E')],
      // เพิ่ม val6 ถ้าต้องการโชว์ค่า F บนหน้าเว็บ (ถ้าไม่โชว์ก็ไม่ต้องแก้ Index.html ครับ)
      _diff: diffB + (diffA / 100) + (diffF / 1000) 
    };
  }).sort((a, b) => a._diff - b._diff);
}

function searchKS03A_PressureRotor(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase();
    if (!name.includes('PRESSURE ROTOR')) return false;

    const fixA = parseFloat(row[h('Dim_A')]);
    
    // กรองหาตัวที่ค่า A ใกล้เคียงเป้าหมาย (ยอมรับความคลาดเคลื่อน ±0.5)
    if (isNaN(fixA) || Math.abs(fixA - calc.pr.A) > 0.5) return false;

    return true;
  }).map(row => {
    // คำนวณความคลาดเคลื่อนเพื่อเอาไปจัดอันดับ
    const diffA = Math.abs(parseFloat(row[h('Dim_A')]) - calc.pr.A);
    
    return {
      no: row[h('Tooling_no')], machine: row[h('Machine')] || sheetName,
      val1: row[h('Dim_A')], val2: row[h('Dim_B')] || '-', val3: row[h('Dim_C')] || '-', val4: '', val5: row[h('Type')],
      _diff: diffA
    };
  }).sort((a, b) => a._diff - b._diff); // เรียงอันดับจากใกล้เคียงที่สุด
}