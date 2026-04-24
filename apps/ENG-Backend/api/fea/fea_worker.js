const { Worker } = require('bullmq');
const { spawn } = require('child_process');
const path = require('path');
const { connection, getRedisConnection } = require('./fea_queue');

// Initialize the worker
const feaWorker = new Worker('fea-simulation-queue', async job => {
  console.log(`[Worker] Started processing job ${job.id}`);
  
  const { params, material, timestep, setting } = job.data;
  
  // Define output path
  const outputDir = path.join(__dirname, '..', '..', 'output', 'fea_results');
  const fs = require('fs');
  if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.join(outputDir, `job_${job.id}_result.json`);
  
  // Call Python script
  const pythonScript = path.join(__dirname, '..', '..', 'solvers', 'fea_solver', 'main.py');
  const sampleInputsDir = path.join(__dirname, '..', '..', 'solvers', 'fea_solver', 'sample_inputs');
  
  // Wait for the python script to complete
  return new Promise((resolve, reject) => {
    const pyProcess = spawn('python', [
      pythonScript,
      '--jobId', job.id,
      '--params', path.join(sampleInputsDir, 'parameters.csv'),
      '--material', path.join(sampleInputsDir, 'material.csv'),
      '--timestep', path.join(sampleInputsDir, 'timestep.csv'),
      '--setting', path.join(sampleInputsDir, 'setting.csv'),
      '--output', outputPath
    ]);

    pyProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[Python stdout]: ${output}`);
      // Parse progress markers
      if (output.includes('PROGRESS:')) {
        const message = output.split('PROGRESS:')[1].trim();
        // Report progress to BullMQ (which we can catch to emit WebSocket events)
        job.updateProgress(message);
      }
    });

    pyProcess.stderr.on('data', (data) => {
      console.error(`[Python stderr]: ${data}`);
    });

    pyProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`[Worker] Job ${job.id} completed successfully`);
        resolve({ resultFile: `/output/fea_results/job_${job.id}_result.json` });
      } else {
        console.error(`[Worker] Job ${job.id} failed with code ${code}`);
        reject(new Error(`Python solver exited with code ${code}`));
      }
    });
  });

}, { connection: getRedisConnection() });

feaWorker.on('completed', job => {
  console.log(`[Worker] Job ${job.id} has completed!`);
});

feaWorker.on('failed', (job, err) => {
  console.log(`[Worker] Job ${job.id} has failed with ${err.message}`);
});

module.exports = feaWorker;
