// ==========================================
// ค้นหา WORK DRIVER (KS400B6)
// ==========================================
function searchKS400B6_WorkDriver(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase();
    return name.includes('WORK DRIVER'); // ให้ผ่านเข้ารอบมาทั้งหมดเพื่อคิดคะแนน
    
  }).map(row => {
    const a = parseFloat(row[h('Dim_A')]);
    const b = parseFloat(row[h('Dim_B')]);
    const c = parseFloat(row[h('Dim_C')]);
    const d = parseFloat(row[h('Dim_D')]);
    const e = parseFloat(row[h('Dim_E')]);

    let penalty = 0;
    
    // หาผลต่าง (Difference)
    let diffA = isNaN(a) ? 100 : Math.abs(a - calc.workDriver.A);
    let diffB = isNaN(b) ? 100 : Math.abs(b - calc.workDriver.B);
    let diffC = isNaN(c) ? 100 : Math.abs(c - calc.workDriver.C);
    let diffD = isNaN(d) ? 100 : Math.abs(d - calc.workDriver.D);
    let diffE = isNaN(e) ? 100 : Math.abs(e - calc.workDriver.E);

    // รวมคะแนนความคลาดเคลื่อน
    const totalDiff = penalty + diffA + diffB + diffC + diffD + diffE;

    return {
      no: row[h('Tooling_no')],
      machine: row[h('Machine')] || sheetName,
      val1: isNaN(a) ? '-' : a, 
      val2: isNaN(b) ? '-' : b, 
      val3: isNaN(c) ? '-' : c,
      val4: isNaN(d) ? '-' : d, 
      val5: isNaN(e) ? '-' : e,
      _totalDiff: totalDiff
    };
  }).sort((a, b) => a._totalDiff - b._totalDiff); // ตัวที่ขนาดเป๊ะสุดจะอยู่อันดับ 1
}

// ==========================================
// ค้นหา LOADING CHUTE (KS400B6)
// ==========================================
function searchKS400B6_LoadingChute(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase();
    return name.includes('LOADING CHUTE') || name.includes('CHUTE');
  }).map(row => {
    // ดึงค่ามิติต่างๆ จากฐานข้อมูล (ปรับชื่อคอลัมน์ Dim_A ฯลฯ ให้ตรงกับ Sheet ของคุณ)
    const fixA = parseFloat(row[h('Dim_A')]);
    const fixB = parseFloat(row[h('Dim_B')]);
    const fixC = parseFloat(row[h('Dim_C')]);
    const fixD = parseFloat(row[h('Dim_D')]);
    const fixF = parseFloat(row[h('Dim_F')]);

    let penalty = 0;
    let diffA = 999, diffB = 999, diffC = 999, diffD = 999, diffF = 999;

    // C: ความกว้าง (ห้ามแคบกว่าเป้าหมาย)
    if (!isNaN(fixC) && calc.loadingChute.C !== undefined) {
       if (fixC < calc.loadingChute.C - 0.01) penalty += 10000; // แคบไป งานติด!
       diffC = Math.abs(fixC - calc.loadingChute.C);
    }

    // D: ความสูง/ระยะร่อง (ห้ามเตี้ยกว่าเป้าหมาย)
    if (!isNaN(fixD) && calc.loadingChute.D !== undefined) {
       if (fixD < calc.loadingChute.D - 0.01) penalty += 10000; // แคบไป งานติด!
       diffD = Math.abs(fixD - calc.loadingChute.D);
    }

    if (!isNaN(fixA) && calc.loadingChute.A !== undefined) diffA = Math.abs(fixA - calc.loadingChute.A);
    if (!isNaN(fixB) && calc.loadingChute.B !== undefined) diffB = Math.abs(fixB - calc.loadingChute.B);
    
    // F: คำนวณความต่างเฉพาะเมื่อมันเป็นตัวเลข (ไม่ใช่ "TG")
    if (!isNaN(fixF) && typeof calc.loadingChute.F === 'number') {
      diffF = Math.abs(fixF - calc.loadingChute.F);
    } else if (calc.loadingChute.F === "TG") {
      diffF = 0; // ถ้าระบบต้องการ TG เราจะข้ามการหักคะแนนความเพี้ยนของ F ไปก่อน
    }

    return {
      no: row[h('Tooling_no')],
      machine: row[h('Machine')] || sheetName,
      val1: isNaN(fixA) ? '-' : fixA,
      val2: isNaN(fixB) ? '-' : fixB,
      val3: isNaN(fixC) ? '-' : fixC,
      val4: isNaN(fixD) ? '-' : fixD,
      val5: '-', // ไม่มีค่า E
      val6: isNaN(fixF) ? '-' : fixF,
      
      // เอาทุกความคลาดเคลื่อนมาบวกรวมกัน ตัวไหนน้อยสุด=เป๊ะสุด
      _diff: penalty + diffA + diffB + diffC + diffD + diffF 
    };
  }).sort((a, b) => a._diff - b._diff);
}

