/**
 * pdfWorkerConfig.js — Single source of truth for PDF.js worker configuration.
 *
 * Centralizes the worker setup to avoid duplicate declarations across
 * usePdfDocument.js and useSignStamp.js (#23).
 */
import * as pdfjsLib from 'pdfjs-dist';

// Load worker locally instead of from CDN (#7)
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

export { pdfjsLib };
