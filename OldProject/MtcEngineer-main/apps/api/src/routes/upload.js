const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create subfolder by year-month
    const date = new Date();
    const subDir = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const fullPath = path.join(uploadDir, subDir);

    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }

    cb(null, fullPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_') // Sanitize filename
      .substring(0, 50); // Limit length
    cb(null, `${uniqueSuffix}-${baseName}${ext}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    // CAD/Drawing files
    'application/acad',
    'application/x-acad',
    'application/dwg',
    'application/x-dwg',
    'image/vnd.dwg',
    'application/dxf',
    'application/x-dxf'
  ];

  // Also allow by extension for CAD files
  const allowedExtensions = ['.dwg', '.dxf', '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.rar', '.7z'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype} (${ext})`), false);
  }
};

// Multer upload instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
  }
});

/**
 * POST /api/upload
 * Upload single file
 */
router.post('/', authenticate, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }

  // Build file URL
  const relativePath = path.relative(uploadDir, req.file.path);
  const fileUrl = `/uploads/${relativePath.replace(/\\/g, '/')}`;

  res.json({
    success: true,
    data: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      url: fileUrl
    }
  });
});

/**
 * POST /api/upload/multiple
 * Upload multiple files (max 10)
 */
router.post('/multiple', authenticate, upload.array('files', 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No files uploaded'
    });
  }

  const files = req.files.map(file => {
    const relativePath = path.relative(uploadDir, file.path);
    return {
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      url: `/uploads/${relativePath.replace(/\\/g, '/')}`
    };
  });

  res.json({
    success: true,
    data: files
  });
});

/**
 * DELETE /api/upload
 * Delete uploaded file
 */
router.delete('/', authenticate, (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      message: 'File URL is required'
    });
  }

  // Convert URL to file path
  const filePath = path.join(uploadDir, url.replace('/uploads/', ''));

  // Security check: ensure file is within upload directory
  const resolvedPath = path.resolve(filePath);
  const resolvedUploadDir = path.resolve(uploadDir);

  if (!resolvedPath.startsWith(resolvedUploadDir)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } else {
    res.status(404).json({
      success: false,
      message: 'File not found'
    });
  }
});

// Error handling for multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB'
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  next();
});

module.exports = router;
