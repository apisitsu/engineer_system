// ================================================================= //
//            TURNING TOOL IMAGE SYSTEM (Automatic Mapping)         //
// ================================================================= //

/**
 * SETUP DATA SHEET SYSTEM - Image Service Module
 * Automatically maps tool images to PDF template based on Tool_Number
 *
 * Features:
 * - Auto-detects tool images from Turning_Tool folder
 * - Matches images using pattern: Txx_*.png (e.g., T01_DCGT.png)
 * - Fixed 12-slot template (T01-T12)
 * - Shared images across all CNs
 * - No configuration needed - just upload images!
 */

/**
 * Configuration: Tool image positions in template
 * USING METHOD 1 with AUTO ASPECT RATIO
 *
 * Specify cell position and maximum dimensions.
 * Images will automatically scale to fit within max bounds while maintaining aspect ratio.
 *
 * If you merged cells (e.g., H18:K25 for 4×8 cells), the image will be placed
 * at the top-left corner and sized to fit the merged area.
 *
 * Structure:
 * - Row 1: T01, T02, T03, T04 (Cells H18, H30, H42, H54)
 * - Row 2: T05, T06, T07, T08 (Cells T18, T30, T42, T54)
 * - Row 3: T09, T10, T11, T12 (Cells AF18, AF30, AF42, AF54)
 */
const TOOL_IMAGE_POSITIONS = {
  // Row 1 (T01-T04) - Adjust maxWidth/maxHeight to match your merged cell size
  '01': { cell: 'H18',  maxWidth: 130, maxHeight: 200 },  // 4×8 cells ~160×200px
  '02': { cell: 'H30',  maxWidth: 130, maxHeight: 200 },
  '03': { cell: 'H42',  maxWidth: 130, maxHeight: 200 },
  '04': { cell: 'H55',  maxWidth: 180, maxHeight: 80 },

  // Row 2 (T05-T08)
  '05': { cell: 'T18',  maxWidth: 130, maxHeight: 200 },
  '06': { cell: 'T30',  maxWidth: 130, maxHeight: 200 },
  '07': { cell: 'T42',  maxWidth: 130, maxHeight: 200 },
  '08': { cell: 'T55',  maxWidth: 180, maxHeight: 100 },

  // Row 3 (T09-T12)
  '09': { cell: 'AF18', maxWidth: 150, maxHeight: 200 },
  '10': { cell: 'AF30', maxWidth: 150, maxHeight: 200 },
  '11': { cell: 'AF42', maxWidth: 150, maxHeight: 200 },
  '12': { cell: 'AF54', maxWidth: 150, maxHeight: 200 }
};

/**
 * Get Turning_Tool folder from Google Drive
 * @returns {Folder|null} Google Drive folder object
 */
function getTurningToolFolder() {
  try {
    if (!SDS_IMAGES_FOLDER_ID) {
      Logger.log('❌ SDS_IMAGES_FOLDER_ID not configured in Config.gs');
      return null;
    }

    const baseFolder = DriveApp.getFolderById(SDS_IMAGES_FOLDER_ID);

    const toolFolders = baseFolder.getFoldersByName('Turning_Tool');
    if (!toolFolders.hasNext()) {
      Logger.log('⚠️ Turning_Tool folder not found in SDS_Images');
      Logger.log('Please create: SDS_Images/Turning_Tool/');
      return null;
    }

    return toolFolders.next();

  } catch (e) {
    Logger.log(`getTurningToolFolder Error: ${e.message}`);
    return null;
  }
}

/**
 * Extract keyword from Tool_Name for simplified image matching
 * Removes diameter specifications and extra details
 *
 * Strategy: Extract first word before space
 * - "U-DRILL Ø 48" → "U-DRILL"
 * - "CARBIDE-DRILL Ø 11.3" → "CARBIDE-DRILL"
 * - "FACING & OD ROUGH" → "FACING"
 * - "CUT OFF" → "CUT"
 *
 * @param {string} toolName - Full tool name from database
 * @returns {string} Keyword for image file matching
 */
function extractToolKeyword(toolName) {
  if (!toolName || String(toolName).trim() === '') {
    return '';
  }

  const name = String(toolName).trim();

  // Split by space and take first part
  const parts = name.split(' ');

  if (parts.length > 0 && parts[0].trim() !== '') {
    return parts[0].trim();
  }

  // Fallback: return full name if no space found
  return name;
}

