CREATE TABLE IF NOT EXISTS newprod_html_to_pdf_jobs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    cn VARCHAR(100),
    source VARCHAR(20) DEFAULT 'MANUAL',
    status VARCHAR(50) DEFAULT 'Pending',
    condition VARCHAR(50) DEFAULT '-',
    error TEXT,
    input_file_path VARCHAR(255),
    output_pdf_path VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_newprod_html_to_pdf_jobs_user_id ON newprod_html_to_pdf_jobs(user_id);
