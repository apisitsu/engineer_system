/**
 * Part Data
 */
function calculateToolingParams(part) {
  // JAW & BACK PLATE Logic ---
  // jawA depends on Process:
  // ID→OD: jaw holds OD while grinding ID first → OD not yet ground → use OD_bf
  // OD→ID or empty: jaw holds OD while grinding ID → OD already ground → use OD_aft
  const jawA = part.process === "ID→OD" ? part.odBf : part.odAft;
  const jawB = jawA - 0.4;        

  const normalBaseC = 18.5 + (part.wAft / 2) + 3;
  const specialBaseC = 18.5 + part.wAft - 2;
  let baseC;
  if ((part.type.includes("NORMAL") || part.type.includes("OTHER")) && !part.yBall.includes("Y")) {
    baseC = normalBaseC; // STANDARD: 18.5 + W/2 + 3
  } else {
    baseC = specialBaseC; // ABR etc. (ball-inner): 18.5 + W - 2
  }

  const ID_part = part.idAft + part.idTolPlus;
  const bpAA = parseFloat((ID_part + 0.3).toFixed(2));
  const bpBB = Math.ceil((bpAA + 1.0) * 10) / 10; // Round up to nearest 0.1 per formula spec

  // CHUTE Logic ---
  const chuteCalcA = parseFloat((part.odAft + 0.2).toFixed(2));
  const chuteCalcB = parseFloat((part.wAft + 0.1).toFixed(2));
  const tempChuteC = chuteCalcB + 5;
  const chuteCalcC = Math.ceil(tempChuteC / 5) * 5;
  const chuteCalcD = parseFloat((12 + (chuteCalcA / 2)).toFixed(2));

  // CARRIER Logic (TSG-300ZNC) ---
  const carrierCalcA = parseFloat((part.odAft + 0.5).toFixed(2));
  const carrierCalcB = parseFloat((404 - carrierCalcA).toFixed(2)); 
  const carrierCalcC = parseFloat(((400 + carrierCalcA - carrierCalcB) / 2).toFixed(2));

  const wVal = part.wAft * 0.55;
  let maxCarrierD = null;
  
  if (wVal <= 2.5) maxCarrierD = 2.5;
  else if (wVal <= 3.0) maxCarrierD = 3.0;
  else if (wVal <= 4.0) maxCarrierD = 4.0;
  else if (wVal <= 4.5) maxCarrierD = 4.5;
  else if (wVal <= 5.0) maxCarrierD = 5.0;
  else if (wVal <= 6.0) maxCarrierD = 6.0;
  else if (wVal <= 7.0) maxCarrierD = 7.0; // added intermediate step to avoid 6→8 jump
  else if (wVal <= 8.0) maxCarrierD = 8.0;
  else if (wVal <= 9.0) maxCarrierD = 9.0;
  else if (wVal <= 10.0) maxCarrierD = 10.0;
  else if (wVal <= 12.0) maxCarrierD = 12.0;
  else {
    maxCarrierD = Math.round(wVal);
  }

  // CARRIER Logic (TSG300W) ---
  const odMin = part.odBf - part.odBfTolMinus; // min OD: used to cap carrier upper bound
  const odMax = part.odBf + part.odBfTolPlus;  // max OD: used as carrier lower bound
  const tsgW_Amin = parseFloat((odMax + 0.1).toFixed(2)); // carrier must fit largest part
  const tsgW_Amax = parseFloat((odMin + 1.0).toFixed(2)); // carrier max clearance = 1mm from min OD
  
  const wRounded = Math.ceil(part.wAft * 10) / 10; 
  const tsgW_Emin = parseFloat((wRounded * 0.6).toFixed(2));
  const tsgW_Emax = parseFloat((wRounded * 0.9).toFixed(2));

  // Return Object
  return {
    jawA, jawB, baseC, ID_part, bpAA, bpBB,
    chuteCalcA, chuteCalcB, chuteCalcC, chuteCalcD,
    carrierCalcA, carrierCalcB, carrierCalcC, maxCarrierD,
    tsgW_Amin, tsgW_Amax, tsgW_Emin, tsgW_Emax
  };
}

/**
 * Get Shoulder Diameter (SD) from table
 * Yball = Y → use SD column, Yball = N → use SD_aft column
 */
function calculateSD(part) {
  const SD = part.yBall === "Y" ? part.sd : part.sdAft;
  if (!SD || isNaN(SD) || SD <= 0) {
    console.warn(`SD value not found in table for Yball=${part.yBall}`);
    return null;
  }
  return SD;
}

/**
 * KS400B Tooling Calculations
 */