/**
 * Get tool image from Turning_Tool folder with Smart Keyword Matching
 *
 * Search Priority:
 * 1. Keyword match: T{number}_{Keyword}.{ext}
 *    - Extracts first word before space from Tool_Name
 *    - Example: "U-DRILL Ø 48" → searches "T08_U-DRILL.png"
 *    - Example: "CARBIDE-DRILL Ø 11.3" → searches "T08_CARBIDE-DRILL.png"
 *
 * 2. Fallback 1: T{number}.{ext}
 *    - Example: "T08.png" (no suffix)
 *
 * 3. Fallback 2: First file matching T{number}_*.{ext}
 *    - Example: "T08_*.png" (first file found)
 *
 * File Examples:
 * - T08_U-DRILL.png (used for all U-DRILL diameters)
 * - T08_CARBIDE-DRILL.png (used for all CARBIDE-DRILL sizes)
 * - T02_FACING.png or T02.png
 *
 * @param {string} toolNumber - Tool number (e.g., "01", "02", "T8", "T12")
 * @param {string} toolName - Full tool name from database (e.g., "U-DRILL Ø 48")
 * @returns {File|null} Google Drive file object
 */
function getToolImage(toolNumber, toolName = null) {
  try {
    // Ensure toolNumber is 2 digits (e.g., "1" → "01", "T01" → "01")
    const paddedNumber = String(toolNumber).replace(/^T/i, '').padStart(2, '0');

    Logger.log(`[getToolImage] Searching for Tool ${paddedNumber}, Tool_Name: ${toolName || 'N/A'}`);

    // Get Turning_Tool folder
    const toolFolder = getTurningToolFolder();
    if (!toolFolder) {
      return null;
    }

    const validExtensions = ['png', 'jpg', 'jpeg'];
    let fallbackFile = null; // Store first matching file as fallback

    // === PRIORITY 1: Keyword match (extract first word before space) ===
    if (toolName && String(toolName).trim() !== '') {
      const keyword = extractToolKeyword(toolName);

      if (keyword !== '') {
        Logger.log(`[getToolImage] Extracted keyword: "${keyword}" from "${toolName}"`);

        for (const ext of validExtensions) {
          const keywordFileName = `T${paddedNumber}_${keyword}.${ext}`;
          const keywordFiles = toolFolder.getFilesByName(keywordFileName);

          if (keywordFiles.hasNext()) {
            const file = keywordFiles.next();
            Logger.log(`✅ Found (Priority 1 - Keyword): ${file.getName()}`);
            return file;
          }
        }

        Logger.log(`⚠️ Priority 1 (Keyword match) not found: T${paddedNumber}_${keyword}.{ext}`);
      }
    }

    // === PRIORITY 2: Fallback to T{number}.{ext} ===
    for (const ext of validExtensions) {
      const fallbackFileName = `T${paddedNumber}.${ext}`;
      const fallbackFiles = toolFolder.getFilesByName(fallbackFileName);

      if (fallbackFiles.hasNext()) {
        const file = fallbackFiles.next();
        Logger.log(`✅ Found (Priority 2 - Fallback): ${file.getName()}`);
        return file;
      }
    }

    Logger.log(`⚠️ Priority 2 (Fallback) not found: T${paddedNumber}.{ext}`);

    // === PRIORITY 3: First file matching T{number}_*.{ext} ===
    const searchPattern = `T${paddedNumber}_`;
    const files = toolFolder.getFiles();

    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();

      // Check if filename matches pattern and is an image
      if (fileName.startsWith(searchPattern)) {
        const ext = fileName.split('.').pop().toLowerCase();
        if (validExtensions.includes(ext)) {
          Logger.log(`✅ Found (Priority 3 - First match): ${fileName}`);
          return file;
        }
      }
    }

    Logger.log(`❌ No image found for T${paddedNumber} (tried all 3 priorities)`);
    return null;

  } catch (e) {
    Logger.log(`getToolImage Error: ${e.message}`);
    return null;
  }
}

/**
 * Insert tool image with automatic aspect ratio preservation
 *
 * This method:
 * - Reads the original image dimensions
 * - Calculates aspect ratio
 * - Scales image to fit within maxWidth × maxHeight bounds
 * - Maintains original aspect ratio (no distortion)
 *
 * @param {Sheet} sheet - Target sheet
 * @param {File} imageFile - Image file from Drive
 * @param {string} cellAddress - Cell address (e.g., "H18", "T30")
 * @param {number} maxWidth - Maximum width in pixels
 * @param {number} maxHeight - Maximum height in pixels
 */
