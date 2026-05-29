-- ============================================================================
-- CAD Generation Module — PostgreSQL Schema
-- ============================================================================
-- Run with: psql -d app -f cad_schema.sql
-- ============================================================================

-- CAD Job Requests table
CREATE TABLE IF NOT EXISTS cad_jobs (
    id              SERIAL PRIMARY KEY,
    job_id          VARCHAR(64)   UNIQUE NOT NULL,  -- BullMQ job ID
    user_id         VARCHAR(20)   NOT NULL,         -- Employee number
    status          VARCHAR(20)   DEFAULT 'PENDING' 
                    CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    input_file_path TEXT,                           -- Original .CATPart/.CATProduct path
    parameters      JSONB,                          -- User-submitted parameter values
    output_step_path   TEXT,                        -- Exported STEP file path
    output_gltf_path   TEXT,                        -- Converted glTF path for web viewer
    output_3dxml_path  TEXT,                        -- 3D XML export path
    output_pdf_path    TEXT,                        -- Generated PDF path
    output_metadata_xml TEXT,                       -- Metadata XML path
    pmi_data        JSONB,                          -- Extracted PMI/annotation data
    error_message   TEXT,                           -- Error details on failure
    progress_message TEXT,                          -- Latest progress update
    catia_duration_ms INTEGER,                      -- CATIA processing time (milliseconds)
    pdf_duration_ms   INTEGER,                      -- PDF generation time (milliseconds)
    created_at      TIMESTAMPTZ   DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cad_jobs_user     ON cad_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_cad_jobs_status   ON cad_jobs(status);
CREATE INDEX IF NOT EXISTS idx_cad_jobs_created  ON cad_jobs(created_at DESC);


-- CAD Parameter Templates (reusable parameter configurations)
CREATE TABLE IF NOT EXISTS cad_param_templates (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100)  NOT NULL,
    description     TEXT,
    catpart_path    TEXT          NOT NULL,          -- Default .CATPart file path
    parameters      JSONB         NOT NULL,          -- Default parameter schema/values
    created_by      VARCHAR(20),
    created_at      TIMESTAMPTZ   DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cad_templates_name ON cad_param_templates(name);
