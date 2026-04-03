// ================================================================= //
//                     CACHE MANAGEMENT HELPER                      //
// ================================================================= //

/**
 * SETUP DATA SHEET SYSTEM - Cache Helper Module
 * Smart caching with automatic invalidation
 *
 * Features:
 * - Cache search results for 5 minutes
 * - Auto-invalidate when data changes
 * - Track relationships (CN ↔ searches)
 * - Zero stale data issues
 */

const CACHE_DURATION = 5 * 60; // 5 minutes in seconds
const CACHE_KEY_PREFIX = 'sds_'; // Prefix for all cache keys

/**
 * Get cache instance
 */
function getCache() {
  return CacheService.getScriptCache();
}

/**
 * Generate cache key for search
 * @param {string} searchTerm - Search term
 * @returns {string} Cache key
 */
function getSearchCacheKey(searchTerm) {
  const normalized = String(searchTerm).toLowerCase().trim();
  return `${CACHE_KEY_PREFIX}search_${normalized}`;
}

/**
 * Generate cache key for CN
 * Used for invalidation tracking
 * @param {string} cn - Customer Number
 * @returns {string} Cache key
 */
function getCnCacheKey(cn) {
  return `${CACHE_KEY_PREFIX}cn_${cn}`;
}

/**
 * Store search results in cache with CN tracking
 * @param {string} searchTerm - Search term
 * @param {Object} results - Search results
 */
function cacheSearchResults(searchTerm, results) {
  try {
    const cache = getCache();
    const cacheKey = getSearchCacheKey(searchTerm);

    // Store results
    cache.put(cacheKey, JSON.stringify(results), CACHE_DURATION);

    // Track CNs in this search (for invalidation)
    if (results.data && Array.isArray(results.data)) {
      const cns = results.data.map(item => item.CN).filter(Boolean);
      const uniqueCNs = [...new Set(cns)];

      // Store relationship: search → CNs
      const searchToCNsKey = `${cacheKey}_cns`;
      cache.put(searchToCNsKey, JSON.stringify(uniqueCNs), CACHE_DURATION);

      // Store relationship: CN → searches (for reverse lookup)
      uniqueCNs.forEach(cn => {
        const cnKey = getCnCacheKey(cn);
        let searches = [];

        const existing = cache.get(cnKey);
        if (existing) {
          try {
            searches = JSON.parse(existing);
          } catch (e) {
            searches = [];
          }
        }

        if (!searches.includes(cacheKey)) {
          searches.push(cacheKey);
        }

        cache.put(cnKey, JSON.stringify(searches), CACHE_DURATION);
      });

      Logger.log(`[Cache] Stored search results for: "${searchTerm}"`);
      Logger.log(`[Cache] Tracked ${uniqueCNs.length} CNs: ${uniqueCNs.slice(0, 3).join(', ')}${uniqueCNs.length > 3 ? '...' : ''}`);
    }

  } catch (e) {
    Logger.log(`[Cache] Error storing results: ${e.message}`);
    // Don't throw - cache failures shouldn't break the app
  }
}

/**
 * Get search results from cache
 * @param {string} searchTerm - Search term
 * @returns {Object|null} Cached results or null if not found
 */
function getCachedSearchResults(searchTerm) {
  try {
    const cache = getCache();
    const cacheKey = getSearchCacheKey(searchTerm);

    const cached = cache.get(cacheKey);
    if (cached) {
      Logger.log(`[Cache] HIT for: "${searchTerm}"`);
      return JSON.parse(cached);
    }

    Logger.log(`[Cache] MISS for: "${searchTerm}"`);
    return null;

  } catch (e) {
    Logger.log(`[Cache] Error getting results: ${e.message}`);
    return null; // Return null on error, will trigger fresh query
  }
}

/**
 * Invalidate cache for specific CN
 * Called automatically when CN data is modified
 * @param {string} cn - Customer Number
 */
