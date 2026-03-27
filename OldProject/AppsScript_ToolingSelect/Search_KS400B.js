/**
 * KS400B Machine Constants & Search Functions
 */

// Machine Limits
const KS400B_W_MAX = 30;
const KS400B_OD_MAX = 32;

/**
 * Work Driver
 */
function searchKS400B_WorkDriver(fixData, h, sheetName, calc) {
  // Check machine limits
  if (calc.od_turning > KS400B_OD_MAX || calc.w_aft > KS400B_W_MAX) {
    return [];
  }
  
  return fixData.filter(row => {
    const toolType = String(row[h('Tooling_name')]).toUpperCase();
    return toolType.includes('WORK DRIVER'); // ยอมให้ผ่านเข้ารอบทุกตัว เพื่อมาเช็กคะแนน
    
  }).map(row => {
    const fixA = parseFloat(row[h('OD_A')]);
    const fixB = parseFloat(row[h('ID_B')]);
    const fixE = parseFloat(row[h('Width_E')]);

    // ถ้าข้อมูลพัง ให้ผลักไปอยู่ล่างสุด
    if (isNaN(fixA) || isNaN(fixB)) {
      return { _diffA: 99999, _diffB: 99999, _diffE: 99999, _diff: 99999 };
    }

    const diffA = Math.abs(fixA - calc.wd_A);
    const diffB = Math.abs(fixB - calc.wd_B);
    const diffE = (calc.wd_E && !isNaN(fixE)) ? Math.abs(fixE - calc.wd_E) : 0;

    // ถ้าห่างเป้าหมายเกิน Allow (+- 1.0) โดน Penalty ปรับตกไปอยู่ท้ายๆ 
    let penalty = 0;
    if (diffA > 1.01) penalty += 10000;
    if (diffB > 1.01) penalty += 10000;

    return {
      no: row[h('Tooling_no')],
      machine: row[h('Machine')] || sheetName,
      val1: row[h('OD_A')],
      val2: row[h('ID_B')],
      val3: row[h('OD_C')],
      val4: row[h('OD_D')],
      val5: row[h('Width_E')],

      // ส่งคะแนนไปเรียงลำดับ
      _diffA: diffA + penalty,
      _diffB: diffB,
      _diffE: diffE,
      _diff: diffA + penalty
    };
    
  }).sort((a, b) => {
    // ----------------------------------------------------
    // ด่านที่ 1: ตัดสินด้วย A ก่อน (ถ้าอยากให้ B สำคัญสุด ให้แก้เป็น _diffB ครับ)
    if (Math.abs(a._diffA - b._diffA) > 0.001) {
      return a._diffA - b._diffA; 
    }
    
    // ด่านที่ 2: ถ้า A เท่ากันเป๊ะ ค่อยมาตัดสินกันด้วย B
    if (Math.abs(a._diffB - b._diffB) > 0.001) {
      return a._diffB - b._diffB;
    }
    
    // ด่านที่ 3: ถ้า A และ B เท่ากัน ให้ตัดสินด้วย E
    return a._diffE - b._diffE;
    // ----------------------------------------------------
  });
}

/**
 * Loading Chute
 */