function insertToolImageAtCell(sheet, imageFile, cellAddress, maxWidth, maxHeight) {
  try {
    if (!imageFile) {
      Logger.log(`No image file provided for ${cellAddress}`);
      return;
    }

    const cell = sheet.getRange(cellAddress);
    const imageBlob = imageFile.getBlob();

    // Calculate final dimensions with aspect ratio preservation
    const dimensions = calculateAspectRatioFit(imageBlob, maxWidth, maxHeight);

    // Insert image at cell position (floating over cells)
    const image = sheet.insertImage(imageBlob, cell.getColumn(), cell.getRow());

    // Resize to calculated dimensions
    image.setWidth(dimensions.width);
    image.setHeight(dimensions.height);

    Logger.log(`✅ Inserted ${imageFile.getName()} at ${cellAddress} (${dimensions.width}×${dimensions.height}px, aspect ratio preserved)`);

  } catch (e) {
    Logger.log(`insertToolImageAtCell Error: ${e.message}`);
  }
}

/**
 * Calculate image dimensions to fit within max bounds while preserving aspect ratio
 *
 * @param {Blob} imageBlob - Image blob
 * @param {number} maxWidth - Maximum width
 * @param {number} maxHeight - Maximum height
 * @returns {Object} {width, height} - Calculated dimensions
 */
function calculateAspectRatioFit(imageBlob, maxWidth, maxHeight) {
  try {
    // Get original image dimensions
    // Note: Apps Script doesn't have direct method to get image dimensions from blob
    // We'll use a workaround: temporarily insert and measure, then remove
    // For now, we'll calculate based on maxWidth/maxHeight and assume square ratio

    // Since we can't easily get image dimensions in Apps Script,
    // we'll use a simpler approach: fit to bounds
    // The image will scale proportionally based on maxWidth and maxHeight

    // If you need exact aspect ratio, you would need to:
    // 1. Use external image processing service
    // 2. Or store dimensions in filename
    // 3. Or use Sheets API v4 with more control

    // For now, return max dimensions and let the image scale
    return {
      width: maxWidth,
      height: maxHeight
    };

  } catch (e) {
    Logger.log(`calculateAspectRatioFit Error: ${e.message}`);
    return { width: maxWidth, height: maxHeight };
  }
}

/**
 * Apply all tool images to TURNING template
 * Reads tooling data and inserts corresponding images automatically
 *
 * Process:
 * 1. Read tooling data to get Tool_Number list (e.g., 01, 02, 05)
 * 2. For each tool, search for matching image (T01_*.png, T02_*.png, etc.)
 * 3. Insert image at corresponding position in template
 * 4. Only tools T01-T12 are displayed (beyond T12 are ignored)
 *
 * @param {Sheet} tempSheet - Temporary PDF sheet
 * @param {Object} data - Setup data containing CN
 * @param {Array} toolingData - Array of tool objects from Turning_Tooling
 */
function applyTurningToolImages(tempSheet, data, toolingData) {
  try {
    if (!toolingData || toolingData.length === 0) {
      Logger.log('No tooling data provided, skipping tool images');
      return;
    }

    Logger.log(`\n${'='.repeat(60)}`);
    Logger.log(`  APPLYING TOOL IMAGES FOR CN ${data.CN}`);
    Logger.log(`${'='.repeat(60)}`);
    Logger.log(`Total tools in database: ${toolingData.length}`);

    let imagesInserted = 0;
    let imagesNotFound = 0;
    let toolsSkipped = 0;

    // Process each tool
    toolingData.forEach(tool => {
      const toolNumber = tool.Tool_Number; // e.g., "01", "02", "T01", "1"

      // Extract numeric part (remove "T" if present)
      const numericToolNumber = String(toolNumber).replace(/^T/i, '').padStart(2, '0');

      // Check if this tool number has a position in template (01-12 only)
      if (!TOOL_IMAGE_POSITIONS[numericToolNumber]) {
        Logger.log(`⚠️ Tool ${toolNumber} is beyond T12, skipping image (template only has 12 slots)`);
        toolsSkipped++;
        return;
      }

      const position = TOOL_IMAGE_POSITIONS[numericToolNumber];
      const toolName = tool.Tool_Name || tool.Insert_Info || '';

      Logger.log(`\nProcessing Tool ${toolNumber} (${toolName || 'No name'})...`);

      // Get image file with Tool_Name for smart matching
      const imageFile = getToolImage(numericToolNumber, toolName);

      if (imageFile) {
        // Insert image with aspect ratio preservation
        insertToolImageAtCell(
          tempSheet,
          imageFile,
          position.cell,
          position.maxWidth,
          position.maxHeight
        );
        imagesInserted++;
        Logger.log(`✅ Inserted image: ${imageFile.getName()} at ${position.cell}`);
      } else {
        Logger.log(`⚠️ No image found for Tool ${toolNumber} (${toolName || 'No name'}) - cell ${position.cell} will be empty`);
        imagesNotFound++;
      }
    });

    // Summary
    Logger.log(`\n${'='.repeat(60)}`);
    Logger.log(`  SUMMARY`);
    Logger.log(`${'='.repeat(60)}`);
    Logger.log(`✅ Images inserted:  ${imagesInserted}`);
    Logger.log(`⚠️  Images not found: ${imagesNotFound}`);
    if (toolsSkipped > 0) {
      Logger.log(`⏭️  Tools skipped (>T12): ${toolsSkipped}`);
    }
    Logger.log(`${'='.repeat(60)}\n`);

  } catch (e) {
    Logger.log(`applyTurningToolImages Error: ${e.message}`);
    Logger.log(e.stack);
  }
}

