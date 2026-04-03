/**
 * Core logic to find matching Jaws, Back Plates, Chutes, and Carriers.
 */
function findFixtures(cnNumber) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const specSheet = ss.getSheetByName("SpecProcess");
    // เพิ่ม KS400B6 เข้าไปในรายชื่อ Sheet
    const fixtureSheetNames = ["KS-B22G", "KS-B80", "TSG-300", "KS400B", "KS-03A", "KS500RD", "KS400B5", "KS400B6"];
    
    if (!specSheet) throw new Error("SpecProcess sheet not found.");

    // ==========================================
    // GET PART DATA ---
    // ==========================================
    const specData = specSheet.getDataRange().getValues();
    const specHeaders = specData[0];
    const partRow = specData.slice(1).find(row => String(row[0]).trim() === String(cnNumber).trim());
    if (!partRow) throw new Error("C/N not found in Specification.");

    const getVal = (colName) => {
      const index = specHeaders.indexOf(colName);
      return index === -1 ? null : partRow[index];
    };

    // Parameters from Specification
    const partData = {
      odBf: parseFloat(getVal('OD_bf') || 0),
      odBfTolPlus: parseFloat(getVal('OD_bf_max') || 0),
      odBfTolMinus: parseFloat(getVal('OD_bf_min') || 0),
      idBf: parseFloat(getVal('ID_bf') || 0),
      idBfTolPlus: parseFloat(getVal('ID_bf_max') || 0),
      idBfTolMinus: parseFloat(getVal('ID_bf_min') || 0),
      wBf: parseFloat(getVal('W_bf') || 0),
      wBfTolPlus: parseFloat(getVal('W_bf_max') || 0),
      wBfTolMinus: parseFloat(getVal('W_bf_min') || 0),
      odAft: parseFloat(getVal('OD_aft') || 0),
      odAftTolPlus: parseFloat(getVal('OD_aft_max') || 0),
      odAftTolMinus: parseFloat(getVal('OD_aft_min') || 0),
      idAft: parseFloat(getVal('ID_aft') || 0),
      idTolPlus: parseFloat(getVal('ID_aft_max') || 0),
      idTolMinus: parseFloat(getVal('ID_aft_min') || 0),
      wAft: parseFloat(getVal('W_aft') || 0),
      wAftTolPlus: parseFloat(getVal('W_aft_max') || 0),
      wAftTolMinus: parseFloat(getVal('W_aft_min') || 0),
      type: String(getVal('Type') || "").toUpperCase(),
      yBall: getVal('Yball') ? String(getVal('Yball')).toUpperCase() : "N",
      process: String(getVal('Process') || ""),
      sd: parseFloat(getVal('SD') || 0),
      sdAft: parseFloat(getVal('SD_aft') || 0)
    };

    // ==========================================
    // CALCULATIONS
    // ==========================================
    const calc = calculateToolingParams(partData);
    const ks400b_calc = calculateKS400B_Params(partData);

    // ==========================================
    // SEARCH LOGIC
    // ==========================================
    let allJawMatches = [], allBpMatches = [], allChuteMatches = [];
    let allCarrierZncMatches = [];
    let allCarrierWMatches = [];
    
    // KS400B results
    let ks400b_workDrivers = [];
    let ks400b_supportBlocks = [];
    let ks400b_loadingChutes = [];
    let ks400b_plugsA = [];
    let ks400b_plugsB = [];

    // KS-03A results
    let ks03a_rollerShoes = [];
    let ks03a_cpxShoes = [];
    let ks03a_chuteCovers = [];
    let ks03a_frontPlates = [];
    let ks03a_settingGauges = [];
    let ks03a_masterRings = [];
    let ks03a_plugGauges = [];
    let ks03a_loader = [];
    let ks03a_pressureRotors = [];

    // KS500RD results
    let ks500rd_loadingPintles = [];
    let ks500rd_workDrivers = [];

    // KS400B5 results
    let ks400b5_workClamps = [], ks400b5_shafts = [], ks400b5_workChutes = [];
    let ks400b5_workLoaders = [], ks400b5_workChucks = [], ks400b5_workHolders = [];
    let ks400b5_chuckJaws = [], ks400b5_workChuteGuides = [], ks400b5_stoppers = [];
    let ks400b5_masterRings = [];

    // KS400B6 results
    let ks400b6_workDrivers = [], ks400b6_loadingChutes = [], ks400b6_plugs = [];
    let ks400b6_workGuides = [], ks400b6_workPushers = [], ks400b6_stockerChutes = [];
    let ks400b6_frontShoes = [], ks400b6_rearShoes = [], ks400b6_pilotPins = [];

    fixtureSheetNames.forEach(sheetName => {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return;

      const fixData = sheet.getDataRange().getValues();
      const fixHeaders = fixData.shift(); 
      const h = (name) => fixHeaders.indexOf(name);

      // KS-B22G: Machine Limit OD ≤ 38, 4.8 ≤ ID < 16, W ≥ 14
      if (sheetName === "KS-B22G") {
        const ksb22gOK = calc.jawA <= 38 && partData.idAft >= 4.8 && partData.idAft < 16 && partData.wAft >= 14;
        if (ksb22gOK) {
          allJawMatches.push(...searchKSB22G_Jaws(fixData, h, sheetName, calc, MAX_JAW_DEPTH));
          allBpMatches.push(...searchKSB22G_BackPlates(fixData, h, sheetName, calc));
        }
      }
      // KS-B80: Machine Limit 15 < OD ≤ 70, ID ≥ 7.9, W ≥ 14
      else if (sheetName === "KS-B80") {
        const ksb80OK = calc.jawA > 15 && calc.jawA <= 70 && partData.idAft >= 7.9 && partData.wAft >= 14;
        if (ksb80OK) {
          allJawMatches.push(...searchKSB80_Jaws(fixData, h, sheetName, calc, MAX_JAW_DEPTH));
          allBpMatches.push(...searchKSB80_BackPlates(fixData, h, sheetName, calc));
        }
      }
      // KS-03A: Machine Limit OD_MAX ≤ 33
      else if (sheetName === "KS-03A") {
        const ks03aOK = partData.odAft <= 33;
        if (ks03aOK) {
          const targetMachine = partData.idAft >= 12.0 ? "KS-B22RD" : "KS-03A";
          const ks03a_calc = calculateKS03A_Params(partData);
          if (!ks03a_calc.error) {
            ks03a_rollerShoes.push(...searchKS03A_RollerShoe(fixData, h, targetMachine, ks03a_calc));
            ks03a_cpxShoes.push(...searchKS03A_CPXShoe(fixData, h, targetMachine, ks03a_calc));
            ks03a_chuteCovers.push(...searchKS03A_ChuteCover(fixData, h, targetMachine, ks03a_calc));
            ks03a_frontPlates.push(...searchKS03A_FrontPlate(fixData, h, targetMachine, ks03a_calc));
            ks03a_settingGauges.push(...searchKS03A_SettingGauge(fixData, h, targetMachine, ks03a_calc));
            ks03a_masterRings.push(...searchKS03A_MasterRing(fixData, h, targetMachine, ks03a_calc));
            ks03a_plugGauges.push(...searchKS03A_PlugGauge(fixData, h, targetMachine, ks03a_calc));
            ks03a_loader.push(...searchKS03A_Loader(fixData, h, targetMachine, ks03a_calc));
            ks03a_pressureRotors.push(...searchKS03A_PressureRotor(fixData, h, targetMachine, ks03a_calc));
          }
        }
      }
      // TSG-300 and TSG-300W
      else if (sheetName === "TSG-300") {
        // Chute
        allChuteMatches.push(...searchTSG_Chutes(fixData, h, sheetName, calc));
        // Carrier
        allCarrierZncMatches.push(...searchTSG300_Carriers(fixData, h, sheetName, calc));
        allCarrierWMatches.push(...searchTSG300W_Carriers(fixData, h, sheetName, calc));
      }
      // KS400B
      else if (sheetName === "KS400B") {
        // Only search if calculation was successful (SD calculated)
        if (!ks400b_calc.error) {
          ks400b_workDrivers.push(...searchKS400B_WorkDriver(fixData, h, sheetName, ks400b_calc));
          ks400b_supportBlocks.push(...searchKS400B_SupportBlock(fixData, h, sheetName, ks400b_calc));
          ks400b_loadingChutes.push(...searchKS400B_LoadingChute(fixData, h, sheetName, ks400b_calc));
          ks400b_plugsA.push(...searchKS400B_PlugA(fixData, h, sheetName, ks400b_calc));
          ks400b_plugsB.push(...searchKS400B_PlugB(fixData, h, sheetName, ks400b_calc));
        }
      }
      // KS500RD
      else if (sheetName === "KS500RD") {
        const ks500rdOK = partData.idAft >= 14 && partData.idAft <= 38.125 &&
                          partData.odAft >= 26 && partData.odAft <= 59.531 &&
                          partData.wAft >= 23.5 && partData.wAft <= 51.15;
                          
        if (ks500rdOK) {
          const ks500rd_calc = calculateKS500RD_Params(partData);
          if (!ks500rd_calc.error) {
            ks500rd_loadingPintles.push(...searchKS500RD_LoadingPintle(fixData, h, sheetName, ks500rd_calc));
            ks500rd_workDrivers.push(...searchKS500RD_WorkDriver(fixData, h, sheetName, ks500rd_calc));
          }
        }
      }
      // KS400B5
      else if (sheetName === "KS400B5") {
        const ks400b5_calc = calculateKS400B5_Params(partData);
        if (!ks400b5_calc.error) {
          ks400b5_workClamps.push(...searchKS400B5_Tool(fixData, h, sheetName, "WORK CLAMP", ks400b5_calc.workClamp));
          ks400b5_shafts.push(...searchKS400B5_Tool(fixData, h, sheetName, "SHAFT", ks400b5_calc.shaft));
          ks400b5_workChutes.push(...searchKS400B5_Tool(fixData, h, sheetName, "WORK CHUTE", ks400b5_calc.workChute));
          ks400b5_workLoaders.push(...searchKS400B5_Tool(fixData, h, sheetName, "WORK LOADER", ks400b5_calc.workLoader));
          ks400b5_workChucks.push(...searchKS400B5_Tool(fixData, h, sheetName, "WORK CHUCK", ks400b5_calc.workChuck));
          ks400b5_workHolders.push(...searchKS400B5_Tool(fixData, h, sheetName, "WORK HOLDER", ks400b5_calc.workHolder));
          ks400b5_chuckJaws.push(...searchKS400B5_Tool(fixData, h, sheetName, "CHUCK JAW", ks400b5_calc.chuckJaw));
          ks400b5_workChuteGuides.push(...searchKS400B5_Tool(fixData, h, sheetName, "CHUTE GUIDE", ks400b5_calc.workChuteGuide));
          ks400b5_stoppers.push(...searchKS400B5_Tool(fixData, h, sheetName, "STOPPER", ks400b5_calc.stopper));
          ks400b5_masterRings.push(...searchKS400B5_Tool(fixData, h, sheetName, "MASTER RING", ks400b5_calc.masterRingForJaw));
        }
      }
      // KS400B6
      else if (sheetName === "KS400B6") {
        const ks400b6_calc = calculateKS400B6_Params(partData);
        if (!ks400b6_calc.error) {
          ks400b6_workDrivers.push(...searchKS400B6_WorkDriver(fixData, h, sheetName, ks400b6_calc));
          ks400b6_loadingChutes.push(...searchKS400B6_LoadingChute(fixData, h, sheetName, ks400b6_calc));
          ks400b6_plugs.push(...searchKS400B6_Plug(fixData, h, sheetName, ks400b6_calc));
          ks400b6_workGuides.push(...searchKS400B6_WorkGuide(fixData, h, sheetName, ks400b6_calc));
          ks400b6_workPushers.push(...searchKS400B6_WorkPusher(fixData, h, sheetName, ks400b6_calc));
          ks400b6_stockerChutes.push(...searchKS400B6_StockerChute(fixData, h, sheetName, ks400b6_calc));
          ks400b6_frontShoes.push(...searchKS400B6_FrontShoe(fixData, h, sheetName, ks400b6_calc));
          ks400b6_rearShoes.push(...searchKS400B6_RearShoe(fixData, h, sheetName, ks400b6_calc));
          ks400b6_pilotPins.push(...searchKS400B6_PilotPin(fixData, h, sheetName, ks400b6_calc));
        }
      }
    });

    // ==========================================
    // --- 4. RETURN RESULT ---
    // ==========================================
    return {
      success: true,
      part: partData,
      calc: {
        A: calc.jawA.toFixed(3), 
        B: calc.jawB.toFixed(3), 
        C: calc.baseC.toFixed(2),
        D_Limit: MAX_JAW_DEPTH.toFixed(2),
        AA: calc.bpAA.toFixed(2), 
        BB: calc.bpBB.toFixed(2),
        chuteA: calc.chuteCalcA.toFixed(2),
        chuteB: calc.chuteCalcB.toFixed(2),
        chuteC: calc.chuteCalcC.toFixed(2),
        chuteD: calc.chuteCalcD.toFixed(2),
        carrierA: calc.carrierCalcA.toFixed(2),
        carrierB: calc.carrierCalcB.toFixed(2),
        carrierC: calc.carrierCalcC.toFixed(2)
      },
      jaws: topNPerMachine(allJawMatches, TOP_N_PER_MACHINE),
      bps: topNPerMachine(allBpMatches, TOP_N_PER_MACHINE),
      chutes: topNPerMachine(allChuteMatches, TOP_N_PER_MACHINE),
      carriersZNC: topNPerMachine(allCarrierZncMatches, TOP_N_PER_MACHINE),
      carriersW: topNPerMachine(allCarrierWMatches, TOP_N_PER_MACHINE),
      
      // KS400B Results
      ks400b: {
        calc: ks400b_calc,
        workDrivers: topNPerMachine(ks400b_workDrivers, TOP_N_PER_MACHINE),
        supportBlocks: topNPerMachine(ks400b_supportBlocks, TOP_N_PER_MACHINE),
        loadingChutes: topNPerMachine(ks400b_loadingChutes, TOP_N_PER_MACHINE),
        plugsA: topNPerMachine(ks400b_plugsA, TOP_N_PER_MACHINE),
        plugsB: topNPerMachine(ks400b_plugsB, TOP_N_PER_MACHINE)
      },

      // KS-03A Results
      ks03a: {
        calc: calculateKS03A_Params(partData), // แนบผลคำนวณกลับไปโชว์หน้าเว็บ
        rollerShoes: topNPerMachine(ks03a_rollerShoes, TOP_N_PER_MACHINE),
        cpxShoes: topNPerMachine(ks03a_cpxShoes, TOP_N_PER_MACHINE),
        chuteCovers: topNPerMachine(ks03a_chuteCovers, TOP_N_PER_MACHINE),
        frontPlates: topNPerMachine(ks03a_frontPlates, TOP_N_PER_MACHINE),
        settingGauges: topNPerMachine(ks03a_settingGauges, TOP_N_PER_MACHINE),
        masterRings: topNPerMachine(ks03a_masterRings, TOP_N_PER_MACHINE),
        plugGauges: topNPerMachine(ks03a_plugGauges, TOP_N_PER_MACHINE),
        loader: topNPerMachine(ks03a_loader, TOP_N_PER_MACHINE),
        pressureRotors: topNPerMachine(ks03a_pressureRotors, TOP_N_PER_MACHINE)
      },

      // KS500RD Results
      ks500rd: {
        calc: calculateKS500RD_Params(partData),
        loadingPintles: topNPerMachine(ks500rd_loadingPintles, TOP_N_PER_MACHINE),
        workDrivers: topNPerMachine(ks500rd_workDrivers, TOP_N_PER_MACHINE),
        // เพิ่ม frontShoe โดยจำลอง array 1 ตัวเพื่อใช้ร่วมกับฟังก์ชันแสดงผลหน้าเว็บ
        frontShoes: !calculateKS500RD_Params(partData).error ?
        [{ 
          no: calculateKS500RD_Params(partData).fs.No, 
          machine: "KS500RD",
          val1: '-', val2: '-', val3: '-', val4: '-', val5: '-'
        }] : []
      },

      // KS400B5 Results
      ks400b5: {
        calc: calculateKS400B5_Params(partData),
        workClamps: topNPerMachine(ks400b5_workClamps, TOP_N_PER_MACHINE),
        shafts: topNPerMachine(ks400b5_shafts, TOP_N_PER_MACHINE),
        workChutes: topNPerMachine(ks400b5_workChutes, TOP_N_PER_MACHINE),
        workLoaders: topNPerMachine(ks400b5_workLoaders, TOP_N_PER_MACHINE),
        workChucks: topNPerMachine(ks400b5_workChucks, TOP_N_PER_MACHINE),
        workHolders: topNPerMachine(ks400b5_workHolders, TOP_N_PER_MACHINE),
        chuckJaws: topNPerMachine(ks400b5_chuckJaws, TOP_N_PER_MACHINE),
        workChuteGuides: topNPerMachine(ks400b5_workChuteGuides, TOP_N_PER_MACHINE),
        stoppers: topNPerMachine(ks400b5_stoppers, TOP_N_PER_MACHINE),
        masterRings: topNPerMachine(ks400b5_masterRings, TOP_N_PER_MACHINE)
      },

      // KS400B6 Results
      ks400b6: {
        calc: calculateKS400B6_Params(partData),
        workDrivers: topNPerMachine(ks400b6_workDrivers, TOP_N_PER_MACHINE),
        loadingChutes: topNPerMachine(ks400b6_loadingChutes, TOP_N_PER_MACHINE),
        plugs: topNPerMachine(ks400b6_plugs, TOP_N_PER_MACHINE),
        workGuides: topNPerMachine(ks400b6_workGuides, TOP_N_PER_MACHINE),
        workPushers: topNPerMachine(ks400b6_workPushers, TOP_N_PER_MACHINE),
        stockerChutes: topNPerMachine(ks400b6_stockerChutes, TOP_N_PER_MACHINE),
        frontShoes: topNPerMachine(ks400b6_frontShoes, TOP_N_PER_MACHINE),
        rearShoes: topNPerMachine(ks400b6_rearShoes, TOP_N_PER_MACHINE),
        pilotPins: topNPerMachine(ks400b6_pilotPins, TOP_N_PER_MACHINE)
      }
    };

  } catch (e) {
    return { success: false, error: e.message };
  }
}