function searchKS400B_LoadingChute(fixData, h, sheetName, calc) {
  // Check machine limits
  if (calc.od_turning > KS400B_OD_MAX || calc.w_aft > KS400B_W_MAX) {
    return [];
  }
  
  return fixData.filter(row => {
    const toolType = String(row[h('Tooling_name')]).toUpperCase();
    return toolType.includes('LOADING CHUTE') || toolType.includes('CHUTE');
  }).map(row => {
    const fixA = parseFloat(row[h('LOADING_CHUTE_A')]);
    const fixC = parseFloat(row[h('LOADING_CHUTE_C')]);
    const fixD = parseFloat(row[h('LOADING_CHUTE_D')]);
    
    let penalty = 0;
    let diffA = 999, diffC = 999, diffD = 999;

    // C: ความกว้าง (ห้ามแคบกว่างาน)
    if (!isNaN(fixC) && calc.lc_C !== undefined) {
       if (fixC < calc.lc_C - 0.01) penalty += 10000; // แคบไป งานติด
       diffC = Math.abs(fixC - calc.lc_C);
    }

    // D: ความสูง (ห้ามเตี้ยกว่างาน)
    if (!isNaN(fixD) && calc.lc_D !== undefined) {
       if (fixD < calc.lc_D - 0.01) penalty += 10000; // เตี้ยไป งานติด
       diffD = Math.abs(fixD - calc.lc_D);
    }

    // A: ระยะตำแหน่ง (ยอมให้ต่างได้ แต่คำนวณความเพี้ยนไว้จัดอันดับ)
    if (!isNaN(fixA) && calc.lc_A !== undefined) {
       diffA = Math.abs(fixA - calc.lc_A);
    }

    return {
      no: row[h('Tooling_no')],
      machine: row[h('Machine')] || sheetName,
      val1: row[h('LOADING_CHUTE_A')],
      val2: row[h('LOADING_CHUTE_B')],
      val3: row[h('LOADING_CHUTE_C')],
      val4: row[h('LOADING_CHUTE_D')],
      val5: row[h('LOADING_CHUTE_E')],
      val6: row[h('LOADING_CHUTE_F')],
      
      // ลำดับความสำคัญ: Penalty กีดกันตัวเล็กกว่าทิ้ง -> จัดอันดับด้วย D -> C -> A
      _diff: penalty + diffD + (diffC / 100) + (diffA / 10000) 
    };
  }).sort((a, b) => a._diff - b._diff);
}

/**
 * Support Block
 */
function searchKS400B_SupportBlock(fixData, h, sheetName, calc) {
  // Check machine limits
  if (calc.od_turning > KS400B_OD_MAX || calc.w_aft > KS400B_W_MAX) {
    return [];
  }
  
  return fixData.filter(row => {
    // กรองแค่ว่าเป็น SUPPORT BLOCK ก็พอ ยอมให้ผ่านเข้ารอบไปคิดคะแนนให้หมด
    const toolType = String(row[h('Tooling_name')]).toUpperCase();
    return toolType.includes('SUPPORT BLOCK');

  }).map(row => {
    const fixA = parseFloat(row[h('SUPPORT_BLOCK_A')]);
    const fixB = parseFloat(row[h('SUPPORT_BLOCK_B')]);
    const fixC = parseFloat(row[h('SUPPORT_BLOCK_C')]);
    const fixD = parseFloat(row[h('SUPPORT_BLOCK_D')]);
    const fixE = parseFloat(row[h('SUPPORT_BLOCK_E')]);

    // ถ้าค่าพัง (ไม่มีข้อมูลในตาราง) โดนปรับตก
    if (isNaN(fixA) || isNaN(fixB) || isNaN(fixC) || isNaN(fixD) || isNaN(fixE)) {
      return { _diffB: 99999, _diffA: 99999, _diffC: 99999, _diff: 99999 }; // หลอกให้ไปอยู่ล่างสุด
    }

    // -----------------------------------------------------
    // ตรวจสอบเงื่อนไขว่าผ่านเกณฑ์ไหม (ถ้าไม่ผ่าน จะโดน Penalty)
    // -----------------------------------------------------
    let penalty = 0;

    // A: (0 ถึง +0.5)
    const diffA_real = fixA - calc.sb_A;
    if (diffA_real < -0.01 || diffA_real > 0.51) penalty += 10000;

    // C: (0 ถึง +0.2)
    const diffC_real = fixC - calc.sb_C;
    if (diffC_real < -0.01 || diffC_real > 0.21) penalty += 10000;

    // D: (+-0.5)
    if (Math.abs(fixD - calc.sb_D) > 0.51) penalty += 10000;

    // E: (0 ถึง +0.5)
    const diffE_real = fixE - calc.sb_E;
    if (diffE_real < -0.01 || diffE_real > 0.51) penalty += 10000;

    // B: ถ้าห่างจากเป้าหมายเกิน +- 0.5 โดนปรับตกเหมือนกัน
    const diffB_abs = Math.abs(fixB - calc.sb_B);
    if (diffB_abs > 0.51) penalty += 10000;

    // -----------------------------------------------------

    const diffA_abs = Math.abs(diffA_real);
    const diffC_abs = Math.abs(diffC_real);

    return {
      no: row[h('Tooling_no')],
      machine: row[h('Machine')] || sheetName,
      val1: row[h('SUPPORT_BLOCK_A')],
      val2: row[h('SUPPORT_BLOCK_B')],
      val3: row[h('SUPPORT_BLOCK_C')],
      val4: row[h('SUPPORT_BLOCK_D')],
      val5: row[h('SUPPORT_BLOCK_E')],
      
      // การให้คะแนน: เอา penalty ไปบวกใส่ B เลย ถ้าทูลตัวไหนติด Penalty จะโดนเด้งไปอยู่ท้ายตารางทันที
      _diffB: penalty + diffB_abs,
      _diffA: diffA_abs,
      _diffC: diffC_abs,
      _diff: penalty + diffB_abs 
    };

  }).sort((a, b) => {
    // กฎการเรียงลำดับ: B ต้องดีที่สุดก่อน -> ถ้า B เท่ากันไปดู A -> ถ้า A เท่ากันไปดู C
    if (Math.abs(a._diffB - b._diffB) > 0.001) {
      return a._diffB - b._diffB; 
    }
    if (Math.abs(a._diffA - b._diffA) > 0.001) {
      return a._diffA - b._diffA;
    }
    return a._diffC - b._diffC;
  });
}

