// ================================================================= //
//                    TOOLING DATA MIGRATION                        //
// ================================================================= //

/**
 * SETUP DATA SHEET SYSTEM - Migration Module
 * Migrate tooling data from main sheets to unified Grinding_Tooling sheet
 *
 * USAGE:
 * 1. Create 'Grinding_Tooling' sheet manually first with required headers
 * 2. Run migrateToolingData('IDG_ks03a') for specific sheet
 * 3. Or run migrateAllTooling() to migrate all sheets at once
 */

/**
 * Migrate tooling data from a main sheet to Grinding_Tooling sheet
 * @param {string} mainSheetName - Name of main sheet (e.g., 'IDG_ks03a')
 * @returns {Object} Success status and summary
 */
function migrateToolingData(mainSheetName) {
  try {
    Logger.log(`\n=== Starting migration for ${mainSheetName} ===`);

    // 1. Check if sheet has tooling
    if (!SHEETS_WITH_TOOLING.includes(mainSheetName)) {
      return {
        success: false,
        message: `Sheet '${mainSheetName}' is not configured to have tooling data`
      };
    }

    // 2. Get main sheet
    const mainSheet = dataSs.getSheetByName(mainSheetName);
    if (!mainSheet) {
      throw new Error(`Main sheet '${mainSheetName}' not found`);
    }

    // 3. Determine which tooling sheet to use based on machine type
    const machineType = MACHINE_TYPE_MAP[mainSheetName] || 'grinding';
    const toolingSheetName = TOOLING_SHEETS[machineType];

    if (!toolingSheetName) {
      throw new Error(`No tooling sheet configured for machine type '${machineType}'`);
    }

    Logger.log(`Using tooling sheet: ${toolingSheetName} for ${mainSheetName}`);

    // 4. Get tooling sheet
    const toolingSheet = dataSs.getSheetByName(toolingSheetName);
    if (!toolingSheet) {
      throw new Error(`Tooling sheet '${toolingSheetName}' not found. Please create it first.`);
    }

    // 4. Read main sheet data
    const mainData = mainSheet.getDataRange().getValues();
    const mainHeaders = mainData.shift().map(h => String(h).trim());

    // 5. Get tooling sheet headers
    const toolingHeaders = toolingSheet.getRange(1, 1, 1, toolingSheet.getLastColumn())
      .getValues()[0].map(h => String(h).trim());

    // 6. Find tooling columns in main sheet
    const toolingColumns = findToolingColumns(mainHeaders);

    if (Object.keys(toolingColumns).length === 0) {
      return {
        success: false,
        message: `No tooling columns found in sheet '${mainSheetName}'. Expected columns like: tooling_no_01, no_01_maker, etc.`
      };
    }

    Logger.log(`Found ${Object.keys(toolingColumns).length} tools in sheet columns`);

    // 7. Get key column indices from main sheet
    const cnIndex = mainHeaders.indexOf('CN');
    const processCodeIndex = mainHeaders.indexOf('Process_Code');
    const machineIndex = mainHeaders.indexOf('Machine');
    const revIndex = mainHeaders.indexOf('Setup_Data_Sheet_REV');

    if (cnIndex === -1) {
      throw new Error('CN column not found in main sheet');
    }

    // 8. Get tooling sheet column indices
    const tSheetNameIndex = toolingHeaders.indexOf('Sheet_Name');
    const tCnIndex = toolingHeaders.indexOf('CN');
    const tProcessCodeIndex = toolingHeaders.indexOf('Process_Code');
    const tMachineIndex = toolingHeaders.indexOf('Machine');
    const tRevIndex = toolingHeaders.indexOf('Setup_Data_Sheet_REV');
    const tToolNumberIndex = toolingHeaders.indexOf('Tool_Number');
    const tToolingNoIndex = toolingHeaders.indexOf('Tooling_No');
    const tMakerIndex = toolingHeaders.indexOf('Maker');

    // 9. Migrate each row
    let totalToolsMigrated = 0;
    let rowsProcessed = 0;

    mainData.forEach((row, rowIndex) => {
      const cn = row[cnIndex];

      if (!cn || String(cn).trim() === '') {
        return; // Skip empty rows
      }

      rowsProcessed++;
      const processCode = processCodeIndex > -1 ? row[processCodeIndex] : '';
      const machine = machineIndex > -1 ? row[machineIndex] : '';
      const rev = revIndex > -1 ? (row[revIndex] || 'NC') : 'NC';

      // Extract tools from this row
      Object.keys(toolingColumns).forEach(toolNum => {
        const toolIndexes = toolingColumns[toolNum];

        // Get tooling_no value
        const toolingNoValue = toolIndexes.tooling_no !== undefined ?
          row[toolIndexes.tooling_no] : '';

        // Only migrate if tool has data
        if (toolingNoValue && String(toolingNoValue).trim() !== '') {
          const maker = toolIndexes.maker !== undefined ?
            row[toolIndexes.maker] : '';

          // Create tool row for Grinding_Tooling sheet
          const toolRow = new Array(toolingHeaders.length).fill('');

          // Populate known columns
          if (tSheetNameIndex > -1) toolRow[tSheetNameIndex] = mainSheetName;
          if (tCnIndex > -1) toolRow[tCnIndex] = cn;
          if (tProcessCodeIndex > -1) toolRow[tProcessCodeIndex] = processCode;
          if (tMachineIndex > -1) toolRow[tMachineIndex] = machine;
          if (tRevIndex > -1) toolRow[tRevIndex] = rev;
          if (tToolNumberIndex > -1) toolRow[tToolNumberIndex] = `T${toolNum}`;
          if (tToolingNoIndex > -1) toolRow[tToolingNoIndex] = toolingNoValue;
          if (tMakerIndex > -1) toolRow[tMakerIndex] = maker;

          // Append to tooling sheet
          toolingSheet.appendRow(toolRow);
          totalToolsMigrated++;

          if (totalToolsMigrated % 10 === 0) {
            Logger.log(`Migrated ${totalToolsMigrated} tools...`);
          }
        }
      });
    });

    Logger.log(`Migration completed!`);
    Logger.log(`- Rows processed: ${rowsProcessed}`);
    Logger.log(`- Tools migrated: ${totalToolsMigrated}`);

    return {
      success: true,
      message: `Successfully migrated ${totalToolsMigrated} tools from ${mainSheetName}`,
      rowsProcessed: rowsProcessed,
      toolsMigrated: totalToolsMigrated
    };

  } catch (e) {
    Logger.log(`Migration Error: ${e.message}`);
    Logger.log(e.stack);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * Find tooling columns in main sheet headers
 * Handles multiple naming conventions:
 * - GRINDING: tooling_no_01, no_01_maker (horizontal format)
 * - GRINDING: Tooling_No_1, No_1_maker (SPG sheets, horizontal format)
 * - TURNING: Tool_Name, Insert_Info, etc. (vertical format - different migration approach)
 *
 * @param {Array} headers - Array of column headers
 * @returns {Object} Map of tool numbers to column indices
 */
function findToolingColumns(headers) {
  const toolingColumns = {};

  headers.forEach((header, index) => {
    const h = String(header).trim();

    // === GRINDING PATTERNS (Horizontal format with numbered columns) ===

    // Pattern 1: tooling_no_XX or Tooling_No_X
    let match = h.match(/^tooling_no_(\d+)$/i);
    if (match) {
      const toolNum = String(parseInt(match[1])).padStart(2, '0'); // Normalize: 1 → 01
      if (!toolingColumns[toolNum]) toolingColumns[toolNum] = {};
      toolingColumns[toolNum].tooling_no = index;
      return;
    }

    // Pattern 2: no_XX_maker or No_X_maker
    match = h.match(/^no_(\d+)_maker$/i);
    if (match) {
      const toolNum = String(parseInt(match[1])).padStart(2, '0'); // Normalize: 1 → 01
      if (!toolingColumns[toolNum]) toolingColumns[toolNum] = {};
      toolingColumns[toolNum].maker = index;
      return;
    }

    // Pattern 3: tool_type_XX or Tool_Type_X
    match = h.match(/^tool_type_(\d+)$/i);
    if (match) {
      const toolNum = String(parseInt(match[1])).padStart(2, '0'); // Normalize: 1 → 01
      if (!toolingColumns[toolNum]) toolingColumns[toolNum] = {};
      toolingColumns[toolNum].tool_type = index;
      return;
    }

    // Pattern 4: grinding_wheel_spec_XX or Grinding_Wheel_Spec_X
    match = h.match(/^grinding_wheel_spec_(\d+)$/i);
    if (match) {
      const toolNum = String(parseInt(match[1])).padStart(2, '0'); // Normalize: 1 → 01
      if (!toolingColumns[toolNum]) toolingColumns[toolNum] = {};
      toolingColumns[toolNum].grinding_wheel_spec = index;
      return;
    }

    // === NOTE: TURNING PATTERNS ===
    // Turning sheets (Turn_bfd) typically store data in VERTICAL format
    // (one row per tool) rather than horizontal (numbered columns).
    // So they don't need column pattern detection.
    // Migration for turning sheets should use migrateTurningTooling() instead.
  });

  return toolingColumns;
}

/**
 * Migrate tooling data for all configured sheets
 * @returns {Object} Summary of all migrations
 */
function migrateAllTooling() {
  Logger.log('=== Starting migration for all sheets ===\n');

  const results = [];
  let totalSuccess = 0;
  let totalFailed = 0;
  let totalToolsMigrated = 0;

  SHEETS_WITH_TOOLING.forEach(sheetName => {
    Logger.log(`\n--- Processing ${sheetName} ---`);
    const result = migrateToolingData(sheetName);

    results.push({
      sheet: sheetName,
      result: result
    });

    if (result.success) {
      totalSuccess++;
      totalToolsMigrated += result.toolsMigrated || 0;
    } else {
      totalFailed++;
    }
  });

  Logger.log('\n\n=== MIGRATION SUMMARY ===');
  Logger.log(`Total sheets processed: ${SHEETS_WITH_TOOLING.length}`);
  Logger.log(`Successful: ${totalSuccess}`);
  Logger.log(`Failed: ${totalFailed}`);
  Logger.log(`Total tools migrated: ${totalToolsMigrated}`);
  Logger.log('\nDetailed Results:');

  results.forEach(r => {
    const status = r.result.success ? '✓ SUCCESS' : '✗ FAILED';
    const message = r.result.message || r.result.error || '';
    Logger.log(`  ${status}: ${r.sheet} - ${message}`);
  });

  return {
    success: totalFailed === 0,
    summary: {
      total: SHEETS_WITH_TOOLING.length,
      successful: totalSuccess,
      failed: totalFailed,
      totalToolsMigrated: totalToolsMigrated
    },
    results: results
  };
}

/**
 * Verify migration results
 * Compare tooling counts between main sheets and Grinding_Tooling
 * @param {string} mainSheetName - Main sheet name
 */
function verifyMigration(mainSheetName) {
  try {
    Logger.log(`\n=== Verifying migration for ${mainSheetName} ===`);

    const mainSheet = dataSs.getSheetByName(mainSheetName);
    const toolingSheet = dataSs.getSheetByName(TOOLING_SHEET_NAME);

    if (!mainSheet || !toolingSheet) {
      throw new Error('Required sheets not found');
    }

    // Count tools in Grinding_Tooling for this sheet
    const toolingData = toolingSheet.getDataRange().getValues();
    const toolingHeaders = toolingData.shift();
    const sheetNameIndex = toolingHeaders.indexOf('Sheet_Name');

    const migratedCount = toolingData.filter(row =>
      String(row[sheetNameIndex]) === mainSheetName
    ).length;

    Logger.log(`Tools found in ${TOOLING_SHEET_NAME}: ${migratedCount}`);
    Logger.log('Verification complete!');

    return {
      success: true,
      sheetName: mainSheetName,
      toolsInGrindingTooling: migratedCount
    };

  } catch (e) {
    Logger.log(`Verification Error: ${e.message}`);
    return { success: false, error: e.message };
  }
}

/**
 * Migrate turning tooling data (vertical format)
 * Turning sheets store tooling data in vertical format (one row per tool)
 * This function simply copies tooling rows to Turning_Tooling sheet
 *
 * @param {string} mainSheetName - Main sheet name (e.g., 'Turn_bfd')
 * @returns {Object} Success status and summary
 */
function migrateTurningTooling(mainSheetName) {
  try {
    Logger.log(`\n=== Starting TURNING migration for ${mainSheetName} ===`);

    // 1. Check if sheet is configured
    if (!SHEETS_WITH_TOOLING.includes(mainSheetName)) {
      return {
        success: false,
        message: `Sheet '${mainSheetName}' is not configured to have tooling data`
      };
    }

    // 2. Verify it's a turning sheet
    const machineType = MACHINE_TYPE_MAP[mainSheetName];
    if (machineType !== 'turning') {
      return {
        success: false,
        message: `Sheet '${mainSheetName}' is not a turning sheet (type: ${machineType})`
      };
    }

    // 3. Get main sheet
    const mainSheet = dataSs.getSheetByName(mainSheetName);
    if (!mainSheet) {
      throw new Error(`Main sheet '${mainSheetName}' not found`);
    }

    // 4. Get Turning_Tooling sheet
    const toolingSheet = dataSs.getSheetByName(TOOLING_SHEETS.turning);
    if (!toolingSheet) {
      throw new Error(`Turning_Tooling sheet not found. Please create it first with proper headers.`);
    }

    // 5. Read data from main sheet
    const mainData = mainSheet.getDataRange().getValues();
    const mainHeaders = mainData.shift().map(h => String(h).trim());

    // 6. Get tooling sheet headers
    const toolingHeaders = toolingSheet.getRange(1, 1, 1, toolingSheet.getLastColumn())
      .getValues()[0].map(h => String(h).trim());

    // 7. Define tooling columns (columns that should be copied to Turning_Tooling)
    const toolingColumnNames = [
      'Sheet_Name', 'CN', 'Process_Code', 'Machine', 'Setup_Data_Sheet_REV',
      'Tool_Number', 'Tool_Name', 'Insert_Info', 'Insert_I', 'Insert_E', 'Insert_Maker',
      'Holder_Info', 'Holder_Maker', 'Overhang', 'H_Width', 'Rotation',
      'F', 'AP', 'Nose_R', 'Unaged'
    ];

    // 8. Map column indices from main sheet
    const columnMap = {};
    toolingColumnNames.forEach(colName => {
      const mainIndex = mainHeaders.indexOf(colName);
      const toolingIndex = toolingHeaders.indexOf(colName);

      if (mainIndex > -1 && toolingIndex > -1) {
        columnMap[colName] = { mainIndex, toolingIndex };
      }
    });

    Logger.log(`Mapped ${Object.keys(columnMap).length} columns for migration`);

    // 9. Copy each row to Turning_Tooling
    let rowsCopied = 0;

    mainData.forEach((row, rowIndex) => {
      const cn = row[mainHeaders.indexOf('CN')];
      const toolNumber = row[mainHeaders.indexOf('Tool_Number')];

      // Skip rows without CN or Tool_Number
      if (!cn || String(cn).trim() === '' || !toolNumber || String(toolNumber).trim() === '') {
        return;
      }

      // Create new row for Turning_Tooling
      const newRow = new Array(toolingHeaders.length).fill('');

      // Copy data from main sheet to tooling sheet
      Object.keys(columnMap).forEach(colName => {
        const { mainIndex, toolingIndex } = columnMap[colName];
        newRow[toolingIndex] = row[mainIndex];
      });

      // Set Sheet_Name explicitly
      const sheetNameIndex = toolingHeaders.indexOf('Sheet_Name');
      if (sheetNameIndex > -1) {
        newRow[sheetNameIndex] = mainSheetName;
      }

      // Append to tooling sheet
      toolingSheet.appendRow(newRow);
      rowsCopied++;

      if (rowsCopied % 10 === 0) {
        Logger.log(`Copied ${rowsCopied} rows...`);
      }
    });

    Logger.log(`Migration completed!`);
    Logger.log(`- Rows copied: ${rowsCopied}`);

    return {
      success: true,
      message: `Successfully migrated ${rowsCopied} tooling rows from ${mainSheetName}`,
      rowsCopied: rowsCopied
    };

  } catch (e) {
    Logger.log(`Turning Migration Error: ${e.message}`);
    Logger.log(e.stack);
    return {
      success: false,
      error: e.message
    };
  }
}
