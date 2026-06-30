/**
 * CAD Generation Router — Express API Routes
 * Mirrors the proven pattern from api/fea/fea_router.js
 * 
 * Endpoints:
 *   POST   /api/cad/generate         — Submit a new CAD generation job
 *   GET    /api/cad/status/:jobId     — Get job status (BullMQ + DB)
 *   GET    /api/cad/result/:jobId     — Get exported files for a job
 *   POST   /api/cad/pdf/:jobId        — Trigger PDF generation
 *   GET    /api/cad/pdf/:jobId        — Download generated PDF
 *   GET    /api/cad/jobs              — List user's jobs
 *   GET    /api/cad/templates         — List parameter templates
 *   POST   /api/cad/templates         — Create parameter template
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { cadQueue, getRedisConnection } = require('./cad_queue');
const { QueueEvents } = require('bullmq');
const cadModel = require('./cad_model');
const { JOB_STATUS } = require('./cad_constants');

// Initialize QueueEvents to listen to background worker progress
const queueEvents = new QueueEvents('cad-generation-queue', {
  connection: getRedisConnection()
});

let ioInstance = null;

// Function to emit WebSocket progress events
function emitCadProgress(jobId, data) {
  if (ioInstance) {
    ioInstance.to(`cad_${jobId}`).emit('cad-progress', data);
  }
}

// Listen to progress events globally
queueEvents.on('progress', ({ jobId, data }) => {
  console.log(`[CAD Queue Event] Job ${jobId} progress: ${data}`);
  emitCadProgress(jobId, { status: 'processing', message: data });
});

queueEvents.on('completed', ({ jobId, returnvalue }) => {
  console.log(`[CAD Queue Event] Job ${jobId} completed`);
  emitCadProgress(jobId, { status: 'completed', result: returnvalue });
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.log(`[CAD Queue Event] Job ${jobId} failed: ${failedReason}`);
  emitCadProgress(jobId, { status: 'failed', error: failedReason });
});

queueEvents.on('error', err => {
  // Suppress connection errors when Redis is offline
});

// Middleware to capture IO instance
router.use((req, res, next) => {
  if (!ioInstance && req.app.get('io')) {
    ioInstance = req.app.get('io');
  }
  next();
});

// ============================================================================
// POST /api/cad/generate — Submit a new CAD generation job
// ============================================================================
router.post('/generate', async (req, res) => {
  try {
    let {
      parameters,
      exportFormat,
      mode,
      view
    } = req.body;

    // Parameters might be passed as a string in multipart/form-data
    if (typeof parameters === 'string') {
      try {
        parameters = JSON.parse(parameters);
      } catch (e) {
        return res.status(400).json({ success: false, message: 'Invalid JSON for parameters' });
      }
    }

    if (!parameters || typeof parameters !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'parameters object is required'
      });
    }

    let inputFilePath = null;
    let excelPath = null;
    
    // Process uploaded files if any
    if (req.files && req.files.files) {
      const uploadedFiles = Array.isArray(req.files.files) ? req.files.files : [req.files.files];
      const uniqueDirName = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const targetDir = path.resolve(__dirname, '..', '..', 'output', 'cad_uploads', uniqueDirName);
      
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      for (const file of uploadedFiles) {
        const destPath = path.join(targetDir, file.name);
        await file.mv(destPath);

        const lowerName = file.name.toLowerCase();
        // Auto-detect root CATProduct
        if (lowerName.includes('_drs01_') && lowerName.endsWith('.catproduct')) {
          inputFilePath = destPath;
        }
        // Auto-detect Excel file
        if (lowerName.endsWith('.xlsx')) {
          excelPath = destPath;
        }
      }
    }

    // Validate required fields
    if (!inputFilePath) {
      return res.status(400).json({
        success: false,
        message: 'A root CATProduct file containing "_DRS01_" in the name must be uploaded.'
      });
    }

    // Get user info from JWT
    const userId = req.user?.empno || req.user?.id || 'anonymous';

    // Add job to BullMQ queue with timeout protection
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Redis connection timeout')), 1500);
    });

    const job = await Promise.race([
      cadQueue.add('generate-cad', {
        inputFilePath,
        parameters,
        exportFormat: exportFormat || 'both',
        excelPath: excelPath || null,
        mode: mode || 'design_table',
        view: view || 'isometric',
        userId
      }, {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 }
      }),
      timeoutPromise
    ]);

    // Create DB record
    try {
      await cadModel.createJob(job.id, userId, inputFilePath, parameters);
    } catch (dbErr) {
      console.warn('[CAD Router] DB createJob failed (non-fatal):', dbErr.message);
    }

    res.json({
      success: true,
      jobId: job.id,
      message: 'CAD generation job has been queued successfully.'
    });

  } catch (error) {
    console.error('[CAD Router] Failed to queue job:', error.message);

    // Custom handling for Redis offline errors
    if (
      error.message.includes('Redis connection timeout') ||
      error.message.includes("stream isn't writeable") ||
      error.message.includes('connect ECONNREFUSED')
    ) {
      return res.status(503).json({
        success: false,
        message: 'CAD Job Queue is currently offline. Please ensure Redis is running.',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message
    });
  }
});

// ============================================================================
// GET /api/cad/status/:jobId — Get job status
// ============================================================================
router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    // Try BullMQ first for real-time status
    let bullmqState = null;
    let bullmqProgress = null;
    try {
      const job = await cadQueue.getJob(jobId);
      if (job) {
        bullmqState = await job.getState();
        bullmqProgress = job.progress;
      }
    } catch (e) {
      // Redis may be down, fall back to DB
    }

    // Get DB record
    let dbRecord = null;
    try {
      dbRecord = await cadModel.getJobById(jobId);
    } catch (e) {
      // DB may not have the record yet
    }

    if (!bullmqState && !dbRecord) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    res.json({
      success: true,
      jobId,
      bullmq: bullmqState ? {
        state: bullmqState,
        progress: bullmqProgress
      } : null,
      job: dbRecord || {
        status: bullmqState === 'completed' ? JOB_STATUS.COMPLETED :
                bullmqState === 'failed' ? JOB_STATUS.FAILED :
                bullmqState === 'active' ? JOB_STATUS.PROCESSING :
                JOB_STATUS.PENDING,
        progress_message: bullmqProgress || ''
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching job status',
      error: error.message
    });
  }
});

// ============================================================================
// GET /api/cad/result/:jobId — Get exported files for a job
// ============================================================================
router.get('/result/:jobId', async (req, res) => {
  try {
    const dbRecord = await cadModel.getJobById(req.params.jobId);

    if (!dbRecord) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (dbRecord.status !== JOB_STATUS.COMPLETED) {
      return res.status(400).json({
        success: false,
        message: `Job is not completed yet. Current status: ${dbRecord.status}`
      });
    }

    res.json({
      success: true,
      jobId: req.params.jobId,
      files: {
        step: dbRecord.output_step_path,
        gltf: dbRecord.output_gltf_path,
        '3dxml': dbRecord.output_3dxml_path,
        metadata_xml: dbRecord.output_metadata_xml,
        pdf: dbRecord.output_pdf_path,
        viewport_image: dbRecord.output_step_path
          ? dbRecord.output_step_path.replace('.stp', '_viewport.png')
          : null
      },
      pmi_data: dbRecord.pmi_data,
      duration_ms: dbRecord.catia_duration_ms
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching job result',
      error: error.message
    });
  }
});

// ============================================================================
// POST /api/cad/pdf/:jobId — Trigger PDF generation
// ============================================================================
router.post('/pdf/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const dbRecord = await cadModel.getJobById(jobId);

    if (!dbRecord) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (dbRecord.status !== JOB_STATUS.COMPLETED) {
      return res.status(400).json({
        success: false,
        message: `Job must be completed before PDF generation. Status: ${dbRecord.status}`
      });
    }

    // Import PDF generator
    const { generatePdf } = require('./pdfGenerator');
    const pdfStartTime = Date.now();

    const pdfResult = await generatePdf(jobId, req.body.frontendUrl);
    const pdfDuration = Date.now() - pdfStartTime;

    // Update DB with PDF path
    await cadModel.updateJobStatus(jobId, JOB_STATUS.COMPLETED, {
      output_pdf_path: pdfResult.pdfPath,
      pdf_duration_ms: pdfDuration
    });

    res.json({
      success: true,
      jobId,
      pdfPath: pdfResult.pdfPath,
      duration_ms: pdfDuration
    });

  } catch (error) {
    console.error('[CAD Router] PDF generation failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'PDF generation failed',
      error: error.message
    });
  }
});

// ============================================================================
// GET /api/cad/pdf/:jobId — Download generated PDF
// ============================================================================
router.get('/pdf/:jobId', async (req, res) => {
  try {
    const dbRecord = await cadModel.getJobById(req.params.jobId);

    if (!dbRecord || !dbRecord.output_pdf_path) {
      return res.status(404).json({
        success: false,
        message: 'PDF not found. Generate it first via POST /api/cad/pdf/:jobId'
      });
    }

    const pdfPath = path.resolve(dbRecord.output_pdf_path);
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({
        success: false,
        message: 'PDF file not found on disk'
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="drawing_${req.params.jobId}.pdf"`);
    fs.createReadStream(pdfPath).pipe(res);

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error downloading PDF',
      error: error.message
    });
  }
});

// ============================================================================
// GET /api/cad/jobs — List user's jobs
// ============================================================================
router.get('/jobs', async (req, res) => {
  try {
    const userId = req.user?.empno || req.user?.id;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const jobs = await cadModel.getJobsByUser(userId, limit, offset);
    res.json({ success: true, jobs });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching jobs',
      error: error.message
    });
  }
});

// ============================================================================
// GET /api/cad/templates — List parameter templates
// ============================================================================
router.get('/templates', async (req, res) => {
  try {
    const templates = await cadModel.getParamTemplates();
    res.json({ success: true, templates });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching templates',
      error: error.message
    });
  }
});

// ============================================================================
// POST /api/cad/templates — Create parameter template
// ============================================================================
router.post('/templates', async (req, res) => {
  try {
    const { name, description, catpartPath, parameters } = req.body;
    const userId = req.user?.empno || req.user?.id;

    if (!name || !catpartPath || !parameters) {
      return res.status(400).json({
        success: false,
        message: 'name, catpartPath, and parameters are required'
      });
    }

    const template = await cadModel.createParamTemplate(
      name, description, catpartPath, parameters, userId
    );

    res.json({ success: true, template });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating template',
      error: error.message
    });
  }
});

module.exports = router;