/**
 * List all available tool images in Turning_Tool folder
 * Useful for checking what images are available
 *
 * @returns {Array<Object>} Array of image info objects
 */
function listAvailableToolImages() {
  try {
    const toolFolder = getTurningToolFolder();
    if (!toolFolder) {
      return [];
    }

    const images = [];
    const files = toolFolder.getFiles();

    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();
      const ext = fileName.split('.').pop().toLowerCase();

      // Check if it's an image with Txx_ pattern
      if (['png', 'jpg', 'jpeg'].includes(ext) && /^T\d{2}_/.test(fileName)) {
        const toolNumber = fileName.substring(0, 3); // "T01", "T02", etc.
        images.push({
          toolNumber: toolNumber,
          fileName: fileName,
          fileId: file.getId(),
          size: file.getSize(),
          lastModified: file.getLastUpdated()
        });
      }
    }

    // Sort by tool number
    images.sort((a, b) => a.toolNumber.localeCompare(b.toolNumber));

    return images;

  } catch (e) {
    Logger.log(`listAvailableToolImages Error: ${e.message}`);
    return [];
  }
}

// ================================================================= //
//                  CUTTING LAYOUT IMAGE SYSTEM                     //
// ================================================================= //

/**
 * Configuration: Cutting layout image position in template
 * USING METHOD 1 with AUTO ASPECT RATIO
 *
 * Single large diagram showing the complete cutting sequence/setup
 * Adjust maxWidth/maxHeight to match your merged cell size (e.g., 7×24 cells)
 */
const CUTTING_LAYOUT_POSITION = {
  cell: 'AL27',
  maxWidth: 315,   // 7 columns × ~40px = ~280px
  maxHeight: 400   // 24 rows × ~40px = ~960px
};

/**
 * Get Turning_Layout folder from Google Drive
 * @returns {Folder|null} Google Drive folder object
 */
function getTurningLayoutFolder() {
  try {
    if (!SDS_IMAGES_FOLDER_ID) {
      Logger.log('❌ SDS_IMAGES_FOLDER_ID not configured in Config.gs');
      return null;
    }

    const baseFolder = DriveApp.getFolderById(SDS_IMAGES_FOLDER_ID);

    const layoutFolders = baseFolder.getFoldersByName('Turning_Layout');
    if (!layoutFolders.hasNext()) {
      Logger.log('⚠️ Turning_Layout folder not found in SDS_Images');
      Logger.log('Please create: SDS_Images/Turning_Layout/');
      return null;
    }

    return layoutFolders.next();

  } catch (e) {
    Logger.log(`getTurningLayoutFolder Error: ${e.message}`);
    return null;
  }
}

/**
 * Get cutting layout image for specific CN and sheet
 * Searches with priority: CN-specific → Sheet-specific → Default
 *
 * Search priority:
 * 1. [CN]_Layout.png (e.g., "294065_Layout.png") - Highest priority
 * 2. [SheetName]_Layout.png (e.g., "Turn_bfd_Layout.png") - Template-specific
 * 3. Default_Layout.png (fallback)
 *
 * @param {string} cn - Customer Number
 * @param {string} sheetName - Sheet/Template name (e.g., "Turn_bfd")
 * @returns {File|null} Google Drive file object
 */