function calculateKS400B_Params(part) {
  const OD_turning = part.odBf || 0;
  const W = part.wAft || 0;
  const ID = part.idAft || 0;

  // Calculate SD first
  const SD = calculateSD(part);
  
  if (OD_turning > 32 || W > 30) {
    return { error: 'Part size is out of KS400B machine limits' };
  }

  if (SD === null) {
    // Cannot calculate - return null object
    return {
      error: 'Cannot calculate SD: W >= OD',
      od_turning: part.odBf,
      w_aft: part.wAft
    };
  }
  
  // === WORK DRIVER ===
  const wd_type = SD < 19.5 ? 'TYPE1' : 'TYPE2';
  const wd_A = Math.ceil((SD - 0.5) * 2) / 2; // Round up to 0.5
  const wd_B = Math.floor((ID - 0.8) * 2) / 2; // Round down to 0.5
  const wd_C = wd_A < 13 ? 32 : 36;
  const wd_D = SD < 13.5 ? 24 : 30;
  // E and F depend on machine model (B~B3 vs B4)
  // Using default B~B3 values
  const wd_E = 23;
  const wd_F = 8;
  
  // === SUPPORT BLOCK ===
  const sb_A = parseFloat((20 + (OD_turning / 3)).toFixed(2));
  const sb_B = parseFloat((W + 0.3).toFixed(2));
  const sb_C = parseFloat((OD_turning * (5/6)).toFixed(2));
  const sb_D = parseFloat((30 - (OD_turning / 2)).toFixed(2));
  const sb_E = parseFloat((30 + (OD_turning / 4)).toFixed(2));
  const sb_hasR = OD_turning >= 30; // R5 when OD >= 30
  
  // === LOADING CHUTE ===
  const lc_E = Math.floor(OD_turning / 6); // Round down
  const lc_A = Math.ceil(197 - (OD_turning / 2) + lc_E); // Round up
  const lc_B = Math.ceil(W + 6); // Round up
  const lc_C = parseFloat((W + 0.2).toFixed(2));
  const lc_D = Math.ceil(parseFloat((OD_turning + 0.2).toFixed(3)) * 10) / 10;
  const lc_F = lc_C; // F = C
  
  // === PLUG A (F=48) ===
  let pa_A;
  if (ID < 20) {
    pa_A = parseFloat((ID * 0.7).toFixed(2));
  } else {
    pa_A = parseFloat((ID - 4.0).toFixed(2));
  }
  
  // Determine TYPE for Plug A
  let pa_type, pa_E;
  if (SD <= 8.5) {
    pa_type = 'TYPE1';
    pa_E = parseFloat((pa_A / 2).toFixed(2));
  } else if (ID <= 11.4) {
    pa_type = 'TYPE2';
    pa_E = 4;
  } else {
    pa_type = 'TYPE3';
    pa_E = parseFloat((pa_A / 2).toFixed(2));
  }
  
  const pa_B = parseFloat((SD - 0.5).toFixed(2)); // Allow 0.3~0.5
  
  let pa_C;
  if (W <= 5) {
    pa_C = 7; // PNG: 6~8 range, using middle value
  } else {
    pa_C = parseFloat((W * 0.9).toFixed(2)); // PNG: W×0.9 (5<W≤20), extended for W>20
  }
  
  const pa_D = ID < 4 ? 0.5 : 1.0;
  const pa_F = 48; // Constant for Plug A
  
  // === PLUG B (F=70) ===
  // Different A formula!
  let pb_A;
  if (ID < 20) {
    pb_A = parseFloat((ID - 0.7).toFixed(2)); // Subtract, not multiply!
  } else {
    pb_A = parseFloat((ID - 1.0).toFixed(2));
  }
  
  // B, C, D, E same as Plug A
  const pb_B = pa_B;
  const pb_C = pa_C;
  const pb_D = pa_D;
  const pb_E = pa_E;
  const pb_F = 70; // Constant for Plug B
  
  // Return all calculated values
  return {
    SD: SD.toFixed(3),
    
    // Work Driver
    wd_type, wd_A, wd_B, wd_C, wd_D, wd_E, wd_F,
    
    // Support Block
    sb_A, sb_B, sb_C, sb_D, sb_E, sb_hasR,
    
    // Loading Chute
    lc_A, lc_B, lc_C, lc_D, lc_E, lc_F,
    
    // Plug A
    pa_type, pa_A, pa_B, pa_C, pa_D, pa_E, pa_F,
    
    // Plug B
    pb_A, pb_B, pb_C, pb_D, pb_E, pb_F,
    pb_type: pa_type,

    // Keep original values for limit checking
    od_turning: OD_turning,
    w_aft: W
  };
}

/**
 * KS-03A All 9 Toolings Calculations
 */