// ==========================================
// ค้นหา PLUG (KS400B6)
// ==========================================
function searchKS400B6_Plug(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase();
    return name.includes('PLUG'); // ปล่อยผ่านเข้ามาให้หมดเพื่อคิดคะแนน
  }).map(row => {
    const fixA = parseFloat(row[h('Dim_A')]);
    const fixB = parseFloat(row[h('Dim_B')]);
    const fixC = parseFloat(row[h('Dim_C')]);
    const fixD = parseFloat(row[h('Dim_D')]);

    let penalty = 0;
    
    // A คือไซส์สอดเข้า ID ห่างกันเกิน 0.5 ให้คะแนนตก
    if (!isNaN(fixA) && Math.abs(fixA - calc.plug.A) > 0.5) {
      penalty += 10000;
    }

    // คำนวณความเพี้ยนของแต่ละมิติ
    const diffA = isNaN(fixA) ? 100 : Math.abs(fixA - calc.plug.A);
    const diffB = isNaN(fixB) ? 100 : Math.abs(fixB - calc.plug.B);
    const diffC = isNaN(fixC) ? 100 : Math.abs(fixC - calc.plug.C);
    const diffD = isNaN(fixD) ? 100 : Math.abs(fixD - calc.plug.D);

    // รวมความคลาดเคลื่อน
    const totalDiff = penalty + diffA + diffB + diffC + diffD;

    return {
      no: row[h('Tooling_no')],
      machine: row[h('Machine')] || sheetName,
      val1: isNaN(fixA) ? '-' : fixA,
      val2: isNaN(fixB) ? '-' : fixB,
      val3: isNaN(fixC) ? '-' : fixC,
      val4: isNaN(fixD) ? '-' : fixD,
      val5: '-', // ไม่มีค่า E
      _diff: totalDiff
    };
  }).sort((a, b) => a._diff - b._diff);
}

// ==========================================
// ค้นหา WORK GUIDE (KS400B6)
// ==========================================
function searchKS400B6_WorkGuide(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase();
    return name.includes('WORK GUIDE'); 
  }).map(row => {
    const fixA = parseFloat(row[h('Dim_A')]);
    const fixB = parseFloat(row[h('Dim_B')]);
    const fixC = parseFloat(row[h('Dim_C')]);
    const fixD = parseFloat(row[h('Dim_D')]);
    const fixE = parseFloat(row[h('Dim_E')]);

    let diffA = 100, diffB = 100, diffC = 100, diffD = 100, diffE = 100;

    // คำนวณความเพี้ยนของ A, B, C, E
    if (!isNaN(fixA) && calc.workGuide.A !== undefined) diffA = Math.abs(fixA - calc.workGuide.A);
    if (!isNaN(fixB) && calc.workGuide.B !== undefined) diffB = Math.abs(fixB - calc.workGuide.B);
    if (!isNaN(fixC) && calc.workGuide.C !== undefined) diffC = Math.abs(fixC - calc.workGuide.C);
    if (!isNaN(fixE) && calc.workGuide.E !== undefined) diffE = Math.abs(fixE - calc.workGuide.E);

    // เช็กค่า D (ถ้า Requirement เป็น None(null) ให้คะแนนเพี้ยนของ D = 0 ทันที)
    if (calc.workGuide.D !== null && calc.workGuide.D !== undefined) {
      if (!isNaN(fixD)) diffD = Math.abs(fixD - calc.workGuide.D);
    } else {
      diffD = 0; 
    }

    // รวมความเพี้ยนทั้งหมด
    const totalDiff = diffA + diffB + diffC + diffD + diffE;

    return {
      no: row[h('Tooling_no')],
      machine: row[h('Machine')] || sheetName,
      val1: isNaN(fixA) ? '-' : fixA,
      val2: isNaN(fixB) ? '-' : fixB,
      val3: isNaN(fixC) ? '-' : fixC,
      val4: isNaN(fixD) ? '-' : fixD,
      val5: isNaN(fixE) ? '-' : fixE,
      _diff: totalDiff
    };
  }).sort((a, b) => a._diff - b._diff);
}