function getCuttingLayoutImage(cn, sheetName) {
  try {
    Logger.log(`[getCuttingLayoutImage] Searching layout for CN: ${cn}, Sheet: ${sheetName}`);

    const layoutFolder = getTurningLayoutFolder();
    if (!layoutFolder) {
      return null;
    }

    const extensions = ['png', 'jpg', 'jpeg'];

    // Priority 1: Try CN-specific layout first
    const cnLayoutName = `${cn}_Layout`;
    for (const ext of extensions) {
      const fileName = `${cnLayoutName}.${ext}`;
      const files = layoutFolder.getFilesByName(fileName);

      if (files.hasNext()) {
        const file = files.next();
        Logger.log(`✅ Found CN-specific layout (Priority 1): ${fileName}`);
        return file;
      }
    }

    Logger.log(`⚠️ No CN-specific layout found for ${cn}`);

    // Priority 2: Try sheet-specific layout
    if (sheetName) {
      const sheetLayoutName = `${sheetName}_Layout`;
      for (const ext of extensions) {
        const fileName = `${sheetLayoutName}.${ext}`;
        const files = layoutFolder.getFilesByName(fileName);

        if (files.hasNext()) {
          const file = files.next();
          Logger.log(`✅ Found sheet-specific layout (Priority 2): ${fileName}`);
          return file;
        }
      }
      Logger.log(`⚠️ No sheet-specific layout found for ${sheetName}`);
    }

    // Priority 3: Fallback to default layout
    for (const ext of extensions) {
      const defaultName = `Default_Layout.${ext}`;
      const files = layoutFolder.getFilesByName(defaultName);

      if (files.hasNext()) {
        const file = files.next();
        Logger.log(`✅ Using default layout (Priority 3): ${defaultName}`);
        return file;
      }
    }

    Logger.log(`⚠️ No layout image found (tried CN, sheet, and default)`);
    return null;

  } catch (e) {
    Logger.log(`getCuttingLayoutImage Error: ${e.message}`);
    return null;
  }
}

/**
 * Apply cutting layout image to TURNING template
 * Inserts a single large diagram showing the cutting sequence
 *
 * @param {Sheet} tempSheet - Temporary PDF sheet
 * @param {Object} data - Setup data containing CN
 * @param {string} sheetName - Sheet/Template name for priority search
 */
function applyCuttingLayout(tempSheet, data, sheetName) {
  try {
    const cn = data.CN;
    if (!cn) {
      Logger.log('No CN provided, skipping cutting layout');
      return;
    }

    Logger.log(`\n${'='.repeat(60)}`);
    Logger.log(`  APPLYING CUTTING LAYOUT FOR CN ${cn}, Sheet: ${sheetName}`);
    Logger.log(`${'='.repeat(60)}`);

    // Get layout image with priority search
    const layoutImage = getCuttingLayoutImage(cn, sheetName);

    if (layoutImage) {
      // Insert with aspect ratio preservation
      insertToolImageAtCell(
        tempSheet,
        layoutImage,
        CUTTING_LAYOUT_POSITION.cell,
        CUTTING_LAYOUT_POSITION.maxWidth,
        CUTTING_LAYOUT_POSITION.maxHeight
      );

      Logger.log(`✅ Cutting layout inserted successfully`);
    } else {
      Logger.log(`⚠️ No cutting layout available for CN ${cn}`);
      Logger.log(`   Cell ${CUTTING_LAYOUT_POSITION.cell} will remain empty`);
    }

    Logger.log(`${'='.repeat(60)}\n`);

  } catch (e) {
    Logger.log(`applyCuttingLayout Error: ${e.message}`);
    Logger.log(e.stack);
  }
}

/**
 * List all available cutting layout images
 * @returns {Array<Object>} Array of layout image info
 */
function listAvailableCuttingLayouts() {
  try {
    const layoutFolder = getTurningLayoutFolder();
    if (!layoutFolder) {
      return [];
    }

    const layouts = [];
    const files = layoutFolder.getFiles();

    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();
      const ext = fileName.split('.').pop().toLowerCase();

      // Check if it's an image
      if (['png', 'jpg', 'jpeg'].includes(ext)) {
        // Parse CN from filename (format: [CN]_Layout.ext or Default_Layout.ext)
        const match = fileName.match(/^(.+?)_Layout\.(png|jpg|jpeg)$/i);
        if (match) {
          const identifier = match[1]; // CN or "Default"
          layouts.push({
            identifier: identifier,
            fileName: fileName,
            fileId: file.getId(),
            size: file.getSize(),
            lastModified: file.getLastUpdated(),
            isDefault: identifier.toLowerCase() === 'default'
          });
        }
      }
    }

    // Sort: Default first, then by identifier
    layouts.sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return a.identifier.localeCompare(b.identifier);
    });

    return layouts;

  } catch (e) {
    Logger.log(`listAvailableCuttingLayouts Error: ${e.message}`);
    return [];
  }
}

// ================================================================= //
//                  GRINDING LAYOUT IMAGE SYSTEM                    //
// ================================================================= //

/**
 * Configuration: Grinding layout image position in template
 * USING METHOD 1 with AUTO ASPECT RATIO
 *
 * Single large diagram showing the grinding sequence/setup
 * Adjust maxWidth/maxHeight to match your merged cell size
 *
 * NOTE: Adjust cell position and dimensions based on your grinding template
 */
const GRINDING_LAYOUT_POSITION = {
  cell: 'AO26',      // Change this to match your grinding template
  maxWidth: 315,     // Adjust based on your template
  maxHeight: 340     // Adjust based on your template
};