function calculateKS03A_Params(part) {
  // ดึงค่าตั้งต้น
  const OD_nom = part.odAft || 0;
  const OD_max = part.odAft + part.odAftTolPlus;
  const W_nom = part.wAft || 0;
  const W_max = part.wAft + part.wAftTolPlus;
  const ID_nom = part.idAft || 0;
  const ID_min = part.idAft - part.idTolMinus;
  const ID_max = part.idAft + part.idTolPlus;
  const SD = calculateSD(part) || 0;

  // ตรวจสอบงาน ABR (Yball = B, Y หรือ Type มีคำว่า ABR)
  const typeStr = String(part.type || "").toUpperCase();
  const yBallStr = String(part.yBall || "").toUpperCase();
  const isABR = typeStr.includes("ABR") || yBallStr === "Y" || yBallStr === "B";

  if (OD_nom > 33) return { error: 'OD > 33, Cannot use KS-03A' };

  // ==========================================
  // 1. CPX SHOE
  // ==========================================
  let cpx_Type = OD_nom <= 15 ? "TYPE1" : (OD_nom <= 20 ? "TYPE2" : (OD_nom <= 30 ? "TYPE3" : "TYPE4"));
  const cpx_A = parseFloat((W_nom + 0.14).toFixed(3));
  const cpx_C = parseFloat((W_nom - 0.5).toFixed(3));
  const cpx_D = parseFloat(((OD_nom * 0.1) + 15.88).toFixed(3));
  
  let cpx_V = "-";
  if (isABR) {
    cpx_V = "Check Dwg";
  } else {
    if (cpx_C < 6) cpx_V = cpx_C.toFixed(3);
    else if (cpx_C < 8) cpx_V = "4.000";
    else cpx_V = "5.000";
  }

  // ==========================================
  // 2. ROLLER SHOE
  // ==========================================
  let rs_Type = "TYPE3";
  if (W_max >= 7.0 && W_max < 12.3) rs_Type = "TYPE1";
  else if (W_max >= 12.3 && W_max < 29.0) rs_Type = "TYPE2";

  // A: 15.88 + (0.1 x OD) [Round up ทศนิยม 2 ตำแหน่ง]
  const rs_A = Math.ceil((15.88 + (0.1 * OD_max)) * 100) / 100;
  
  // B: 68.26 - (0.5 x OD) + offset [Round up ทศนิยม 2 ตำแหน่ง]
  let temp_B = 68.26 - (0.5 * OD_max);
  if (OD_max < 13) temp_B += 0.1;
  else if (OD_max < 17) temp_B += 0.3;
  else if (OD_max < 22) temp_B += 0.5;
  else temp_B += 0.8;
  const rs_B = Math.ceil(temp_B * 100) / 100;

  // C: W + 0.2
  const rs_C = parseFloat((W_max + 0.2).toFixed(2));
  
  // D: OD + 1.0 [Round off ทศนิยม 1 ตำแหน่ง]
  const rs_D = Math.round((OD_max + 1.0) * 10) / 10;

  // ==========================================
  // 3. CHUTE COVER
  // ==========================================
  const chute_Type = OD_max < 19.05 ? "TYPE1" : "TYPE2";
  const chute_A = Math.round((OD_max + 0.2) * 10) / 10; // Round off 四捨五入
  const chute_B = Math.round((W_max + 0.15) * 10) / 10;
  
  let chute_C = 0;
  if (W_max <= 8.35) chute_C = 13;
  else if (W_max <= 13.35) chute_C = 18;
  else if (W_max <= 19.35) chute_C = 24;
  else if (W_max <= 25.35) chute_C = 30;
  else chute_C = 36;

  const chute_D = Math.round(W_max - 1);
  let chute_E = chute_Type === "TYPE1" ? Math.round((20.88 - (1.1 * OD_max))*10)/10 : Math.round((34.88 - (1.1 * OD_max))*10)/10;
  if (chute_E < 1.5) chute_E = null; // None

  const chute_F = Math.floor(chute_C - chute_B - 1); // Round down 整数切り下げ

  let chute_G = null, chute_H = null;
  if (chute_E !== null) {
    chute_G = chute_Type === "TYPE1" ? chute_E + 42 : chute_E + 52;
    if (chute_G > 55.8) chute_G = 55.8; // MAX 55.8
    chute_H = chute_Type === "TYPE1" ? chute_E + 226.6 : chute_E + 212.6;
  }

  // ==========================================
  // 4. FRONT PLATE
  // ==========================================
  const fp_Type = OD_max < 19.05 ? "TYPE1" : "TYPE2";
  const fp_A = parseFloat((ID_min + 0.15).toFixed(3)); // F"A"
  const fp_B = fp_Type === "TYPE1" ? 36.96 : 50.96;
  const fp_C = fp_Type === "TYPE1" ? 15 : (OD_max < 30 ? 40 : 30);
  
  let fp_D = SD < 10.5 ? 11 : (SD < 17.5 ? 18 : (SD < 21.5 ? 22 : 32));
  let fp_E = SD < 17.5 ? 1.6 : 2.6;
  let fp_F = SD < 10.5 ? 7.94 : (SD < 17.5 ? 14.3 : (SD < 21.5 ? 19.05 : 28.55));
  
  const fp_G = parseFloat((cpx_D + (OD_max / 2) - 1).toFixed(3));
  const fp_H = parseFloat((12.7 + chute_A - 9).toFixed(3));
  const fp_J = parseFloat((fp_H + 9).toFixed(3));

  // ==========================================
  // 5. SETTING GAUGE (ใช้ fp_A)
  // ==========================================
  let sg_Type = fp_A < 10 ? "TYPE1" : (fp_A < 19 ? "TYPE2" : "TYPE3");
  const sg_A = fp_A;
  const sg_B = sg_Type === "TYPE1" ? parseFloat((W_nom + 63).toFixed(3)) : parseFloat((W_nom + 67).toFixed(3));
  const sg_C = sg_Type === "TYPE1" ? 14 : (sg_Type === "TYPE2" ? 20 : 22);
  const sg_D = sg_Type === "TYPE1" ? 12 : 16;
  const sg_M = sg_Type === "TYPE1" ? "M6x1.0" : "M8x1.25";

  // ==========================================
  // 6. MASTER RING GAUGE (ใช้ fp_A)
  // ==========================================
  const mr_A = OD_max; // After Grind (MAX)
  const mr_B = fp_A;
  const mr_C = W_nom;

  // ==========================================
  // 7. PLUG GAUGE
  // ==========================================
  const pg_Type = sg_Type;
  const pg_T = parseFloat((ID_max - ID_min).toFixed(3));
  const pg_Tc = parseFloat(((ID_max + ID_min) / 2).toFixed(3));
  
  const pg_A = ID_nom;
  
  // คำนวณขนาดจริง (Absolute) ก่อน
  const abs_pg_B = pg_T <= 0.012 ? (ID_min + 0.005) : (pg_Tc - 0.001);
  const abs_pg_C = pg_T <= 0.012 ? (ID_min + 0.03) : (pg_Tc - 0.003);
  
  // นำขนาดจริง มาลบ A (ID_nom) เพื่อแปลง REQ ให้เป็นค่า Tolerance (+/-)
  const pg_B = parseFloat((abs_pg_B - pg_A).toFixed(3));
  const pg_C = parseFloat((abs_pg_C - pg_A).toFixed(3));

  const pg_D = pg_Type === "TYPE1" ? null : parseFloat((pg_A - 4).toFixed(3));
  const pg_E = pg_Type === "TYPE1" ? null : parseFloat((pg_A - 2).toFixed(3));
  const pg_F = pg_Type === "TYPE1" ? 14 : (pg_Type === "TYPE2" ? 20 : 22);

  // ==========================================
  // 8. LOADER (รองรับทั้งรุ่นปกติ และ Nylon)
  // ==========================================
  const ld_A_target = parseFloat((W_nom - 1).toFixed(1)); // เป้าหมายหลัก (W-1)
  const ld_A_max = parseFloat(W_nom.toFixed(2));
  const ld_A_min = parseFloat((W_nom * 0.6).toFixed(2));
  
  // 1/1000 Round down (ตัดทศนิยมให้เหลือ 2 ตำแหน่ง)
  const ld_B = Math.floor(OD_nom * 100) / 100;
  const ld_C = Math.floor((OD_nom / 2 + 0.5) * 100) / 100; // สูตรนี้เป็นของ Nylon
  
  let ld_D = 0;
  if (OD_nom <= 12.7) ld_D = 12.7;
  else if (OD_nom <= 15.9) ld_D = 15.9;
  else if (OD_nom <= 19.1) ld_D = 19.1;
  else if (OD_nom <= 23.8) ld_D = 23.8;
  else ld_D = 28.0;

  const ld_E = OD_nom <= 15 ? 25 : 30;

  // F: OD (1/100 Round up 切上げ = ปัดขึ้นให้เหลือทศนิยม 1 ตำแหน่ง)
  const ld_F = Math.ceil(OD_nom * 10) / 10;

  // อย่าลืมอัปเดตตอน return ค่า ld ด้วยนะครับ
  // ld: { A_target: ld_A_target, A_min: ld_A_min, A_max: ld_A_max, B: ld_B, C: ld_C, D: ld_D, E: ld_E, F: ld_F },

  // ==========================================
  // 9. PRESSURE ROTOR
  // ==========================================
  const pr_A = parseFloat((fp_A + 0.05).toFixed(3)); // A = Front Plate A + 0.05
  
  let pr_Type = "TYPE3";
  if (pr_A <= 10) pr_Type = "TYPE1";
  else if (pr_A <= 16.25) pr_Type = "TYPE2";

  return {
    error: null,
    cpxShoe: { Type: cpx_Type, A: cpx_A, C: cpx_C, D: cpx_D, V: cpx_V },
    rollerShoe: { Type: rs_Type, A: rs_A, B: rs_B, C: rs_C, D: rs_D },
    chute: { Type: chute_Type, A: chute_A, B: chute_B, C: chute_C, D: chute_D, E: chute_E, F: chute_F, G: chute_G, H: chute_H },
    fp: { Type: fp_Type, A: fp_A, B: fp_B, C: fp_C, D: fp_D, E: fp_E, F: fp_F, G: fp_G, H: fp_H, J: fp_J },
    sg: { Type: sg_Type, A: sg_A, B: sg_B, C: sg_C, D: sg_D, M: sg_M },
    mr: { A: mr_A, B: mr_B, C: mr_C },
    pg: { Type: pg_Type, A: pg_A, B: pg_B, C: pg_C, D: pg_D, E: pg_E, F: pg_F },
    ld: { A_min: ld_A_min, A_max: ld_A_max, B: ld_B, C: ld_C, D: ld_D, E: ld_E },
    pr: { Type: pr_Type, A: pr_A } // ส่งค่า Pressure Rotor ออกไป!
  };
}

/**
 * KS500RD Tooling Calculations
 */