function invalidateCacheForCN(cn) {
  if (!cn || String(cn).trim() === '') {
    Logger.log('[Cache] Invalid CN for invalidation, skipping');
    return;
  }

  try {
    const cache = getCache();
    const cnKey = getCnCacheKey(cn);

    // Get all search keys that contain this CN
    const cached = cache.get(cnKey);
    if (!cached) {
      Logger.log(`[Cache] No cache to invalidate for CN: ${cn}`);
      return;
    }

    let searchKeys = [];
    try {
      searchKeys = JSON.parse(cached);
    } catch (e) {
      Logger.log(`[Cache] Error parsing CN cache: ${e.message}`);
      return;
    }

    // Remove all related search results
    let invalidatedCount = 0;
    searchKeys.forEach(searchKey => {
      cache.remove(searchKey);
      cache.remove(`${searchKey}_cns`); // Remove CN tracking
      invalidatedCount++;
    });

    // Remove CN key itself
    cache.remove(cnKey);

    Logger.log(`[Cache] Invalidated ${invalidatedCount} search cache(s) for CN: ${cn}`);

  } catch (e) {
    Logger.log(`[Cache] Error invalidating CN: ${e.message}`);
    // Don't throw - cache failures shouldn't break the app
  }
}

/**
 * Invalidate cache for multiple CNs
 * @param {Array<string>} cns - Array of Customer Numbers
 */
function invalidateCacheForCNs(cns) {
  if (!cns || !Array.isArray(cns) || cns.length === 0) {
    return;
  }

  Logger.log(`[Cache] Invalidating cache for ${cns.length} CN(s)`);

  cns.forEach(cn => {
    if (cn && String(cn).trim() !== '') {
      invalidateCacheForCN(cn);
    }
  });
}

/**
 * Clear all cache (for maintenance/debugging)
 * Use with caution!
 */
function clearAllCache() {
  try {
    const cache = getCache();
    const keys = cache.getKeys();

    // Only remove SDS-related keys (with prefix)
    const sdsKeys = keys.filter(key => key.startsWith(CACHE_KEY_PREFIX));

    sdsKeys.forEach(key => cache.remove(key));

    Logger.log(`[Cache] Cleared ${sdsKeys.length} cache entries`);

    return { success: true, cleared: sdsKeys.length };

  } catch (e) {
    Logger.log(`[Cache] Error clearing cache: ${e.message}`);
    return { success: false, error: e.message };
  }
}

// ================================================================= //
//                    PDF CACHE (DRIVE-BASED)                        //
// ================================================================= //

/**
 * Get or create the SDS_PDF_Cache Drive folder
 * @returns {Folder} Google Drive folder object
 */
function getPdfCacheFolder() {
  const folders = DriveApp.getFoldersByName(PDF_CACHE_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return DriveApp.createFolder(PDF_CACHE_FOLDER_NAME);
  }
}

/**
 * Build standardized PDF cache filename
 * Pattern: {CN}_{ProcessCode}_{REV}_{Machine}_{SheetName}.pdf
 * @returns {string} Standardized filename
 */
function buildPdfCacheFileName(cn, processCode, rev, machine, sheetName) {
  const parts = [
    String(cn || '').trim(),
    String(processCode || '').trim(),
    String(rev || 'NC').trim(),
    String(machine || '').trim(),
    String(sheetName || '').trim()
  ];
  return parts.join('_') + '.pdf';
}

/**
 * Search cache folder for matching PDF file
 * @param {string} cn - Control Number
 * @param {string} processCode - Process Code
 * @param {string} rev - Revision
 * @param {string} machine - Machine name
 * @param {string} sheetName - Sheet name
 * @returns {Object|null} {success, pdfData (base64), fileName} or null if not found
 */
function getCachedPdf(cn, processCode, rev, machine, sheetName) {
  try {
    const folder = getPdfCacheFolder();
    const fileName = buildPdfCacheFileName(cn, processCode, rev, machine, sheetName);
    const files = folder.getFilesByName(fileName);

    if (files.hasNext()) {
      const file = files.next();
      const blob = file.getBlob();
      const pdfData = Utilities.base64Encode(blob.getBytes());
      Logger.log(`[PDF Cache] HIT: ${fileName}`);
      return {
        success: true,
        pdfData: pdfData,
        fileName: fileName
      };
    }

    Logger.log(`[PDF Cache] MISS: ${fileName}`);
    return null;

  } catch (e) {
    Logger.log(`[PDF Cache] Error reading cache: ${e.message}`);
    return null;
  }
}