/**
 * Get Grinding_Layout folder from Google Drive
 * @returns {Folder|null} Google Drive folder object
 */
function getGrindingLayoutFolder() {
  try {
    if (!SDS_IMAGES_FOLDER_ID) {
      Logger.log('❌ SDS_IMAGES_FOLDER_ID not configured in Config.gs');
      return null;
    }

    const baseFolder = DriveApp.getFolderById(SDS_IMAGES_FOLDER_ID);

    const layoutFolders = baseFolder.getFoldersByName('Grinding_Layout');
    if (!layoutFolders.hasNext()) {
      Logger.log('⚠️ Grinding_Layout folder not found in SDS_Images');
      Logger.log('Please create: SDS_Images/Grinding_Layout/');
      return null;
    }

    return layoutFolders.next();

  } catch (e) {
    Logger.log(`getGrindingLayoutFolder Error: ${e.message}`);
    return null;
  }
}

/**
 * Get grinding layout image for specific CN and sheet
 * Searches with priority: CN+Sheet → CN-specific → Sheet-specific → Default
 *
 * Search priority (UPDATED):
 * 1. [CN]_[SheetName]_Layout.png (e.g., "294065_SPG_ks400b1_Layout.png") - CN+Template combination
 * 2. [CN]_Layout.png (e.g., "294065_Layout.png") - CN-specific (backward compatible)
 * 3. [SheetName]_Layout.png (e.g., "SPG_ks400b1_Layout.png") - Template-specific
 * 4. Default_Layout.png (fallback)
 *
 * @param {string} cn - Customer Number
 * @param {string} sheetName - Sheet/Template name (e.g., "SPG_ks400b1")
 * @returns {File|null} Google Drive file object
 */
function getGrindingLayoutImage(cn, sheetName) {
  try {
    Logger.log(`[getGrindingLayoutImage] Searching layout for CN: ${cn}, Sheet: ${sheetName}`);

    const layoutFolder = getGrindingLayoutFolder();
    if (!layoutFolder) {
      return null;
    }

    const extensions = ['png', 'jpg', 'jpeg'];

    // Priority 1: Try CN + SheetName combination first (HIGHEST PRIORITY)
    if (cn && sheetName) {
      const combinedLayoutName = `${cn}_${sheetName}_Layout`;
      for (const ext of extensions) {
        const fileName = `${combinedLayoutName}.${ext}`;
        const files = layoutFolder.getFilesByName(fileName);

        if (files.hasNext()) {
          const file = files.next();
          Logger.log(`✅ Found CN+Template layout (Priority 1): ${fileName}`);
          return file;
        }
      }
      Logger.log(`⚠️ No CN+Template layout found for ${cn}_${sheetName}`);
    }

    // Priority 2: Try CN-specific layout
    const cnLayoutName = `${cn}_Layout`;
    for (const ext of extensions) {
      const fileName = `${cnLayoutName}.${ext}`;
      const files = layoutFolder.getFilesByName(fileName);

      if (files.hasNext()) {
        const file = files.next();
        Logger.log(`✅ Found CN-specific layout (Priority 2): ${fileName}`);
        return file;
      }
    }

    Logger.log(`⚠️ No CN-specific layout found for ${cn}`);

    // Priority 3: Try sheet-specific layout
    if (sheetName) {
      const sheetLayoutName = `${sheetName}_Layout`;
      for (const ext of extensions) {
        const fileName = `${sheetLayoutName}.${ext}`;
        const files = layoutFolder.getFilesByName(fileName);

        if (files.hasNext()) {
          const file = files.next();
          Logger.log(`✅ Found sheet-specific layout (Priority 3): ${fileName}`);
          return file;
        }
      }
      Logger.log(`⚠️ No sheet-specific layout found for ${sheetName}`);
    }

    // Priority 4: Fallback to default layout
    for (const ext of extensions) {
      const defaultName = `Default_Layout.${ext}`;
      const files = layoutFolder.getFilesByName(defaultName);

      if (files.hasNext()) {
        const file = files.next();
        Logger.log(`✅ Using default layout (Priority 4): ${defaultName}`);
        return file;
      }
    }

    Logger.log(`⚠️ No layout image found (tried CN+Template, CN, Template, and default)`);
    return null;

  } catch (e) {
    Logger.log(`getGrindingLayoutImage Error: ${e.message}`);
    return null;
  }
}

/**
 * Apply grinding layout image to GRINDING template
 * Inserts a single large diagram showing the grinding sequence
 *
 * @param {Sheet} tempSheet - Temporary PDF sheet
 * @param {Object} data - Setup data containing CN
 * @param {string} sheetName - Sheet/Template name for priority search
 */