function calculateKS500RD_Params(part) {
  const ID = part.idAft || 0;
  const W = part.wAft || 0;
  const OD = part.odAft || 0; // ดึงค่า OD มาเพื่อเช็ก Limit
  
  // 1. เช็ก Machine Limit ก่อนเลย (ถ้าขนาดไม่ถึงเกณฑ์ ให้ปัดตกทันทีเพื่อไม่ให้โชว์ขยะในหน้าเว็บ)
  if (ID < 14 || ID > 38.125 || OD < 26 || OD > 59.531 || W < 23.5 || W > 51.15) {
    return { error: 'Part size is out of KS500RD machine limits' };
  }

  // 2. หาค่า SD (ถ้าไม่มี ให้คืนค่า error)
  const SD = calculateSD(part);
  if (SD === null) return { error: 'SD not found' };

  // ==========================================
  // 1. LOADING PINTLE
  // ==========================================
  // ใช้ Math.floor(val * 10) / 10 เพื่อตัดทศนิยมให้เหลือ 1 ตำแหน่งแบบไม่ปัดขึ้น (ตามตัวอย่างในภาพ)
  const lp_A = Math.floor((ID - 1.0) * 10) / 10;
  const lp_B = Math.floor((ID + 3.0) * 10) / 10;
  
  const lp_C = W <= 20 ? parseFloat((W * 0.6).toFixed(1)) : 12;
  
  let lp_D = 0;
  if (ID > 14.0 && ID <= 14.5) lp_D = 9.0;
  else if (ID > 14.5 && ID <= 24.5) lp_D = 9.5;
  else if (ID > 24.5) lp_D = 17.5;

  const lp_E = ID < 24.5 ? 5.5 : 11;
  const lp_F = Math.floor((ID - 4.5) * 10) / 10;
  const lp_G = ID < 24.5 ? 9 : 20;
  // H ใช้การปัดเศษปกติ (Round) ตามตัวอย่าง 18.25 -> 18.3
  const lp_H = Math.round((ID - 0.8) * 10) / 10;

  // ==========================================
  // 2. WORK DRIVER
  // ==========================================
  const wd_A = parseFloat((SD - 0.2).toFixed(2));
  const wd_B = parseFloat((wd_A - 7.0).toFixed(2));

  // ==========================================
  // 3. FRONT SHOE
  // ==========================================
  let fs_No = "";
  if (W >= 0 && W < 19) fs_No = "4033-03-0001";
  else if (W >= 19 && W < 21) fs_No = "4033-03-0002";
  else if (W >= 21 && W < 28) fs_No = "4033-03-0003";
  else if (W >= 28 && W < 37) fs_No = "4033-03-0004";
  else if (W >= 37 && W < 46) fs_No = "4033-03-0005";
  else if (W >= 46 && W < 100) fs_No = "4033-03-0006";
  else fs_No = "Out of Range";

  return {
    error: null,
    lp: { A: lp_A, B: lp_B, C: lp_C, D: lp_D, E: lp_E, F: lp_F, G: lp_G, H: lp_H },
    wd: { A: wd_A, B: wd_B },
    fs: { No: fs_No } 
  };
}

/**
 * KS400B5
 */