/**
 * Save PDF blob to cache folder with standardized name
 * @param {string} cn - Control Number
 * @param {string} processCode - Process Code
 * @param {string} rev - Revision
 * @param {string} machine - Machine name
 * @param {string} sheetName - Sheet name
 * @param {Blob} pdfBlob - PDF blob to save
 */
function savePdfToCache(cn, processCode, rev, machine, sheetName, pdfBlob) {
  try {
    const folder = getPdfCacheFolder();
    const fileName = buildPdfCacheFileName(cn, processCode, rev, machine, sheetName);

    // Delete existing file if any (overwrite)
    const existingFiles = folder.getFilesByName(fileName);
    while (existingFiles.hasNext()) {
      existingFiles.next().setTrashed(true);
    }

    // Save new file
    folder.createFile(pdfBlob.setName(fileName));
    Logger.log(`[PDF Cache] SAVED: ${fileName}`);

  } catch (e) {
    Logger.log(`[PDF Cache] Error saving to cache: ${e.message}`);
  }
}

/**
 * Delete specific cached PDF
 * @param {string} cn - Control Number
 * @param {string} processCode - Process Code
 * @param {string} rev - Revision
 * @param {string} machine - Machine name
 * @param {string} sheetName - Sheet name
 */
function invalidatePdfCache(cn, processCode, rev, machine, sheetName) {
  try {
    const folder = getPdfCacheFolder();
    const fileName = buildPdfCacheFileName(cn, processCode, rev, machine, sheetName);
    const files = folder.getFilesByName(fileName);

    let deleted = 0;
    while (files.hasNext()) {
      files.next().setTrashed(true);
      deleted++;
    }

    if (deleted > 0) {
      Logger.log(`[PDF Cache] INVALIDATED: ${fileName} (${deleted} file(s))`);
    }

  } catch (e) {
    Logger.log(`[PDF Cache] Error invalidating cache: ${e.message}`);
  }
}

/**
 * Delete ALL cached PDFs for a CN (used on data change)
 * Uses Drive search query (indexed) instead of iterating all files — fast even with 1000+ files
 * @param {string} cn - Control Number
 */
function invalidatePdfCacheForCN(cn) {
  if (!cn || String(cn).trim() === '') {
    return;
  }

  try {
    const folder = getPdfCacheFolder();
    const folderId = folder.getId();
    const prefix = String(cn).trim() + '_';

    // Use Drive search query — much faster than folder.getFiles() loop
    const files = DriveApp.searchFiles(
      `title contains '${prefix}' and '${folderId}' in parents and trashed = false`
    );

    let deleted = 0;
    while (files.hasNext()) {
      const file = files.next();
      if (file.getName().startsWith(prefix)) {
        file.setTrashed(true);
        deleted++;
      }
    }

    if (deleted > 0) {
      Logger.log(`[PDF Cache] Invalidated ${deleted} cached PDF(s) for CN: ${cn}`);
    }

  } catch (e) {
    Logger.log(`[PDF Cache] Error invalidating cache for CN ${cn}: ${e.message}`);
  }
}

/**
 * Get cache statistics (for monitoring)
 * @returns {Object} Cache stats
 */
function getCacheStats() {
  try {
    const cache = getCache();
    const keys = cache.getKeys();

    const sdsKeys = keys.filter(key => key.startsWith(CACHE_KEY_PREFIX));

    const searchKeys = sdsKeys.filter(key => key.includes('_search_') && !key.endsWith('_cns'));
    const cnKeys = sdsKeys.filter(key => key.includes('_cn_'));
    const trackingKeys = sdsKeys.filter(key => key.endsWith('_cns'));

    return {
      success: true,
      totalKeys: sdsKeys.length,
      searchCaches: searchKeys.length,
      cnTracking: cnKeys.length,
      relationshipTracking: trackingKeys.length,
      duration: `${CACHE_DURATION / 60} minutes`
    };

  } catch (e) {
    Logger.log(`[Cache] Error getting stats: ${e.message}`);
    return { success: false, error: e.message };
  }
}
