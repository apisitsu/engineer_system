/**
 * CAD Generation Constants
 */

// Job statuses
const JOB_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
};

// Database table names
const TABLES = {
  CAD_JOBS: 'cad_jobs',
  CAD_PARAM_TEMPLATES: 'cad_param_templates'
};

// Export format options
const EXPORT_FORMAT = {
  BOTH: 'both',
  STEP: 'step',
  THREE_DXML: '3dxml'
};

// Camera view presets
const VIEW_PRESETS = {
  ISOMETRIC: 'isometric',
  FRONT: 'front',
  TOP: 'top',
  RIGHT: 'right'
};

// File paths
const PATHS = {
  OUTPUT_DIR: 'output/cad_results',
  TEMP_DIR: 'output/cad_temp',
  CAD_WORKER_DIR: '../../cad_worker',
  PYTHON_SCRIPT: '../../cad_worker/catia_controller.py',
  CAD_WORKER_CONFIG: '../../cad_worker/config.json'
};

module.exports = {
  JOB_STATUS,
  TABLES,
  EXPORT_FORMAT,
  VIEW_PRESETS,
  PATHS
};