function calculateKS400B5_Params(part) {
  // ดึงค่าตั้งต้นของชิ้นงาน
  const W = part.wAft || 0;
  const V = part.odAft || 0;
  const OD_before = part.odBf || 0; // ดึงค่า OD ก่อนเจียรมาเช็กด้วยเพื่อความชัวร์
  const Y = part.sdAft || 0;
  const X = part.sd || 0;
  // สมมติว่า X (Shoulder MIN) คือคอลัมน์ SD ในชีท

  // 1. เช็ก Machine Limit (OD ≦ φ35 MAX)
  // ถ้าขนาด OD (ทั้งก่อนหรือหลังเจียร) ใหญ่กว่า 35 มม. ให้ปัดตกทันที ไม่ต้องคำนวณต่อ
  if (V > 35 || OD_before > 35) {
    return { error: 'Part OD > 35, out of KS-400B5 machine limits' };
  }

  const typeStr = String(part.type || "").toUpperCase();
  const yBallStr = String(part.yBall || "").toUpperCase();

  // ==========================================
  // 1. WORK CLAMP
  // ==========================================
  let wc_A = 0;
  
  // เช็กเงื่อนไขการหาค่า A
  const isBallInner = typeStr.includes("ABR") || typeStr.includes("BALL_INNER");
  
  if (isBallInner) {
    wc_A = V - 0.2;
  } else if (yBallStr === "Y") {
    wc_A = X - 0.2;
  } else {
    wc_A = Y - 1.5;
  }
  // ปัดทศนิยม 1 ตำแหน่งตามตัวอย่างในรูป (เช่น 19.75 -> 19.8)
  wc_A = Math.round(wc_A * 10) / 10;

  // คำนวณค่า B, C, D, E
  const wc_B = Math.round(49 - W); // (整数) จำนวนเต็ม
  const wc_C = Math.round(wc_B + 9); // (整数) จำนวนเต็ม
  const wc_D = 14;
  const wc_E = 5;

  // หาค่า TYPE (เงื่อนไขในรูปบอก TYPE1 ถ้า V หรือ X หรือ Y < 12.2)
  let wc_Type = (V < 12.2 || X < 12.2 || Y < 12.2) ? "TYPE1" : "TYPE2";

  // ==========================================
  // 2. SHAFT
  // ==========================================
  const shaft_X = part.sd || 0;
  
  // Y: ค่า ID ก่อนเจียร (Min) = Nominal + Minus Tolerance (ใช้ + เพราะค่าในชีทติดลบอยู่แล้ว)
  const shaft_Y = (part.idBf || 0) + (part.idBfTolMinus || 0); 
  const shaft_W = part.wAft || 0; 
  
  // A: X - 0.5 (ปัดทศนิยมให้เหลือ 1 ตำแหน่ง ตามตัวอย่าง)
  const shaft_A = Math.round((shaft_X - 0.5) * 10) / 10;
  
  // B: W <= 12 ใช้ 8, W > 12 ใช้ 10
  const shaft_B = shaft_W <= 12 ? 8 : 10;
  
  // C: Y - 0.5 (ปัดทศนิยมให้เหลือ 1 ตำแหน่ง)
  const shaft_C = Math.round((shaft_Y - 0.5) * 10) / 10;
  
  // TYPE: กำหนดโดยเช็กค่า A
  const shaft_Type = shaft_A < 14 ? "TYPE1" : "TYPE2";
  // ส่งค่ากลับไป

  // ==========================================
  // 3. WORK CHUTE
  // ==========================================
  // หาค่า V (หรือ Z) คือ OD ก่อนเจียร (MAX) = Nominal + Plus Tolerance
  const chute_max_VZ = (part.odBf || 0) + (part.odBfTolPlus || 0); 
  const chute_W = part.wAft || 0;
  
  // A: (V or Z) + 0.1 
  const chute_A = parseFloat((chute_max_VZ + 0.1).toFixed(2));
  
  // B: W + 0.1
  const chute_B = parseFloat((chute_W + 0.1).toFixed(2));
  
  // C: (V or Z)/2 + 27.55
  const chute_C = parseFloat(((chute_max_VZ / 2) + 27.55).toFixed(3));
  
  // D: W <= 20 ใช้ 30, W > 20 ใช้ 37
  const chute_D = chute_W <= 20 ? 30 : 37;

  // ==========================================
  // 4. WORK LOADER
  // ==========================================
  const wl_Z = part.odBf || 0; 
  const wl_W = part.wBf || part.wAft || 0; // ใช้ค่าก่อนเจียรเป็นหลัก (球研前)
  const wl_X = part.sd || 0; 

  // A: Z + 0.2 (จากตัวอย่าง 13.21 ปัดเป็น 13.2 จึงใช้การตัดทศนิยมทิ้ง)
  const wl_A = Math.floor((wl_Z + 0.2) * 10) / 10;
  
  // B: Z/2 + 10 (四捨五入 = Round)
  const wl_B = Math.round(((wl_Z / 2) + 10) * 10) / 10;
  
  // C: Z/2 + 27.5 (四捨五入 = Round)
  const wl_C = Math.round(((wl_Z / 2) + 27.5) * 10) / 10;
  
  // D: W (ดึงค่ามาตรงๆ 2 ตำแหน่ง)
  const wl_D = parseFloat(wl_W.toFixed(2));
  
  // E: ((W - √(Z² - X²)) / 2) - 1  และมีค่า MIN = 1
  // ใส่ Math.max(0, ...) กันเหนียวไว้เผื่อ Z < X แล้วรากติดลบ (Error)
  let wl_E = ((wl_W - Math.sqrt(Math.max(0, Math.pow(wl_Z, 2) - Math.pow(wl_X, 2)))) / 2) - 1;
  wl_E = Math.max(1, wl_E); // ถ้าคำนวณแล้วได้น้อยกว่า 1 ให้บังคับใช้ 1
  wl_E = Math.round(wl_E * 10) / 10; // ปัดให้เหลือ 1 ตำแหน่ง (ตัวอย่างคือ 3.1)
  
  // F: X + 0.5 (จากตัวอย่าง 11.56 ตัดเหลือ 11.5 จึงใช้ Floor)
  const wl_F = Math.floor((wl_X + 0.5) * 10) / 10;
  
  // G: 81.5 + B
  const wl_G = parseFloat((81.5 + wl_B).toFixed(1));

  // ==========================================
  // 5. WORK CHUCK
  // ==========================================
  // V (ในสูตรเขียน Z แต่แทนค่าด้วย V): (球研前)ワーク外径(ノミナル) = OD ก่อนเจียร Nominal
  const chuck_V = part.odBf || 0; 

  // A: V (หรือ Z) + 1.0 (ปัดทศนิยมให้เหลือ 1 ตำแหน่ง ตามตัวอย่าง 11.64 -> 11.6)
  const chuck_A = Math.round((chuck_V + 1.0) * 10) / 10;

  // ==========================================
  // 6. WORK HOLDER
  // ==========================================
  const wh_X = part.sd || 0; 

  // A: X + 2 (ปัดทศนิยมให้เหลือ 1 ตำแหน่ง ตามตัวอย่าง 29.08 -> 29.1)
  const wh_A = Math.round((wh_X + 2) * 10) / 10;

  // B: เช็กเงื่อนไขตามช่วงของ A
  let wh_B = 0;
  if (wh_A >= 11.5 && wh_A < 15) {
    wh_B = 10;
  } else if (wh_A >= 15 && wh_A < 18.5) {
    wh_B = 13;
  } else if (wh_A >= 18.5 && wh_A < 20.8) {
    wh_B = 16;
  } else if (wh_A >= 20.8 && wh_A < 27.7) {
    wh_B = 18;
  } else if (wh_A >= 27.7 && wh_A < 34.6) {
    wh_B = 24;
  } else {
    wh_B = 0; // เผื่อกรณีที่ค่า A หลุดช่วงที่กำหนดไว้
  }

  // ==========================================
  // 7. CHUCK JAW
  // ==========================================
  // Z: ワーク内径(MIN) = ID(MIN) หลังเจียร (ใช้ + เพราะค่า idTolMinus ในชีทติดลบอยู่แล้ว)
  const cj_Z = (part.idAft || 0) + (part.idTolMinus || 0);
  
  // Y: ワーク内径(MAX) = ID(MAX) หลังเจียร
  const cj_Y = (part.idAft || 0) + (part.idTolPlus || 0);
  
  // W: ワーク巾(ノミナル) = ความกว้างงาน (Nominal)
  const cj_W = part.wAft || 0;

  // A: Y + 0.5 (คงทศนิยม 2 ตำแหน่งตามตัวอย่าง 15.42)
  const cj_A = parseFloat((cj_Y + 0.5).toFixed(2));
  
  // B: A - 0.8 (คงทศนิยม 2 ตำแหน่งตามตัวอย่าง 14.62)
  const cj_B = parseFloat((cj_A - 0.8).toFixed(2));
  
  // C: 36 + (W * 0.67) 
  // ตัวอย่างได้ 53.42 แต่โชว์ 53.5 จึงใช้การปัดขึ้น (Ceil) ทศนิยม 1 ตำแหน่ง
  const cj_C = Math.ceil((36 + (cj_W * 0.67)) * 10) / 10;
  
  // D: Z - 0.03 (คงทศนิยม 2 ตำแหน่งตามตัวอย่าง 14.84)
  const cj_D = parseFloat((cj_Z - 0.03).toFixed(2));

  // ==========================================
  // 8. WORK CHUTE GUIDE
  // ==========================================
  // Z: (球研前)ワーク球径(公差上限) = OD ก่อนเจียร (MAX)
  const wcg_Z = (part.odBf || 0) + (part.odBfTolPlus || 0);
  
  // A: "4906-03-XXXX"のD値 -> ดึงค่า D จาก WORK CHUTE
  const wcg_A = chute_D;
  
  // B: 27.45 - Z/2 (ปัดทศนิยม 1 ตำแหน่ง)
  const wcg_B = Math.round((27.45 - (wcg_Z / 2)) * 10) / 10;
  
  // C: "4906-02-XXXX"のC値 -> ดึงค่า C จาก SHAFT
  const wcg_C = shaft_C; 
  
  // D: "4906-02-XXXX"のA値 -> ดึงค่า A จาก SHAFT
  const wcg_D = shaft_A;
  
  // E: D/2 + C/2 + 3 (整数 = ปัดเป็นจำนวนเต็ม)
  const wcg_E = Math.round((wcg_D / 2) + (wcg_C / 2) + 3);

  // ==========================================
  // 9. STOPPER
  // ==========================================
  // Y: ID ก่อนเจียรใน (MAX)
  const stopper_Y = (part.idBf || 0) + (part.idBfTolPlus || 0);

  // X: Shoulder Dia. หลังเจียร (MIN) -> อิงจาก SD
  const stopper_X = part.sd || 0;

  // A: Y + 0.5 (คงทศนิยม 2 ตำแหน่งตามตัวอย่าง)
  const stopper_A = parseFloat((stopper_Y + 0.5).toFixed(2));

  // B: X - 0.1 (ปัดทศนิยม 1 ตำแหน่งตามตัวอย่าง 19.85 -> 19.9)
  let stopper_B = Math.round((stopper_X - 0.1) * 10) / 10;
  // ป้องกันค่าติดลบตามเงื่อนไขที่ยอมให้เป็น 0 ได้ (0でも可)
  if (stopper_B < 0) stopper_B = 0;

  // ==========================================
  // 10. MASTER RING FOR JAW
  // ==========================================
  // Y: ワーク内径(球研前公差中心) = ID ก่อนเจียร (ค่ากึ่งกลาง Tolerance)
  const mrj_Y = (part.idBf || 0) + (((part.idBfTolPlus || 0) + (part.idBfTolMinus || 0)) / 2);

  // V (หรือ Z): ワーク外径(球研前公差中心) = OD ก่อนเจียร (ค่ากึ่งกลาง Tolerance)
  const mrj_V = (part.odBf || 0) + (((part.odBfTolPlus || 0) + (part.odBfTolMinus || 0)) / 2);

  // W: ワーク巾(ノミナル) = ความกว้างงาน (Nominal)
  const mrj_W = part.wBf || part.wAft || 0;

  // A: Y (ดึงค่ามาเลย ปัดทศนิยม 3 ตำแหน่งเผื่อไว้ให้ตัวเลขสวยงาม)
  const mrj_A = parseFloat(mrj_Y.toFixed(3));

  // B: Z or V
  const mrj_B = parseFloat(mrj_V.toFixed(3));

  // C: W (ปัดเศษทศนิยม 2 ตำแหน่ง ตามตัวอย่าง 22.169 -> 22.17)
  const mrj_C = Math.round(mrj_W * 100) / 100;

  // ส่งค่ากลับไป
  return {
    error: null,
    workClamp: { Type: wc_Type, A: wc_A, B: wc_B, C: wc_C, D: wc_D, E: wc_E },
    shaft: { Type: shaft_Type, A: shaft_A, B: shaft_B, C: shaft_C },
    workChute: { A: chute_A, B: chute_B, C: chute_C, D: chute_D },
    workLoader: { A: wl_A, B: wl_B, C: wl_C, D: wl_D, E: wl_E, F: wl_F, G: wl_G },
    workChuck: { A: chuck_A },
    workHolder: { A: wh_A, B: wh_B },
    chuckJaw: { A: cj_A, B: cj_B, C: cj_C, D: cj_D },
    workChuteGuide: { A: wcg_A, B: wcg_B, C: wcg_C, D: wcg_D, E: wcg_E },
    stopper: { A: stopper_A, B: stopper_B },
    masterRingForJaw: { A: mrj_A, B: mrj_B, C: mrj_C } // ปิดท้ายด้วยตัวที่ 10!
  };
} // <-- อย่าลืมปีกกาปิดฟังก์ชัน calculateKS400B5_Params นะครับ