// ==========================================
// ค้นหา WORK PUSHER (KS400B6)
// ==========================================
function searchKS400B6_WorkPusher(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase();
    return name.includes('WORK PUSHER') || name.includes('PUSHER');
  }).map(row => {
    const fixA = parseFloat(row[h('Dim_A')]);
    const fixB = parseFloat(row[h('Dim_B')]);
    const fixC = parseFloat(row[h('Dim_C')]);

    let penalty = 0;
    
    // A และ B เป็นระยะสอด/ดันชิ้นงาน ถ้าใหญ่กว่าที่คำนวณไว้เยอะ งานอาจจะติด (ให้ Penalty)
    if (!isNaN(fixA) && fixA > calc.workPusher.A + 0.1) penalty += 5000;
    if (!isNaN(fixB) && fixB > calc.workPusher.B + 0.1) penalty += 5000;

    // หาผลต่าง (Difference)
    const diffA = isNaN(fixA) ? 100 : Math.abs(fixA - calc.workPusher.A);
    const diffB = isNaN(fixB) ? 100 : Math.abs(fixB - calc.workPusher.B);
    const diffC = isNaN(fixC) ? 100 : Math.abs(fixC - calc.workPusher.C);

    // รวมคะแนนความคลาดเคลื่อน
    const totalDiff = penalty + diffA + diffB + diffC;

    return {
      no: row[h('Tooling_no')],
      machine: row[h('Machine')] || sheetName,
      val1: isNaN(fixA) ? '-' : fixA,
      val2: isNaN(fixB) ? '-' : fixB,
      val3: isNaN(fixC) ? '-' : fixC,
      val4: '-', 
      val5: '-', 
      _diff: totalDiff
    };
  }).sort((a, b) => a._diff - b._diff);
}

