/**
 * File upload middleware — sanitizes filenames, no type/size restrictions
 */

const path = require('path');
const crypto = require('crypto');

/**
 * Validate file upload — accepts any file type and size
 */
const validateFileUpload = (options = {}) => {
  const { fieldName = 'attachment', multiple = false } = options;

  return (req, res, next) => {
    if (!req.files || !req.files[fieldName]) {
      if (options.required) {
        return res.status(400).json({
          error: 'File required',
          message: `File field '${fieldName}' is required`
        });
      }
      return next();
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
};