/**
 * KS400B6 Tooling Calculations
 */
function calculateKS400B6_Params(part) {
  // ดึงค่าตั้งต้นของชิ้นงาน
  const ID = part.idAft || 0;
  
  // SD: 肩径(研磨前MAX) -> ใช้ฟังก์ชันหาค่า SD พื้นฐาน
  const SD = calculateSD(part);
  if (SD === null) {
    return { error: 'SD not found' };
  }

  // ==========================================
  // 1. WORK DRIVER
  // ==========================================
  // A: ID - 1.5 (小数点第一位 = ทศนิยม 1 ตำแหน่ง)
  const wd_A = Math.round((ID - 1.5) * 10) / 10;
  
  // B: SD
  const wd_B = parseFloat(SD.toFixed(3));
  
  // C: SD + 2.5 (整数 = ปัดเศษเป็นจำนวนเต็ม)
  const wd_C = Math.round(SD + 2.5);
  
  // D & E: ค่าคงที่
  const wd_D = 39;
  const wd_E = 45;

  // ==========================================
  // 2. LOADING CHUTE
  // ==========================================
  // หาค่า OD MAX (ก่อนเจียร) และ W MAX (หลังเจียร)
  const lc_OD_max = (part.odBf || 0) + (part.odBfTolPlus || 0);
  const lc_W_max = (part.wAft || 0) + (part.wAftTolPlus || 0);

  // A: 219 - (OD/2) ปัดเป็นจำนวนเต็ม
  const lc_A = Math.round(219 - (lc_OD_max / 2));

  // B: เช็กตามความกว้าง (W)
  let lc_B = 0;
  if (lc_W_max <= 10) lc_B = 20;
  else if (lc_W_max <= 20) lc_B = 30;
  else if (lc_W_max <= 30) lc_B = 40;
  else lc_B = 50; // เผื่อกรณี > 30

  // C: OD + 0.1
  const lc_C = parseFloat((lc_OD_max + 0.1).toFixed(2));

  // D: W + 0.1 ปัดทศนิยม 1 ตำแหน่ง
  const lc_D = Math.round((lc_W_max + 0.1) * 10) / 10;

  // F: กรณี Ball Inner ใช้ค่า TG, ปกติใช้ D/2
  let lc_F;
  const isInner = String(part.type || "").toUpperCase().includes("INNER") || 
                  String(part.yBall || "").toUpperCase() === "Y";
  
  if (isInner) {
    lc_F = "TG"; // ถ้าหน้าเว็บโชว์เป็น 'TG' แปลว่าต้องดึงค่า Track Gauge จาก Drawing มาใช้
  } else {
    lc_F = parseFloat((lc_D / 2).toFixed(1));
  }

  // ==========================================
  // 3. PLUG
  // ==========================================
  // ID ก่อนเจียร MIN (บวกค่าลบ)
  const plug_ID = (part.idBf || 0) + (part.idBfTolMinus || 0);
  const plug_W = part.wAft || 0;
  
  // A: ID - 1 (小数点第二位 = คงทศนิยม 2 ตำแหน่ง)
  const plug_A = parseFloat((plug_ID - 1).toFixed(2));
  
  // B: W - 1.5
  const plug_B = parseFloat((plug_W - 1.5).toFixed(2));
  
  // C: คำนวณตามเงื่อนไขของ SD
  let plug_C;
  if (SD <= 8) {
    plug_C = SD - 0.5;
  } else if (SD > 8 && SD < 9) {
    plug_C = 8;
  } else { // 9 <= SD
    plug_C = SD - 0.5;
  }
  plug_C = parseFloat(plug_C.toFixed(2));
  
  // D: คำนวณตามเงื่อนไขของ A
  let plug_D;
  if (plug_A <= 9) {
    plug_D = 0.5;
  } else { // 9 < A
    plug_D = 1;
  }

  // ==========================================
  // 4. WORK GUIDE
  // ==========================================
  // เช็กว่าเป็นงาน Inner หรือไม่
  const wg_isInner = String(part.type || "").toUpperCase().includes("INNER") || 
                     String(part.yBall || "").toUpperCase() === "Y";
                     
  const wg_W = part.wAft || 0;
  const wg_SD = calculateSD(part) || 0;
  const wg_DIA = (part.odBf || 0) + (part.odBfTolPlus || 0);
  const wg_OD = (part.odBf || 0) + (part.odBfTolPlus || 0); // ปกติใช้ค่า OD MAX เดียวกัน

  // A: W ปัดเป็นจำนวนเต็ม (整数)
  const wg_A = Math.round(wg_W);
  
  // C: DIA + 0.2 (ทศนิยม 1 ตำแหน่ง)
  const wg_C = Math.round((wg_DIA + 0.2) * 10) / 10;
  
  // E: A / 2
  const wg_E = wg_A / 2;

  let wg_B, wg_D;

  if (wg_isInner) {
    // กรณี Ball Inner
    wg_B = Math.round((45 - (wg_SD / 2)) * 10) / 10;
    wg_D = Math.round((((wg_OD - wg_SD) / 2) + 0.2) * 10) / 10;
  } else {
    // กรณี Normal Ball
    wg_B = Math.round((45 - (wg_SD / 2) - 1) * 10) / 10;
    wg_D = null; // None
  }

  // ==========================================
  // 5. WORK PUSHER
  // ==========================================
  // ดึงค่า ID ก่อนเจียร (MIN)
  const wp_ID = (part.idBf || 0) + (part.idBfTolMinus || 0); 
  // ใช้ค่า SD ที่คำนวณไว้ตอนต้น
  const wp_SD = SD; 
  
  // หาค่า L ตามเงื่อนไขของ SD
  let wp_L = 0;
  if (wp_SD <= 20) {
    wp_L = 61.5;
  } else if (wp_SD > 20 && wp_SD <= 32) {
    wp_L = 71;
  }
  
  // A: (SD + ID) / 2 (คงทศนิยม 2 ตำแหน่ง)
  const wp_A = parseFloat(((wp_SD + wp_ID) / 2).toFixed(2));
  
  // B: ID / 2 (คงทศนิยม 2 ตำแหน่ง)
  const wp_B = parseFloat((wp_ID / 2).toFixed(2));
  
  // C: L - (B / 2) (คงทศนิยม 2 ตำแหน่ง ตามตัวอย่าง 60.35)
  // ตัดทศนิยมตำแหน่งที่ 3 ทิ้งไปเลยแบบ Floor (เพื่อกัน JavaScript ปัดเศษขึ้นเป็น 60.36)
  const wp_C = Math.floor((wp_L - (wp_B / 2)) * 100) / 100;

  // ==========================================
  // 6. STOCKER CHUTE
  // ==========================================
  const sc_OD = (part.odBf || 0) + (part.odBfTolPlus || 0);
  const sc_W = part.wAft || 0;
  const sc_SD = SD; // ใช้ค่า SD ที่หาไว้แล้ว

  // Check Limit ถ้านอกเหนือสเปก ให้ส่งค่ากลับเป็น null ไปเลย (ป้องกันไม่ให้ไปดึง Tooling มาโชว์)
  let stockerChuteObj = null;

  if (sc_OD <= 32 && sc_W <= 26) {
    // A: OD + 0.5 (ปัดทศนิยม 1 ตำแหน่ง)
    const sc_A = Math.round((sc_OD + 0.5) * 10) / 10;
    
    // B: W + 0.5 (ปัดทศนิยม 1 ตำแหน่ง)
    const sc_B = Math.round((sc_W + 0.5) * 10) / 10;
    
    // C: อิงตามค่า W
    let sc_C;
    if (sc_W <= 17) sc_C = 22;
    else if (sc_W <= 27) sc_C = 32;
    else sc_C = 37;
    
    // D: อิงตามค่า SD
    let sc_D;
    if (sc_SD <= 6) sc_D = 2;
    else if (sc_SD <= 8) sc_D = 4;
    else if (sc_SD <= 10) sc_D = 6;
    else sc_D = 8;
    
    // E: B / 2 (ทศนิยม 1 ตำแหน่ง)
    const sc_E = parseFloat((sc_B / 2).toFixed(1));
    
    // F, G, H
    let sc_F, sc_G, sc_H;
    if (sc_W <= 6) {
      sc_F = "Ø2.1THRU."; sc_G = "M5x0.8THRU."; sc_H = 44;
    } else if (sc_W <= 10) {
      sc_F = "Ø3.1THRU."; sc_G = "M5x0.8THRU."; sc_H = 44;
    } else {
      sc_F = "M5x0.8THRU."; sc_G = "-"; sc_H = "-"; // なし = ไม่มี (-)
    }

    stockerChuteObj = { 
      A: sc_A, B: sc_B, C: sc_C, D: sc_D, E: sc_E, 
      F: sc_F, G: sc_G, H: sc_H 
    };
  }

  // ==========================================
  // 7. FRONT SHOE
  // ==========================================
  const fs_OD = (part.odBf || 0) + (part.odBfTolPlus || 0);
  const fs_W = part.wAft || 0;
  const fs_isInner = String(part.type || "").toUpperCase().includes("INNER") || 
                     String(part.yBall || "").toUpperCase() === "Y";

  let fs_A, fs_B, fs_C, fs_D;

  // C คือค่าคงที่
  fs_C = 0.15;

  // B ขึ้นอยู่กับขนาด OD
  fs_B = fs_OD < 10 ? 8 : 9;

  if (fs_isInner) {
    // กรณี Ball Inner ต้องการค่า V (ระยะขอบ)
    // *** สำคัญ: ถ้าในฐานข้อมูล SpecProcess มีคอลัมน์ V ให้เพิ่มการดึงค่ามาใส่ใน part.v ด้วยนะครับ ***
    fs_A = part.v !== undefined ? part.v : "Need V"; 
  } else {
    // กรณี Normal Ball
    fs_A = parseFloat(((fs_W / 2) + 2).toFixed(2)); // (จากตัวอย่าง 11.1/2 + 2 = 7.55)
  }

  // D: 31 - (10 - A - 1) ปัดเป็นจำนวนเต็ม
  if (typeof fs_A === 'number') {
    fs_D = Math.round(31 - (10 - fs_A - 1)); // (จากตัวอย่าง 31 - (10-7.55-1) = 29.55 ปัดเป็น 30)
  } else {
    fs_D = "-"; // กรณีที่เป็นงาน Inner แต่ไม่มีค่า V คำนวณไม่ได้
  }

  // ==========================================
  // 8. REAR SHOE
  // ==========================================
  const rs_OD = (part.odBf || 0) + (part.odBfTolPlus || 0);
  const rs_W = part.wAft || 0;
  const rs_isInner = String(part.type || "").toUpperCase().includes("INNER") || 
                     String(part.yBall || "").toUpperCase() === "Y";

  let rs_A, rs_B, rs_C, rs_D;

  // C ขึ้นอยู่กับขนาด OD
  rs_C = rs_OD < 10 ? 4 : 5;

  if (rs_isInner) {
    // กรณี Ball Inner ต้องการค่า X และ Y (ระยะขอบ)
    // *** สำคัญ: ถ้าในฐานข้อมูล SpecProcess มีคอลัมน์ X, Y ให้เพิ่มการดึงค่ามาใส่ใน part.x และ part.y ด้วยนะครับ ***
    rs_A = part.x !== undefined ? parseFloat((part.x - 1.0).toFixed(2)) : "Need X"; 
    rs_B = part.y !== undefined ? parseFloat((part.y + 1.0).toFixed(2)) : "Need Y"; 
  } else {
    // กรณี Normal Ball
    rs_A = parseFloat(((rs_W / 2) - 2).toFixed(2)); // (จากตัวอย่าง 11.1/2 - 2 = 3.55)
    rs_B = parseFloat(((rs_W / 2) + 2).toFixed(2)); // (จากตัวอย่าง 11.1/2 + 2 = 7.55)
  }

  // D: เช็กตามขนาดของ B
  if (typeof rs_B === 'number') {
    if (rs_B < 7.5) {
      rs_D = 30; // 30 องศา
    } else if (rs_B >= 7.5 && rs_B < 31) {
      rs_D = null; // None
    } else {
      rs_D = null; // เผื่อกรณีอื่นๆ
    }
  } else {
    rs_D = "-"; // ถ้าเป็น Inner แต่ไม่มีค่า Y (ทำให้คำนวณ B ไม่ได้) จะส่งค่า D ไม่ได้เช่นกัน
  }

  // ==========================================
  // 9. PILOT PIN
  // ==========================================
  const pp_ID = (part.idBf || 0) + (part.idBfTolMinus || 0);
  const pp_W = part.wAft || 0;

  // ตั้งค่า POD และ SHOD ตามค่าพื้นฐานใน Drawing (ถ้ามีข้อมูลใน part ให้ดึงมาใช้)
  const pp_POD = part.pod !== undefined ? part.pod : 2.0; 
  const pp_SHOD = part.shod !== undefined ? part.shod : 4.0;

  // หาค่า TYPE
  let pp_Type;
  if (pp_ID < 6) pp_Type = "TYPE1";
  else if (pp_ID < 10) pp_Type = "TYPE2";
  else pp_Type = "TYPE3";

  // A: ID - 0.5 (TYPE1) | ID - 1.0 (TYPE2,3) -> ตัดเศษเหลือ 1 ตำแหน่ง (Floor)
  let pp_A_raw = pp_Type === "TYPE1" ? pp_ID - 0.5 : pp_ID - 1.0;
  const pp_A = Math.floor(pp_A_raw * 10) / 10;

  // B: W + 1.5 (TYPE1) | W + 2.5 (TYPE2) | W + 2.0 (TYPE3) -> ปัดเศษปกติ (Round)
  let pp_B_raw;
  if (pp_Type === "TYPE1") pp_B_raw = pp_W + 1.5;
  else if (pp_Type === "TYPE2") pp_B_raw = pp_W + 2.5;
  else pp_B_raw = pp_W + 2.0;
  const pp_B = Math.round(pp_B_raw * 10) / 10;

  // C: ID - 1.0 (TYPE1) | ID - 1.5 (TYPE2,3) -> ตัดเศษเหลือ 1 ตำแหน่ง (Floor)
  let pp_C_raw = pp_Type === "TYPE1" ? pp_ID - 1.0 : pp_ID - 1.5;
  const pp_C = Math.floor(pp_C_raw * 10) / 10;

  // D: W - 1 (TYPE1, 2) | None (TYPE3) -> ตัดเศษเหลือ 1 ตำแหน่ง (Floor)
  let pp_D = "-";
  if (pp_Type !== "TYPE3") {
    pp_D = Math.floor((pp_W - 1) * 10) / 10;
  }

  // E: 6 (TYPE1) | 9 (TYPE2) | C (TYPE3)
  let pp_E;
  if (pp_Type === "TYPE1") pp_E = 6; // ปกติใช้ 6 (ข้ามเงื่อนไข Knock pin พิเศษ 7 ไปก่อน)
  else if (pp_Type === "TYPE2") pp_E = 9;
  else pp_E = pp_C;

  // F: B + 5 (ทศนิยม 1 ตำแหน่ง)
  const pp_F = parseFloat((pp_B + 5).toFixed(1));

  // G: 48 (W < 18) | 65 (18 <= W < 31)
  const pp_G = pp_W < 18 ? 48 : 65;

  // H, J, K, L
  const pp_H = pp_POD;
  const pp_J = pp_Type === "TYPE1" ? parseFloat((pp_SHOD + 0.1).toFixed(1)) : pp_SHOD;
  const pp_K = pp_J + 1;
  const pp_L = pp_Type === "TYPE1" ? "R1" : "R2";

  // อัปเดตส่วน Return ของฟังก์ชัน KS400B6 ให้ส่งค่า pilotPin กลับไปด้วย
  return {
    error: null,
    workDriver: { A: wd_A, B: wd_B, C: wd_C, D: wd_D, E: wd_E },
    loadingChute: { A: lc_A, B: lc_B, C: lc_C, D: lc_D, F: lc_F },
    plug: { A: plug_A, B: plug_B, C: plug_C, D: plug_D },
    workGuide: { A: wg_A, B: wg_B, C: wg_C, D: wg_D, E: wg_E },
    workPusher: { A: wp_A, B: wp_B, C: wp_C },
    stockerChute: stockerChuteObj,
    frontShoe: { A: fs_A, B: fs_B, C: fs_C, D: fs_D },
    rearShoe: { A: rs_A, B: rs_B, C: rs_C, D: rs_D },
    pilotPin: { 
      Type: pp_Type, A: pp_A, B: pp_B, C: pp_C, D: pp_D, E: pp_E, 
      F: pp_F, G: pp_G, H: pp_H, J: pp_J, K: pp_K, L: pp_L 
    }
  };

}