/**
 * Plug A (F=48)
 */
function searchKS400B_PlugA(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const toolType = String(row[h('Tooling_name')]).toUpperCase();
    if (!toolType.includes('PLUG(A)')) return false;
    
    const fixA = parseFloat(row[h('PLUG_A_OD_A')]);
    const fixB = parseFloat(row[h('PLUG_A_OD_B')]);
    const fixC = parseFloat(row[h('PLUG_A_DEPTH_C')]);
    
    // Only strictly require A to be present
    if (isNaN(fixA)) return false;
    if (Math.abs(fixA - calc.pa_A) > 0.5) return false;
    
    // Check B only if it exists in DB to prevent filtering out valid rows
    if (!isNaN(fixB) && calc.pa_B !== undefined) {
      if (Math.abs(fixB - calc.pa_B) > 2.0) return false;
    }
    
    // Check C only if it exists in DB
    if (!isNaN(fixC) && calc.pa_C !== undefined) {
      if (Math.abs(fixC - calc.pa_C) > 5.0) return false;
    }
    
    return true;
  }).map(row => {
    // ดึงค่าทุกมิติออกมาคำนวณ
    const fixA = parseFloat(row[h('PLUG_A_OD_A')]);
    const fixB = parseFloat(row[h('PLUG_A_OD_B')]);
    const fixC = parseFloat(row[h('PLUG_A_DEPTH_C')]);
    const fixE = parseFloat(row[h('PLUG_A_DIST_E')]);

    // คำนวณความเพี้ยน (ถ้าข้อมูลในชีทแหว่ง/ว่าง จะถูกปัดให้คะแนนเพี้ยนเยอะๆ ไว้ก่อน)
    const diffA = isNaN(fixA) ? 100 : Math.abs(fixA - calc.pa_A);
    const diffB = isNaN(fixB) ? 100 : Math.abs(fixB - calc.pa_B);
    const diffC = isNaN(fixC) ? 100 : Math.abs(fixC - calc.pa_C);
    const diffE = isNaN(fixE) ? 100 : Math.abs(fixE - calc.pa_E);

    // รวมความคลาดเคลื่อนทั้งหมด (Total Difference)
    const totalDiff = diffA + diffB + diffC + diffE;
    
    return {
      no: row[h('Tooling_no')],
      machine: row[h('Machine')] || sheetName,
      type: calc.pa_type,
      val1: row[h('PLUG_A_OD_A')],
      val2: row[h('PLUG_A_OD_B')],
      val3: row[h('PLUG_A_DEPTH_C')],
      val4: row[h('PLUG_A_CHAM_D')],
      val5: row[h('PLUG_A_DIST_E')],
      valF: 48,
      _totalDiff: totalDiff // เก็บค่าผลรวมไว้ให้ .sort() ใช้งาน
    };
  }).sort((a, b) => a._totalDiff - b._totalDiff); // เรียงลำดับจากเพี้ยนน้อยที่สุด ไปมากที่สุด
}

