/**
 * CAD Generation Worker — BullMQ Worker
 * Spawns the Python CATIA controller script via child_process.
 * Mirrors the proven pattern from api/fea/fea_worker.js
 */
const { Worker } = require('bullmq');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getRedisConnection } = require('./cad_queue');
const { JOB_STATUS, PATHS } = require('./cad_constants');
const cadModel = require('./cad_model');

// Load CAD worker config
let workerConfig = {};
try {
  const configPath = path.resolve(__dirname, PATHS.CAD_WORKER_CONFIG);
  workerConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
} catch (e) {
  console.warn('[CAD Worker] Could not load config.json, using defaults');
}

// Initialize the worker
const cadWorker = new Worker('cad-generation-queue', async (job) => {
  console.log(`[CAD Worker] Started processing job ${job.id}`);

  const {
    inputFilePath,
    parameters,
    exportFormat,
    excelPath,
    mode,
    view,
    userId
  } = job.data;

  // Create output directory
  const outputDir = path.resolve(__dirname, '..', '..', workerConfig.paths?.output_dir || 'output/cad_results');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Create temp directory for parameter JSON
  const tempDir = path.resolve(__dirname, '..', '..', workerConfig.paths?.temp_dir || 'output/cad_temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Write parameters to temp JSON file
  const paramsFile = path.join(tempDir, `params_${job.id}.json`);
  fs.writeFileSync(paramsFile, JSON.stringify(parameters, null, 2), 'utf-8');

  // Update DB status to PROCESSING
  try {
    await cadModel.updateJobStatus(job.id, JOB_STATUS.PROCESSING, {
      progress_message: 'Starting CATIA automation...'
    });
  } catch (dbErr) {
    console.warn('[CAD Worker] DB update failed (non-fatal):', dbErr.message);
  }

  // Build Python command
  const pythonScript = path.resolve(__dirname, PATHS.PYTHON_SCRIPT);
  const pythonExe = workerConfig.paths?.python_executable || 'python';

  const args = [
    pythonScript,
    '--input', inputFilePath,
    '--params', paramsFile,
    '--output', outputDir,
    '--format', exportFormat || workerConfig.export?.format || 'both',
    '--mode', mode || 'design_table',
    '--view', view || workerConfig.camera?.default_view || 'isometric',
    '--jobId', job.id
  ];

  if (excelPath) {
    args.push('--excel', excelPath);
  }

  if (workerConfig.catia_visible) {
    args.push('--visible');
  }

  if (workerConfig.close_catia_after_job) {
    args.push('--close-catia');
  }

  console.log(`[CAD Worker] Spawning: ${pythonExe} ${args.join(' ')}`);

  // Execute Python script
  return new Promise((resolve, reject) => {
    const pyProcess = spawn(pythonExe, args, {
      cwd: path.resolve(__dirname, '..', '..'),
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let resultData = null;
    let stderrBuffer = '';

    pyProcess.stdout.on('data', (data) => {
      const output = data.toString();
      const lines = output.split('\n').filter(l => l.trim());

      for (const line of lines) {
        console.log(`[CAD Python stdout]: ${line}`);

        // Parse PROGRESS: markers
        if (line.includes('PROGRESS:')) {
          const message = line.split('PROGRESS:')[1].trim();
          // Report progress to BullMQ (captured by QueueEvents)
          job.updateProgress(message);

          // Update DB progress
          cadModel.updateJobStatus(job.id, JOB_STATUS.PROCESSING, {
            progress_message: message
          }).catch(() => {});
        }

        // Parse RESULT: final output
        if (line.includes('RESULT:')) {
          try {
            const jsonStr = line.split('RESULT:')[1].trim();
            resultData = JSON.parse(jsonStr);
          } catch (parseErr) {
            console.error('[CAD Worker] Failed to parse RESULT JSON:', parseErr.message);
          }
        }
      }
    });

    pyProcess.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
      console.error(`[CAD Python stderr]: ${data}`);
    });

    // Timeout
    const timeoutMs = workerConfig.worker?.job_timeout_ms || 900000; // 15 minutes
    const timeout = setTimeout(() => {
      pyProcess.kill('SIGTERM');
      reject(new Error(`CATIA job timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    pyProcess.on('close', async (code) => {
      clearTimeout(timeout);

      // Clean up temp params file
      try { fs.unlinkSync(paramsFile); } catch (e) {}

      if (code === 0 && resultData && resultData.success) {
        console.log(`[CAD Worker] Job ${job.id} completed successfully`);

        let pmiDataArray = null;
        if (resultData.pmi_count > 0 && resultData.exports?.pmi_data) {
          try {
            const pmiJsonString = fs.readFileSync(resultData.exports.pmi_data, 'utf-8');
            pmiDataArray = JSON.parse(pmiJsonString);
          } catch (e) {
            console.error('[CAD Worker] Failed to read PMI JSON file:', e.message);
          }
        }

        // Update DB with result
        try {
          await cadModel.updateJobStatus(job.id, JOB_STATUS.COMPLETED, {
            output_step_path: resultData.exports?.step || null,
            output_gltf_path: resultData.exports?.stl || null, // Map STL to gltf_path for web viewer
            output_3dxml_path: resultData.exports?.['3dxml'] || null,
            output_metadata_xml: resultData.exports?.metadata_xml || null,
            pmi_data: pmiDataArray,
            catia_duration_ms: resultData.duration_ms,
            progress_message: 'CATIA processing completed'
          });
        } catch (dbErr) {
          console.warn('[CAD Worker] DB update failed (non-fatal):', dbErr.message);
        }

        resolve({
          success: true,
          exports: resultData.exports,
          pmi_count: resultData.pmi_count,
          duration_ms: resultData.duration_ms
        });

      } else {
        const errorMsg = resultData?.error || stderrBuffer || `Python exited with code ${code}`;
        console.error(`[CAD Worker] Job ${job.id} failed: ${errorMsg}`);

        try {
          await cadModel.updateJobStatus(job.id, JOB_STATUS.FAILED, {
            error_message: errorMsg,
            progress_message: 'Job failed'
          });
        } catch (dbErr) {
          console.warn('[CAD Worker] DB update failed (non-fatal):', dbErr.message);
        }

        reject(new Error(errorMsg));
      }
    });

    pyProcess.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to spawn Python process: ${err.message}`));
    });
  });

}, {
  connection: getRedisConnection(),
  concurrency: workerConfig.worker?.max_concurrent_jobs || 1,
  limiter: {
    max: 1,
    duration: 1000
  }
});

cadWorker.on('completed', (job) => {
  console.log(`[CAD Worker] Job ${job.id} has completed!`);
});

cadWorker.on('failed', (job, err) => {
  console.log(`[CAD Worker] Job ${job?.id} has failed: ${err.message}`);
});

module.exports = cadWorker;