// ==========================================
// ค้นหา STOCKER CHUTE (KS400B6)
// ==========================================
function searchKS400B6_StockerChute(fixData, h, sheetName, calc) {
  // ถ้างานเกินสเปกเครื่อง (OD > 32, W > 26) คำนวณจะส่งค่า null มา ให้ดีดออกเป็น Array ว่างๆ เลย
  if (!calc.stockerChute) return [];

  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase();
    return name.includes('STOCKER CHUTE');
  }).map(row => {
    const fixA = parseFloat(row[h('Dim_A')]);
    const fixB = parseFloat(row[h('Dim_B')]);
    const fixC = parseFloat(row[h('Dim_C')]);
    const fixD = parseFloat(row[h('Dim_D')]);
    const fixE = parseFloat(row[h('Dim_E')]);

    let penalty = 0;
    let diffA = 999, diffB = 999, diffC = 999, diffD = 999, diffE = 999;

    // A และ B เป็นช่อง Clearance ให้งานไหล ถ้าแคบไป งานติด! (โดน Penalty)
    if (!isNaN(fixA) && calc.stockerChute.A !== undefined) {
       if (fixA < calc.stockerChute.A - 0.01) penalty += 10000;
       diffA = Math.abs(fixA - calc.stockerChute.A);
    }
    if (!isNaN(fixB) && calc.stockerChute.B !== undefined) {
       if (fixB < calc.stockerChute.B - 0.01) penalty += 10000;
       diffB = Math.abs(fixB - calc.stockerChute.B);
    }

    if (!isNaN(fixC) && calc.stockerChute.C !== undefined) diffC = Math.abs(fixC - calc.stockerChute.C);
    if (!isNaN(fixD) && calc.stockerChute.D !== undefined) diffD = Math.abs(fixD - calc.stockerChute.D);
    if (!isNaN(fixE) && calc.stockerChute.E !== undefined) diffE = Math.abs(fixE - calc.stockerChute.E);

    const totalDiff = penalty + diffA + diffB + diffC + diffD + diffE;

    return {
      no: row[h('Tooling_no')],
      machine: row[h('Machine')] || sheetName,
      val1: isNaN(fixA) ? '-' : fixA,
      val2: isNaN(fixB) ? '-' : fixB,
      val3: isNaN(fixC) ? '-' : fixC,
      val4: isNaN(fixD) ? '-' : fixD,
      val5: isNaN(fixE) ? '-' : fixE,
      // ถ้าบนหน้าเว็บ (Index.html) คุณเจาะช่องให้แสดงค่า F, G, H ด้วย ก็สามารถแนบไปใน val6, val7, val8 ได้เลยครับ
      _diff: totalDiff
    };
  }).sort((a, b) => a._diff - b._diff);
}

// ==========================================
// ค้นหา FRONT SHOE (KS400B6)
// ==========================================
function searchKS400B6_FrontShoe(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase();
    return name.includes('FRONT SHOE');
  }).map(row => {
    const fixA = parseFloat(row[h('Dim_A')]);
    const fixB = parseFloat(row[h('Dim_B')]);
    const fixC = parseFloat(row[h('Dim_C')]);
    const fixD = parseFloat(row[h('Dim_D')]);

    let penalty = 0;
    
    // B เป็นเรื่องของขนาดที่ฟิกซ์ไว้ 8 หรือ 9 ถ้าในสต็อกไม่ตรงให้คะแนนตก (Penalty)
    if (!isNaN(fixB) && calc.frontShoe.B !== undefined) {
       if (Math.abs(fixB - calc.frontShoe.B) > 0.5) penalty += 5000;
    }

    let diffA = isNaN(fixA) || typeof calc.frontShoe.A !== 'number' ? 100 : Math.abs(fixA - calc.frontShoe.A);
    let diffB = isNaN(fixB) || calc.frontShoe.B === undefined ? 100 : Math.abs(fixB - calc.frontShoe.B);
    let diffC = isNaN(fixC) || calc.frontShoe.C === undefined ? 100 : Math.abs(fixC - calc.frontShoe.C);
    let diffD = isNaN(fixD) || typeof calc.frontShoe.D !== 'number' ? 100 : Math.abs(fixD - calc.frontShoe.D);

    const totalDiff = penalty + diffA + diffB + diffC + diffD;

    return {
      no: row[h('Tooling_no')],
      machine: row[h('Machine')] || sheetName,
      val1: isNaN(fixA) ? '-' : fixA,
      val2: isNaN(fixB) ? '-' : fixB,
      val3: isNaN(fixC) ? '-' : fixC,
      val4: isNaN(fixD) ? '-' : fixD,
      val5: '-',
      _diff: totalDiff
    };
  }).sort((a, b) => a._diff - b._diff);
}

