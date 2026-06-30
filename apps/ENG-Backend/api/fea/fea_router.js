const express = require('express');
const router = express.Router();
const { feaQueue, getRedisConnection } = require('./fea_queue');
const { QueueEvents } = require('bullmq');

// Initialize QueueEvents to listen to background worker progress
// We need a separate connection for QueueEvents, but with the same silent retry logic
const queueEvents = new QueueEvents('fea-simulation-queue', {
  connection: getRedisConnection()
});

let ioInstance = null;

// Function to inject IO instance later if needed, or we just grab it dynamically
function emitFeaProgress(jobId, data) {
    if (ioInstance) {
        ioInstance.to(`fea_${jobId}`).emit('fea-progress', data);
    }
}

// Listen to progress events globally
queueEvents.on('progress', ({ jobId, data }, id) => {
    console.log(`[Queue Event] Job ${jobId} progress: ${data}`);
    emitFeaProgress(jobId, { status: 'running', message: data });
});

queueEvents.on('completed', ({ jobId, returnvalue }) => {
    console.log(`[Queue Event] Job ${jobId} completed`);
    emitFeaProgress(jobId, { status: 'completed', result: returnvalue });
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
    console.log(`[Queue Event] Job ${jobId} failed: ${failedReason}`);
    emitFeaProgress(jobId, { status: 'failed', error: failedReason });
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

// POST /api/fea/simulate
router.post('/simulate', async (req, res) => {
  try {
    // In reality, you would parse the uploaded CSV files here from req.files
    // For boilerplate, we'll assume they are passed in body or files
    
    // Add job to queue with a strict 1.5-second timeout using Promise.race
    // This prevents BullMQ from hanging indefinitely if the Redis connection is dead
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Redis connection timeout')), 1500);
    });

    const job = await Promise.race([
      feaQueue.add('run-simulation', {
        params: req.body.params || 'default_params',
        material: req.body.material || 'default_material',
        timestep: req.body.timestep || 'default_timestep',
        setting: req.body.setting || 'default_setting'
      }),
      timeoutPromise
    ]);

    res.json({
      success: true,
      jobId: job.id,
      message: 'FEA Simulation job has been queued successfully.'
    });

  } catch (error) {
    console.error('Failed to queue simulation:', error.message);
    
    // Custom handling for Redis offline errors
    if (error.message.includes('Redis connection timeout') || error.message.includes('stream isn\'t writeable') || error.message.includes('connect ECONNREFUSED')) {
        return res.status(503).json({ 
            success: false, 
            message: 'FEA Task Queue is currently offline. Please ensure Redis is running.',
            error: error.message 
        });
    }

    res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
});

// GET /api/fea/status/:jobId
router.get('/status/:jobId', async (req, res) => {
    try {
        const job = await feaQueue.getJob(req.params.jobId);
        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }
        
        const state = await job.getState();
        const progress = job.progress;
        
        res.json({
            success: true,
            jobId: job.id,
            state,
            progress,
            result: job.returnvalue,
            failedReason: job.failedReason
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching job status', error: error.message });
    }
});

module.exports = router;