/**
 * Plug B (F=70)
 */
function searchKS400B_PlugB(fixData, h, sheetName, calc) {
  return fixData.filter(row => {
    const toolType = String(row[h('Tooling_name')]).toUpperCase();
    // รองรับการพิมพ์ชื่อทั้ง PLUG(B) และ PLUG (B)
    return toolType.includes('PLUG(B)') || toolType.includes('PLUG (B)');
    
  }).map(row => {
    const fixA = parseFloat(row[h('PLUG_B_OD_A')]);
    const fixB = parseFloat(row[h('PLUG_B_OD_B')]);
    const fixC = parseFloat(row[h('PLUG_B_DEPTH_C')]);

    // ถ้าข้อมูลพัง/ไม่มีค่า A หรือ B ให้ปรับตกไปอยู่ล่างสุดทันที
    if (isNaN(fixA) || isNaN(fixB)) {
      return { _diffB: 99999, _diffA: 99999, _diffC: 99999, _diff: 99999 };
    }

    // หาระยะห่างของแต่ละค่า (ใช้ Math.abs จะได้เช็กง่ายๆ ว่าห่างเป้าเท่าไหร่)
    const diffB = calc.pb_B !== undefined ? Math.abs(fixB - calc.pb_B) : 0;
    const diffA = calc.pb_A !== undefined ? Math.abs(fixA - calc.pb_A) : 0;
    const diffC = (calc.pb_C !== undefined && !isNaN(fixC)) ? Math.abs(fixC - calc.pb_C) : 0;

    // ระบบ Penalty: ถ้าห่างจากเป้าเกิน Allow ที่เรารับได้ ให้บวกคะแนนโทษเพื่อผลักไปท้ายตาราง
    // (สมมติให้อนุโลมคลาดเคลื่อนได้ 1.0 ถ้าอยากให้เข้มงวดกว่านี้ ปรับเลข 1.01 ลงได้ครับ)
    let penalty = 0;
    if (diffB > 1.01) penalty += 10000;
    if (diffA > 1.01) penalty += 10000;

    return {
      no: row[h('Tooling_no')],
      machine: row[h('Machine')] || sheetName,
      type: calc.pb_type,
      val1: row[h('PLUG_B_OD_A')],
      val2: row[h('PLUG_B_OD_B')],
      val3: row[h('PLUG_B_DEPTH_C')],
      val4: row[h('PLUG_B_CHAM_D')],
      val5: row[h('PLUG_B_DIST_E')],
      valF: 70, // ค่าคงที่ตามสเปก Plug B

      // ส่งคะแนนแยกด่านไปให้ Sort ทำงาน
      _diffB: penalty + diffB,
      _diffA: diffA,
      _diffC: diffC,
      _diff: penalty + diffB // แนบค่า _diff ไว้สำหรับเผื่อระบบใช้อ้างอิง
    };

  }).sort((a, b) => {
    // ด่านที่ 1: ตัดสินด้วยค่า B ก่อนเสมอ
    if (Math.abs(a._diffB - b._diffB) > 0.001) {
      return a._diffB - b._diffB; 
    }
    
    // ด่านที่ 2: ถ้าค่า B เท่ากันเป๊ะ ค่อยมาตัดสินกันด้วย A
    if (Math.abs(a._diffA - b._diffA) > 0.001) {
      return a._diffA - b._diffA;
    }
    
    // ด่านที่ 3: ถ้า A ยังเท่ากันอีก ถึงจะมาตัดสินกันด้วย C
    return a._diffC - b._diffC;
  });
}