/**
 * CAD Jobs — PostgreSQL Database Model
 * Uses parameterized queries for SQL injection prevention (per project conventions).
 */
const { Pool } = require('pg');
const { TABLES, JOB_STATUS } = require('./cad_constants');

const { engPool: pool } = require('../../instance/eng_db');

/**
 * Create a new CAD job record
 */
async function createJob(jobId, userId, inputFilePath, parameters) {
  const query = `
    INSERT INTO ${TABLES.CAD_JOBS} 
      (job_id, user_id, status, input_file_path, parameters, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    RETURNING *
  `;
  const values = [jobId, userId, JOB_STATUS.PENDING, inputFilePath, JSON.stringify(parameters)];
  
  try {
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[CAD Model] createJob error:', error.message);
    throw error;
  }
}

/**
 * Update job status and optional result data
 */
async function updateJobStatus(jobId, status, resultData = {}) {
  const {
    output_step_path,
    output_gltf_path,
    output_3dxml_path,
    output_pdf_path,
    output_metadata_xml,
    pmi_data,
    error_message,
    progress_message,
    catia_duration_ms,
    pdf_duration_ms
  } = resultData;

  const query = `
    UPDATE ${TABLES.CAD_JOBS} SET
      status = $1,
      output_step_path = COALESCE($3, output_step_path),
      output_gltf_path = COALESCE($4, output_gltf_path),
      output_3dxml_path = COALESCE($5, output_3dxml_path),
      output_pdf_path = COALESCE($6, output_pdf_path),
      output_metadata_xml = COALESCE($7, output_metadata_xml),
      pmi_data = COALESCE($8, pmi_data),
      error_message = COALESCE($9, error_message),
      progress_message = COALESCE($10, progress_message),
      catia_duration_ms = COALESCE($11, catia_duration_ms),
      pdf_duration_ms = COALESCE($12, pdf_duration_ms),
      updated_at = NOW(),
      completed_at = ${['COMPLETED', 'FAILED'].includes(status) ? 'NOW()' : 'completed_at'}
    WHERE job_id = $2
    RETURNING *
  `;

  const values = [
    status, jobId,
    output_step_path || null,
    output_gltf_path || null,
    output_3dxml_path || null,
    output_pdf_path || null,
    output_metadata_xml || null,
    pmi_data ? JSON.stringify(pmi_data) : null,
    error_message || null,
    progress_message || null,
    catia_duration_ms || null,
    pdf_duration_ms || null
  ];

  try {
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[CAD Model] updateJobStatus error:', error.message);
    throw error;
  }
}

/**
 * Get a single job by BullMQ job ID
 */
async function getJobById(jobId) {
  const query = `SELECT * FROM ${TABLES.CAD_JOBS} WHERE job_id = $1`;
  try {
    const result = await pool.query(query, [jobId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[CAD Model] getJobById error:', error.message);
    throw error;
  }
}

/**
 * Get all jobs for a user with pagination
 */
async function getJobsByUser(userId, limit = 20, offset = 0) {
  const query = `
    SELECT * FROM ${TABLES.CAD_JOBS} 
    WHERE user_id = $1 
    ORDER BY created_at DESC 
    LIMIT $2 OFFSET $3
  `;
  try {
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('[CAD Model] getJobsByUser error:', error.message);
    throw error;
  }
}

/**
 * Get all parameter templates
 */
async function getParamTemplates() {
  const query = `SELECT * FROM ${TABLES.CAD_PARAM_TEMPLATES} ORDER BY name`;
  try {
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error('[CAD Model] getParamTemplates error:', error.message);
    throw error;
  }
}

/**
 * Create a parameter template
 */
async function createParamTemplate(name, description, catpartPath, parameters, createdBy) {
  const query = `
    INSERT INTO ${TABLES.CAD_PARAM_TEMPLATES}
      (name, description, catpart_path, parameters, created_by, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    RETURNING *
  `;
  const values = [name, description, catpartPath, JSON.stringify(parameters), createdBy];
  try {
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[CAD Model] createParamTemplate error:', error.message);
    throw error;
  }
}

module.exports = {
  createJob,
  updateJobStatus,
  getJobById,
  getJobsByUser,
  getParamTemplates,
  createParamTemplate
};