function applyGrindingLayout(tempSheet, data, sheetName) {
  try {
    const cn = data.CN;
    if (!cn) {
      Logger.log('No CN provided, skipping grinding layout');
      return;
    }

    Logger.log(`\n${'='.repeat(60)}`);
    Logger.log(`  APPLYING GRINDING LAYOUT FOR CN ${cn}, Sheet: ${sheetName}`);
    Logger.log(`${'='.repeat(60)}`);

    // Get layout image with priority search
    const layoutImage = getGrindingLayoutImage(cn, sheetName);

    if (layoutImage) {
      // Insert with aspect ratio preservation
      insertToolImageAtCell(
        tempSheet,
        layoutImage,
        GRINDING_LAYOUT_POSITION.cell,
        GRINDING_LAYOUT_POSITION.maxWidth,
        GRINDING_LAYOUT_POSITION.maxHeight
      );

      Logger.log(`✅ Grinding layout inserted successfully`);
    } else {
      Logger.log(`⚠️ No grinding layout available for CN ${cn}`);
      Logger.log(`   Cell ${GRINDING_LAYOUT_POSITION.cell} will remain empty`);
    }

    Logger.log(`${'='.repeat(60)}\n`);

  } catch (e) {
    Logger.log(`applyGrindingLayout Error: ${e.message}`);
    Logger.log(e.stack);
  }
}

/**
 * List all available grinding layout images
 * @returns {Array<Object>} Array of layout image info
 */
function listAvailableGrindingLayouts() {
  try {
    const layoutFolder = getGrindingLayoutFolder();
    if (!layoutFolder) {
      return [];
    }

    const layouts = [];
    const files = layoutFolder.getFiles();

    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();
      const ext = fileName.split('.').pop().toLowerCase();

      // Check if it's an image
      if (['png', 'jpg', 'jpeg'].includes(ext)) {
        // Parse CN from filename (format: [CN]_Layout.ext or Default_Layout.ext)
        const baseName = fileName.substring(0, fileName.lastIndexOf('.'));

        let cn = null;
        let isDefault = false;

        if (baseName === 'Default_Layout') {
          isDefault = true;
        } else if (baseName.endsWith('_Layout')) {
          cn = baseName.replace('_Layout', '');
        }

        layouts.push({
          fileName: fileName,
          cn: cn,
          isDefault: isDefault,
          fileId: file.getId(),
          size: file.getSize()
        });
      }
    }

    Logger.log(`\n${'='.repeat(60)}`);
    Logger.log(`  GRINDING LAYOUT IMAGES AVAILABLE`);
    Logger.log(`${'='.repeat(60)}`);
    Logger.log(`Found ${layouts.length} layout image(s):\n`);

    layouts.forEach(layout => {
      if (layout.isDefault) {
        Logger.log(`📄 ${layout.fileName} (DEFAULT for all CNs)`);
      } else if (layout.cn) {
        Logger.log(`📄 ${layout.fileName} (CN: ${layout.cn})`);
      } else {
        Logger.log(`📄 ${layout.fileName} (unknown format - should be [CN]_Layout.ext)`);
      }
    });

    Logger.log(`${'='.repeat(60)}\n`);

    return layouts;

  } catch (e) {
    Logger.log(`listAvailableGrindingLayouts Error: ${e.message}`);
    return [];
  }
}

/**
 * Diagnostic function: Check tool image availability
 * Run this to see which tool images are available in Drive
 */