// ==========================================
// ค้นหา REAR SHOE (KS400B6)
// ==========================================
function searchKS400B6_RearShoe(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase();
    return name.includes('REAR SHOE');
  }).map(row => {
    const fixA = parseFloat(row[h('Dim_A')]);
    const fixB = parseFloat(row[h('Dim_B')]);
    const fixC = parseFloat(row[h('Dim_C')]);
    const fixD = parseFloat(row[h('Dim_D')]); // ค่านี้อาจจะเป็นองศา
    
    // คำนวณความคลาดเคลื่อน
    let diffA = isNaN(fixA) || typeof calc.rearShoe.A !== 'number' ? 100 : Math.abs(fixA - calc.rearShoe.A);
    let diffB = isNaN(fixB) || typeof calc.rearShoe.B !== 'number' ? 100 : Math.abs(fixB - calc.rearShoe.B);
    let diffC = isNaN(fixC) || calc.rearShoe.C === undefined ? 100 : Math.abs(fixC - calc.rearShoe.C);
    
    let diffD = 0;
    // นำ D มาคิดความเพี้ยนเฉพาะตอนที่ผลคำนวณไม่ได้ออกมาเป็น None/null
    if (calc.rearShoe.D !== null && calc.rearShoe.D !== "-" && calc.rearShoe.D !== undefined) {
       diffD = isNaN(fixD) ? 100 : Math.abs(fixD - calc.rearShoe.D);
    }

    const totalDiff = diffA + diffB + diffC + diffD;

    return {
      no: row[h('Tooling_no')],
      machine: row[h('Machine')] || sheetName,
      val1: isNaN(fixA) ? '-' : fixA,
      val2: isNaN(fixB) ? '-' : fixB,
      val3: isNaN(fixC) ? '-' : fixC,
      val4: isNaN(fixD) ? '-' : fixD,
      val5: '-',
      _diff: totalDiff
    };
  }).sort((a, b) => a._diff - b._diff);
}

// ==========================================
// ค้นหา PILOT PIN (KS400B6)
// ==========================================
function searchKS400B6_PilotPin(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const name = String(row[h('Tooling_name')]).toUpperCase();
    return name.includes('PILOT PIN') || name.includes('PILOT');
  }).map(row => {
    const fixA = parseFloat(row[h('Dim_A')]);
    const fixB = parseFloat(row[h('Dim_B')]);
    const fixC = parseFloat(row[h('Dim_C')]);
    const fixD = parseFloat(row[h('Dim_D')]);
    const fixE = parseFloat(row[h('Dim_E')]);
    const fixF = parseFloat(row[h('Dim_F')]);

    let penalty = 0;
    
    // A คือขนาด Pin ถ้าใหญ่กว่าสเปก จะสอดเข้างานไม่ได้ งานพัง!
    if (!isNaN(fixA) && fixA > calc.pilotPin.A + 0.05) {
      penalty += 10000;
    }

    // คำนวณผลต่างเพื่อจัดอันดับ (ให้ความสำคัญกับ A, B, C มากที่สุด)
    let diffA = isNaN(fixA) ? 100 : Math.abs(fixA - calc.pilotPin.A);
    let diffB = isNaN(fixB) ? 100 : Math.abs(fixB - calc.pilotPin.B);
    let diffC = isNaN(fixC) ? 100 : Math.abs(fixC - calc.pilotPin.C);
    
    let diffD = 0;
    if (calc.pilotPin.D !== "-") {
      diffD = isNaN(fixD) ? 100 : Math.abs(fixD - calc.pilotPin.D);
    }

    let diffE = isNaN(fixE) ? 10 : Math.abs(fixE - calc.pilotPin.E);
    let diffF = isNaN(fixF) ? 10 : Math.abs(fixF - calc.pilotPin.F);

    const totalDiff = penalty + diffA + diffB + diffC + diffD + (diffE/10) + (diffF/10);

    return {
      no: row[h('Tooling_no')],
      machine: row[h('Machine')] || sheetName,
      val1: isNaN(fixA) ? '-' : fixA,
      val2: isNaN(fixB) ? '-' : fixB,
      val3: isNaN(fixC) ? '-' : fixC,
      val4: isNaN(fixD) ? '-' : fixD,
      val5: isNaN(fixE) ? '-' : fixE,
      val6: isNaN(fixF) ? '-' : fixF,
      _diff: totalDiff
    };
  }).sort((a, b) => a._diff - b._diff);
}