/**
 * File upload validation middleware
 * Validates file type, size, and sanitizes filenames
 */

const path = require('path');
const crypto = require('crypto');

// Configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
  'application/acad', // DWG
  'application/autocad_dwg',
  'image/vnd.dwg',
  'application/dxf', // DXF
  'image/vnd.dxf'
];
const ALLOWED_EXTENSIONS = ['.pdf', '.dwg', '.dxf', '.png', '.jpg', '.jpeg'];

/**
 * Validate file upload
 */
const validateFileUpload = (options = {}) => {
  const { 
    fieldName = 'attachment', 
    maxSize = MAX_FILE_SIZE,
    allowedTypes = ALLOWED_MIME_TYPES,
    multiple = false 
  } = options;

  return (req, res, next) => {
    // Skip validation if no files
    if (!req.files || !req.files[fieldName]) {
      // If file is required but not provided
      if (options.required) {
        return res.status(400).json({
          error: 'File required',
          message: `File field '${fieldName}' is required`
        });
      }
      return next();
    }

    const files = multiple 
      ? (Array.isArray(req.files[fieldName]) ? req.files[fieldName] : [req.files[fieldName]])
      : [req.files[fieldName]];

    // Validate each file
    for (const file of files) {
      // Check file size
      if (file.size > maxSize) {
        return res.status(400).json({
          error: 'File too large',
          message: `File '${file.name}' exceeds maximum size of ${maxSize / 1024 / 1024}MB`
        });
      }

      // Check file extension
      const ext = path.extname(file.name).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return res.status(400).json({
          error: 'Invalid file type',
          message: `File extension '${ext}' is not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
        });
      }

      // Check MIME type (if available)
      if (file.mimetype && !allowedTypes.includes(file.mimetype)) {
        // Warning only - MIME type detection may not be reliable for all files
        console.warn(`⚠️ File ${file.name} has unusual MIME type: ${file.mimetype}`);
      }
    }

    next();
  };
};

/**
 * Sanitize filename - remove special characters and add timestamp
 */
const sanitizeFilename = (filename, prefix = '') => {
  const ext = path.extname(filename).toLowerCase();
  const baseName = path.basename(filename, ext)
    .replace(/[^a-zA-Z0-9-_]/g, '_') // Replace special chars with underscore
    .substring(0, 50); // Limit length
  
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  
  return `${prefix}${prefix ? '_' : ''}${timestamp}_${random}_${baseName}${ext}`;
};

/**
 * Get file URL from path
 */
const getFileUrl = (filePath, baseUrl = null) => {
  const serverUrl = baseUrl || process.env.SERVER_URL || 'http://localhost:2005';
  return `${serverUrl}${filePath.startsWith('/') ? '' : '/'}${filePath}`;
};

module.exports = {
  validateFileUpload,
  sanitizeFilename,
  getFileUrl,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS
};
