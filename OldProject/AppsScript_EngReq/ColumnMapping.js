/**
 * ================================================================
 * COLUMN MAPPING UTILITY
 * ================================================================
 * This utility helps to avoid using hardcoded column indices by
 * creating a map of column names to their index numbers.
 * ================================================================
 */

/**
 * Creates a map of column names to their 0-based index.
 * @param {Sheet} sheet The Google Sheet to map.
 * @returns {Object} An object where keys are column names and values are their indices.
 */
function getColumnMap(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const columnMap = {};
  for (let i = 0; i < headers.length; i++) {
    columnMap[headers[i]] = i;
  }
  return columnMap;
}