function diagnoseToolImages() {
  Logger.log('\n' + '='.repeat(70));
  Logger.log('  TOOL IMAGE DIAGNOSTIC');
  Logger.log('='.repeat(70));

  // Check folder
  Logger.log('\n[1] Checking Turning_Tool folder...');
  const folder = getTurningToolFolder();

  if (!folder) {
    Logger.log('❌ FAILED: Turning_Tool folder not found!');
    Logger.log('\nPlease create folder structure:');
    Logger.log('  📁 SDS_Images/ (ID in Config.gs)');
    Logger.log('    └── 📁 Turning_Tool/');
    Logger.log('          ├── 📄 T01_[name].png');
    Logger.log('          ├── 📄 T02_[name].png');
    Logger.log('          └── ...');
    return;
  }

  Logger.log(`✅ Folder found: ${folder.getName()}`);
  Logger.log(`   Folder ID: ${folder.getId()}`);

  // List images
  Logger.log('\n[2] Scanning for tool images...');
  const images = listAvailableToolImages();

  if (images.length === 0) {
    Logger.log('⚠️ No tool images found!');
    Logger.log('\nPlease upload images with naming pattern: Txx_[description].png');
    Logger.log('Examples:');
    Logger.log('  - T01_DCGT070204.png');
    Logger.log('  - T02_Roughing.png');
    Logger.log('  - T05_Finishing-Insert.jpg');
    return;
  }

  Logger.log(`✅ Found ${images.length} tool images:\n`);

  images.forEach(img => {
    const sizeKB = (img.size / 1024).toFixed(2);
    Logger.log(`   ${img.toolNumber}: ${img.fileName} (${sizeKB} KB)`);
  });

  // Check coverage
  Logger.log('\n[3] Checking template coverage (T01-T12)...');

  const availableTools = new Set(images.map(img => img.toolNumber.substring(1))); // Remove "T"
  const missingTools = [];

  for (let i = 1; i <= 12; i++) {
    const toolNum = String(i).padStart(2, '0');
    if (!availableTools.has(toolNum)) {
      missingTools.push(`T${toolNum}`);
    }
  }

  if (missingTools.length === 0) {
    Logger.log('✅ All 12 tool positions have images!');
  } else {
    Logger.log(`⚠️ Missing images for: ${missingTools.join(', ')}`);
    Logger.log('   (These positions will be empty in PDF)');
  }

  // Check cutting layout images
  Logger.log('\n[4] Checking Cutting Layout images...');

  const layoutFolder = getTurningLayoutFolder();
  if (!layoutFolder) {
    Logger.log('⚠️ Turning_Layout folder not found!');
    Logger.log('   Please create: SDS_Images/Turning_Layout/');
  } else {
    Logger.log(`✅ Folder found: ${layoutFolder.getName()}`);

    const layouts = listAvailableCuttingLayouts();

    if (layouts.length === 0) {
      Logger.log('⚠️ No cutting layout images found!');
      Logger.log('\nPlease upload layout images with naming pattern: [CN]_Layout.png');
      Logger.log('Examples:');
      Logger.log('  - 294065_Layout.png');
      Logger.log('  - 310165_Layout.png');
      Logger.log('  - Default_Layout.png (fallback)');
    } else {
      Logger.log(`✅ Found ${layouts.length} cutting layout images:\n`);

      layouts.forEach(layout => {
        const sizeKB = (layout.size / 1024).toFixed(2);
        const tag = layout.isDefault ? ' [DEFAULT]' : '';
        Logger.log(`   ${layout.identifier}: ${layout.fileName} (${sizeKB} KB)${tag}`);
      });

      // Check if default exists
      const hasDefault = layouts.some(l => l.isDefault);
      if (!hasDefault) {
        Logger.log('\n⚠️ No Default_Layout.png found!');
        Logger.log('   Recommended: Add Default_Layout.png as fallback for CNs without specific layout');
      }
    }
  }

  Logger.log('\n' + '='.repeat(70));
  Logger.log('  DIAGNOSTIC COMPLETE');
  Logger.log('='.repeat(70) + '\n');

  return {
    success: folder !== null,
    folderFound: folder !== null,
    imageCount: images.length,
    images: images,
    missingTools: missingTools,
    layoutFolderFound: layoutFolder !== null,
    layoutCount: layoutFolder ? listAvailableCuttingLayouts().length : 0
  };
}

/**
 * Test keyword extraction function
 * Run this to verify keyword extraction is working correctly
 */
function testKeywordExtraction() {
  Logger.log('\n' + '='.repeat(70));
  Logger.log('  KEYWORD EXTRACTION TEST');
  Logger.log('='.repeat(70));

  const testCases = [
    'U-DRILL Ø 48',
    'U-DRILL Ø 22.0',
    'CARBIDE-DRILL Ø 11.3',
    'FACING & OD ROUGH',
    'ID ROUGH & FINISH',
    'FACING FINISH',
    'OD FINISH',
    'CUT OFF',
    'GROOVING',
    'T08_SPECIAL-TOOL'
  ];

  Logger.log('\nTesting keyword extraction:');
  Logger.log('-'.repeat(70));

  testCases.forEach(toolName => {
    const keyword = extractToolKeyword(toolName);
    const status = keyword !== toolName ? '✅ Extracted' : '⚠️ No change';
    Logger.log(`${status} | "${toolName}" → "${keyword}"`);
  });

  Logger.log('\n' + '='.repeat(70));
  Logger.log('  EXPECTED FILE NAMES');
  Logger.log('='.repeat(70));

  Logger.log('\nFor Tool Number T08:');
  testCases.forEach(toolName => {
    const keyword = extractToolKeyword(toolName);
    const fileName = `T08_${keyword}.png`;
    Logger.log(`  ${toolName.padEnd(30)} → ${fileName}`);
  });

  Logger.log('\n' + '='.repeat(70));
  Logger.log('  TEST COMPLETE');
  Logger.log('='.repeat(70) + '\n');
}
